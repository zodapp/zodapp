import {
  acceptsUndefined,
  DefinitionError,
  toStorage,
  validateFields,
  ValidationError,
  VERSION_ATTRIBUTE,
  type CompiledVector,
  type Variant,
} from "@zodapp/zod-dynamodb";
import { z } from "zod";
import { Validated, validatedOr } from "./validated";
import type { EntityCodec } from "./entity";
import { emptyActions, type UpdateActions } from "./expression";

type Raw = Record<string, unknown>;

/**
 * 作成するItemを組み立てる（§6.4 作成と削除）。
 * `{ ...createの入力, ...onCreate, ...onWrite, ...key }` をマージし、`item` で全体を検証する。
 */
export const buildCreate = (
  codec: EntityCodec,
  keyInput: unknown,
  input: unknown,
  now: Date,
): { key: Raw; item: Raw } => {
  const key = codec.parseKey(keyInput);
  const table = codec.table;
  // 検証済みの入力（executeOp が認可の前に検証したもの）は、もう一度 parse しない
  const parsedInput = validatedOr(input, (raw) => {
    const result = table.create.safeParse(raw);
    if (!result.success) {
      throw new ValidationError(
        `${codec.entity}: invalid create input: ${z.prettifyError(result.error)}`,
        result.error.issues,
      );
    }
    return result.data;
  });
  const ctx = { now, key };
  const merged = {
    ...(parsedInput as Raw),
    ...(table.onCreate?.(ctx) ?? {}),
    ...(table.onWrite?.(ctx) ?? {}),
    ...key,
  };
  return { key, item: parseItem(codec, merged) };
};

/** 置換（`set`）するItemを組み立てる。全体を `item` で検証する */
export const buildSet = (
  codec: EntityCodec,
  keyInput: unknown,
  input: unknown,
  now: Date,
): { key: Raw; item: Raw } => {
  const key = codec.parseKey(keyInput);
  const ctx = { now, key };
  // 検証済みの入力も、そうでない入力も、フックの値とキーを足してから item の Schema で検証する
  const merged = {
    ...((input instanceof Validated ? input.value : input) as Raw),
    ...(codec.table.onWrite?.(ctx) ?? {}),
    ...key,
  };
  return { key, item: parseItem(codec, merged) };
};

const parseItem = (codec: EntityCodec, value: Raw): Raw => {
  const result = codec.table.item.safeParse(value);
  if (!result.success) {
    throw new ValidationError(
      `${codec.entity}: item is invalid: ${z.prettifyError(result.error)}`,
      result.error.issues,
    );
  }
  return result.data as Raw;
};

/**
 * 部分更新の計画。書き込む値と、事前に読み取る必要があるかを持つ。
 */
export type UpdatePlan = {
  readonly key: Raw;
  readonly primary: Raw;
  /** 変更するフィールド（検証済み。`undefined` は削除） */
  readonly patch: Raw;
  readonly add: Readonly<Record<string, number>>;
  readonly where: Raw | undefined;
  /** フィールドの変更（Indexとベクトルの属性を除く） */
  readonly baseActions: UpdateActions;
  readonly affectedIndexes: ReadonlySet<string>;
  readonly affectedVectors: readonly CompiledVector[];
  /** 物理キーの付け直しに、保存されている値が必要か */
  readonly needsRead: boolean;
  /** 読み取った値が変わっていないことを `version` で確かめる必要があるか */
  readonly needsVersion: boolean;
  /**
   * 判別用のフィールドを変える更新で、変更後のvariant。読む経路で、前のvariantにしかない
   * フィールドとIndexの物理キーを消すのに使う（§6.4 読まない経路と読む経路）
   */
  readonly variant: Variant | undefined;
};

/**
 * 部分更新を検証し、`UpdateItem` の差分を作る（§6.4）。
 */
export const planUpdate = (
  codec: EntityCodec,
  keyInput: unknown,
  patchInput: Raw,
  addInput: Raw | undefined,
  where: Raw | undefined,
  now: Date,
): UpdatePlan => {
  const compiled = codec.compiled;
  const key = codec.parseKey(keyInput);
  const patchRaw: Raw = {
    ...patchInput,
    ...(codec.table.onWrite?.({ now, key }) ?? {}),
  };

  // キーは変更できない
  for (const f of compiled.keyFields) {
    if (!(f in patchRaw)) continue;
    const encoder = compiled.encoders.get(f)!;
    const value = patchRaw[f];
    if (
      value === undefined ||
      encoder.encode(value) !== encoder.encode(key[f])
    ) {
      throw new ValidationError(
        `${codec.entity}: key field "${f}" cannot be changed`,
      );
    }
    delete patchRaw[f];
  }
  for (const f of Object.keys(patchRaw)) {
    if (compiled.immutable.has(f)) {
      throw new ValidationError(`${codec.entity}: field "${f}" is immutable`);
    }
  }

  // フィールド単位の検証
  const validated = validateFields(compiled.variants, patchRaw);
  if (!validated.success) {
    throw new ValidationError(
      `${codec.entity}: invalid patch: ${validated.error}`,
    );
  }
  for (const [f, v] of Object.entries(patchRaw)) {
    if (v === undefined && !acceptsUndefined(validated.variant.get(f)!)) {
      throw new ValidationError(
        `${codec.entity}: field "${f}" cannot be removed`,
      );
    }
  }
  const patch = validated.data;

  // 原子的な加算
  const add: Record<string, number> = {};
  for (const [f, delta] of Object.entries(addInput ?? {})) {
    if (delta === undefined) continue;
    if (typeof delta !== "number" || !Number.isFinite(delta)) {
      throw new ValidationError(
        `${codec.entity}: add for "${f}" must be a number`,
      );
    }
    if (!compiled.fieldNames.has(f)) {
      throw new ValidationError(`${codec.entity}: unknown field "${f}" in add`);
    }
    if (f in patch) {
      throw new ValidationError(
        `${codec.entity}: field "${f}" is both patched and added`,
      );
    }
    if (compiled.keyFields.includes(f) || compiled.immutable.has(f)) {
      throw new ValidationError(
        `${codec.entity}: field "${f}" cannot be added to`,
      );
    }
    const usedByIndex = [...compiled.indexes.values()].some((idx) =>
      idx.fields.has(f),
    );
    const usedByVector = [...compiled.vectors.values()].some(
      (v) =>
        v.field === f ||
        v.partition.fields.includes(f) ||
        (v.filters.kind === "static" &&
          Object.values(v.filters.spec).some((p) => p.fields.includes(f))) ||
        v.filters.kind === "dynamic",
    );
    if (usedByIndex || usedByVector) {
      // Indexのキーは書き込む前に値を確定させる必要があるため（§6.4 原子的な加算）
      throw new DefinitionError(
        `${codec.entity}: field "${f}" is used by an index or a vector and cannot be added to`,
      );
    }
    add[f] = delta;
  }

  const baseActions = emptyActions();
  const vectorFields = new Set(
    [...compiled.vectors.values()].map((v) => v.field),
  );
  for (const [f, v] of Object.entries(patch)) {
    if (vectorFields.has(f)) continue; // ベクトルはスロットの属性に書く
    if (v === undefined) baseActions.remove.add(f);
    else baseActions.set.set(f, toStorage(v, validated.variant.get(f)!));
  }
  for (const [f, delta] of Object.entries(add)) baseActions.add.set(f, delta);
  baseActions.add.set(VERSION_ATTRIBUTE, 1);

  // 判別用のフィールド（すべてのvariantにあり、値によって一部のvariantしか受け付けない）を
  // 変えると、variantが切り替わりうる。前のvariantのフィールドを消すため、読む経路にする
  const variants = compiled.variants;
  const switchesVariant =
    variants.length > 1 &&
    Object.entries(patch).some(
      ([f, v]) =>
        variants.every((variant) => variant.has(f)) &&
        variants.some(
          (variant) => !z.safeParse(variant.get(f)! as z.ZodType, v).success,
        ),
    );

  // 付け直すIndexと、必要な値
  const patched = new Set(Object.keys(patch));
  const known = new Set([...patched, ...compiled.keyFields]);
  let needsRead = false;
  let needsVersion = false;
  const requireFields = (fields: Iterable<string>) => {
    for (const f of fields) {
      if (known.has(f)) continue;
      needsRead = true;
      // immutable のフィールドは、先に読んだ値がその後も変わらない
      if (!compiled.immutable.has(f)) needsVersion = true;
    }
  };
  const affectedIndexes = new Set<string>();
  for (const idx of compiled.indexes.values()) {
    if ([...idx.fields].some((f) => patched.has(f))) {
      affectedIndexes.add(idx.name);
      requireFields(idx.fields);
    }
  }
  const affectedVectors: CompiledVector[] = [];
  for (const vector of compiled.vectors.values()) {
    const staticFilterFields =
      vector.filters.kind === "static"
        ? Object.values(vector.filters.spec).flatMap((p) => p.fields)
        : [];
    const fields = [
      vector.field,
      ...vector.partition.fields,
      ...staticFilterFields,
    ];
    const touched =
      fields.some((f) => patched.has(f)) ||
      // 動的なフィルターはどのフィールドを使うかが実行時に決まるため、変更があれば組み立て直す
      (vector.filters.kind === "dynamic" && patched.size > 0);
    if (!touched) continue;
    affectedVectors.push(vector);
    if (
      vector.filters.kind === "dynamic" ||
      typeof vector.slot === "function"
    ) {
      needsRead = true;
      needsVersion = true;
    } else {
      requireFields(fields);
    }
  }

  return {
    key,
    primary: codec.primaryKey(key),
    patch,
    add,
    where,
    baseActions,
    affectedIndexes,
    affectedVectors,
    needsRead: needsRead || switchesVariant,
    needsVersion: needsVersion || switchesVariant,
    variant: switchesVariant ? validated.variant : undefined,
  };
};

/**
 * 計画に、Indexとベクトルの属性の付け直しを加えて、`UpdateItem` の差分を完成させる。
 * `before` は事前に読み取ったItem（読み取っていなければ `undefined`）。
 */
export const finalizeUpdate = async (
  codec: EntityCodec,
  plan: UpdatePlan,
  before: Raw | undefined,
): Promise<UpdateActions> => {
  const actions: UpdateActions = {
    set: new Map(plan.baseActions.set),
    remove: new Set(plan.baseActions.remove),
    add: new Map(plan.baseActions.add),
  };
  const values: Raw = { ...(before ?? {}), ...plan.key, ...plan.patch };
  for (const [f, v] of Object.entries(plan.patch)) {
    if (v === undefined) delete values[f];
  }
  let affectedIndexes = plan.affectedIndexes;
  let affectedVectors = plan.affectedVectors;
  if (plan.variant && before) {
    // variantの切り替え：変更後のvariantにないフィールドを消し、全体を検証して、
    // すべてのIndexとベクトルの属性を付け直す
    for (const f of Object.keys(before)) {
      if (plan.variant.has(f)) continue;
      delete values[f];
      actions.set.delete(f);
      actions.remove.add(f);
    }
    const result = codec.table.item.safeParse(values);
    if (!result.success) {
      throw new ValidationError(
        `${codec.entity}: the patch switches the variant but the item does not satisfy it: ${z.prettifyError(result.error)}`,
      );
    }
    affectedIndexes = new Set(codec.compiled.indexes.keys());
    affectedVectors = [...codec.compiled.vectors.values()];
  }
  for (const [name, keys] of codec.indexKeys(values, affectedIndexes)) {
    const physical = codec.compiled.indexes.get(name)!.physical;
    if (keys) {
      for (const [attr, v] of Object.entries(keys)) actions.set.set(attr, v);
    } else {
      // Indexのキーのフィールドが欠けたら、Indexから外す（sparse index）
      actions.remove.add(physical.pk);
      actions.remove.add(physical.sk);
    }
  }
  for (const vector of affectedVectors) {
    const next = await codec.vectorAttributes(vector, values);
    const nextAttrs = next?.attributes ?? {};
    for (const [attr, v] of Object.entries(nextAttrs)) actions.set.set(attr, v);
    for (const slotName of codec.vectorSlots(vector)) {
      const slot = codec.compiled.physical.vectorIndexes[slotName]!;
      for (const attr of [slot.vector, slot.hash, ...slot.filters]) {
        if (!(attr in nextAttrs)) actions.remove.add(attr);
      }
    }
  }
  return actions;
};
