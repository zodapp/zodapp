import {
  type AnyTableConfig,
  type CompiledTable,
  type CompiledVector,
  type VectorRuntimeConfig,
  checkKeyLength,
  composeKey,
  CorruptedDataError,
  decomposeKey,
  DefinitionError,
  fromStorage,
  MAX_PARTITION_KEY_BYTES,
  MAX_SORT_KEY_BYTES,
  normalizeWhere,
  SEPARATOR,
  toStorage,
  validateFields,
  ValidationError,
  VERSION_ATTRIBUTE,
} from "@zodapp/zod-dynamodb";
import { z } from "zod";
import { ExpressionContext, and } from "./expression";

/** ベクトル検索の実行時の設定を引く関数 */
export type VectorConfigResolver = (args: {
  entity: string;
  vector: string;
  /** `HASH` を構成するフィールドの値 */
  partition: Record<string, unknown>;
  /** エンコード済みの `HASH` の値 */
  hash: string;
}) => VectorRuntimeConfig | Promise<VectorRuntimeConfig>;

export type ParseErrorMode = "throw" | "skip";

export type FieldSelection =
  | { pick: readonly string[]; omit?: never }
  | { omit: readonly string[]; pick?: never };

type Raw = Record<string, unknown>;

const formatIssues = (error: z.ZodError) => z.prettifyError(error);

/**
 * 1つのTable定義について、論理的なItemと保存される属性との相互変換を担う。
 */
export class EntityCodec {
  readonly compiled: CompiledTable;
  readonly physicalAttributes: ReadonlySet<string>;

  constructor(
    readonly table: AnyTableConfig,
    private readonly resolveVectorConfig:
      | ((
          vector: CompiledVector,
          partition: Record<string, unknown>,
          hash: string,
        ) => Promise<VectorRuntimeConfig>)
      | undefined,
  ) {
    this.compiled = table._compiled;
    this.physicalAttributes = table.table.reservedAttributes;
  }

  get entity() {
    return this.compiled.entity;
  }

  get tableName() {
    return this.compiled.physical.name;
  }

  // ---- キー ----

  /** キーを内部のキー検証Schemaで検証する */
  parseKey(key: unknown): Raw {
    const result = this.compiled.keySchema.safeParse(key);
    if (!result.success) {
      throw new ValidationError(
        `${this.entity}: invalid key: ${formatIssues(result.error)}`,
        result.error.issues,
      );
    }
    return result.data;
  }

  /** ベーステーブルの物理キー */
  primaryKey(key: Raw): Raw {
    const { pk, sk } = this.compiled.physical.primary;
    return {
      [pk]: checkKeyLength(
        composeKey(this.entity, this.compiled.key.partition, key)!,
        MAX_PARTITION_KEY_BYTES,
        "partition key",
      ),
      [sk]: checkKeyLength(
        composeKey(this.entity, this.compiled.key.sort, key)!,
        MAX_SORT_KEY_BYTES,
        "sort key",
      ),
    };
  }

  /** ベーステーブルの物理キーから論理キーを逆算する */
  keyFromPrimary(raw: Raw): Raw {
    const { pk, sk } = this.compiled.physical.primary;
    const key = {
      ...decomposeKey(
        this.entity,
        this.compiled.key.partition,
        raw[pk] as string,
      ),
      ...decomposeKey(this.entity, this.compiled.key.sort, raw[sk] as string),
    };
    return this.parseKey(key);
  }

  keyOf(item: Raw): Raw {
    const key: Raw = {};
    for (const f of this.compiled.keyFields) key[f] = item[f];
    return key;
  }

  /** `PK` / `SK` から同じItemかを判定するための文字列 */
  identity(primary: Raw): string {
    const { pk, sk } = this.compiled.physical.primary;
    return `${this.tableName}\u0000${primary[pk]}\u0000${primary[sk]}`;
  }

  // ---- Indexの物理キー ----

  /**
   * 各Indexの物理キーを組み立てる。フィールドが一つでも欠けるIndexは `undefined`（sparse）。
   */
  indexKeys(
    values: Raw,
    only?: ReadonlySet<string>,
  ): Map<string, Raw | undefined> {
    const out = new Map<string, Raw | undefined>();
    for (const idx of this.compiled.indexes.values()) {
      if (only && !only.has(idx.name)) continue;
      const pk = composeKey(this.entity, idx.partition, values);
      const sk = composeKey(this.entity, idx.sort, values);
      out.set(
        idx.name,
        pk === undefined || sk === undefined
          ? undefined
          : {
              [idx.physical.pk]: checkKeyLength(
                pk,
                MAX_PARTITION_KEY_BYTES,
                `index ${idx.name} partition key`,
              ),
              [idx.physical.sk]: checkKeyLength(
                sk,
                MAX_SORT_KEY_BYTES,
                `index ${idx.name} sort key`,
              ),
            },
      );
    }
    return out;
  }

  // ---- ベクトル ----

  /** ベクトルの属性（ベクトル、`HASH`、`INLINE_FILTER`）を組み立てる */
  async vectorAttributes(
    vector: CompiledVector,
    item: Raw,
  ): Promise<{ slot: string; attributes: Raw } | undefined> {
    const embedding = item[vector.field];
    if (embedding === undefined) return undefined;
    const partition: Raw = {};
    for (const f of vector.partition.fields) partition[f] = item[f];
    const hash = composeKey(this.entity, vector.partition, item);
    let config: VectorRuntimeConfig | undefined;
    if (vector.dynamic) {
      if (hash === undefined) {
        throw new ValidationError(
          `${this.entity}: vector "${vector.name}" needs all partition fields to resolve its configuration`,
        );
      }
      if (!this.resolveVectorConfig) {
        throw new DefinitionError(
          `${this.entity}: vector "${vector.name}" needs resolveVectorConfig`,
        );
      }
      config = await this.resolveVectorConfig(vector, partition, hash);
    }
    const ctx = { vectorConfig: config! };
    const slotName =
      typeof vector.slot === "string" ? vector.slot : vector.slot(item, ctx);
    const slot = this.compiled.physical.vectorIndexes[slotName];
    if (!slot) {
      throw new DefinitionError(
        `${this.entity}: vector "${vector.name}" resolved to unknown slot "${slotName}"`,
      );
    }
    if (!Array.isArray(embedding) || embedding.length !== slot.dimensions) {
      throw new ValidationError(
        `${this.entity}: vector "${vector.name}" must have ${slot.dimensions} dimensions`,
      );
    }
    const attributes: Raw = { [slot.vector]: embedding };
    if (hash !== undefined) {
      attributes[slot.hash] = checkKeyLength(
        hash,
        MAX_PARTITION_KEY_BYTES,
        "vector hash",
      );
    }
    const filters =
      vector.filters.kind === "static"
        ? this.staticFilters(vector, item)
        : vector.filters.kind === "dynamic"
          ? vector.filters.build(item, ctx)
          : {};
    for (const [attr, value] of Object.entries(filters)) {
      if (!slot.filters.includes(attr)) {
        throw new DefinitionError(
          `${this.entity}: slot "${slotName}" has no filter attribute "${attr}"`,
        );
      }
      attributes[attr] = value;
    }
    return { slot: slotName, attributes };
  }

  /** 静的なフィルターの値。フィールドが一つでも欠ける属性は書かない */
  staticFilters(vector: CompiledVector, values: Raw): Record<string, string> {
    const out: Record<string, string> = {};
    if (vector.filters.kind !== "static") return out;
    for (const [attr, part] of Object.entries(vector.filters.spec)) {
      const encoded: string[] = [];
      let complete = true;
      part.fields.forEach((f, i) => {
        const v = values[f];
        if (v === undefined) complete = false;
        else encoded.push(part.encoders[i]!.encode(v));
      });
      if (complete) out[attr] = encoded.join(SEPARATOR);
    }
    return out;
  }

  /** このエンティティのベクトルが使いうるスロット */
  vectorSlots(vector: CompiledVector): string[] {
    return typeof vector.slot === "string"
      ? [vector.slot]
      : Object.keys(this.compiled.physical.vectorIndexes);
  }

  // ---- Item全体 ----

  /** itemのSchemaで検証済みのItemを、保存する属性にする */
  async toStored(item: Raw, version: number): Promise<Raw> {
    const stored = this.storeFields(item);
    for (const vector of this.compiled.vectors.values()) {
      delete stored[vector.field];
      const attrs = await this.vectorAttributes(vector, item);
      if (attrs) Object.assign(stored, attrs.attributes);
    }
    Object.assign(stored, this.primaryKey(item));
    for (const keys of this.indexKeys(item).values()) {
      if (keys) Object.assign(stored, keys);
    }
    stored[VERSION_ATTRIBUTE] = version;
    return stored;
  }

  /** 保存されている属性から、物理キーとライブラリ管理属性を取り除き、ベクトルを元のフィールドに戻す */
  private strip(raw: Raw): Raw {
    const out: Raw = {};
    for (const [attr, value] of Object.entries(raw)) {
      if (
        !this.physicalAttributes.has(attr) &&
        this.compiled.fieldNames.has(attr)
      ) {
        out[attr] = value;
      }
    }
    for (const vector of this.compiled.vectors.values()) {
      for (const slotName of this.vectorSlots(vector)) {
        const attr = this.compiled.physical.vectorIndexes[slotName]!.vector;
        if (raw[attr] !== undefined) {
          out[vector.field] = raw[attr];
          break;
        }
      }
    }
    return out;
  }

  /** 保存されている属性を、itemのSchemaでparseする */
  decode(raw: Raw): { item: Raw; version: number } {
    const values = this.loadFields(this.strip(raw));
    const result = this.table.item.safeParse(values);
    if (!result.success) {
      throw new CorruptedDataError(
        `${this.entity}: stored item does not match the item schema: ${formatIssues(result.error)}`,
      );
    }
    return {
      item: result.data as Raw,
      version: Number(raw[VERSION_ATTRIBUTE] ?? 0),
    };
  }

  /** 一部のフィールドだけを、各フィールドのSchemaで検証して返す（射影・フィールドの指定） */
  decodePartial(values: Raw): Raw {
    const result = validateFields(
      this.compiled.variants,
      this.fromStoragePartial(values),
    );
    if (!result.success) {
      throw new CorruptedDataError(`${this.entity}: ${result.error}`);
    }
    return result.data;
  }

  private fromStoragePartial(values: Raw): Raw {
    return this.loadFields(values);
  }

  /**
   * フィールドの値を保存できる形にする。値を満たすvariantのフィールドのSchemaで変換する
   * （union / intersection の中でも、フィールドごとに正しいSchemaを使うため）。
   */
  storeFields(values: Raw): Raw {
    const defined = Object.entries(values).filter(([, v]) => v !== undefined);
    const variant =
      this.compiled.variants.find((v) =>
        defined.every(([f, value]) => {
          const schema = v.get(f);
          return schema !== undefined && z.safeParse(schema, value).success;
        }),
      ) ?? this.compiled.variants[0]!;
    const out: Raw = {};
    for (const [f, value] of defined) {
      const schema = variant.get(f) ?? this.fieldSchema(f);
      out[f] = schema ? toStorage(value, schema) : value;
    }
    return out;
  }

  /** 保存されている値を、フィールドのSchemaに沿って戻す。値を満たすvariantを選ぶ */
  loadFields(values: Raw): Raw {
    let fallback: Raw | undefined;
    for (const variant of this.compiled.variants) {
      const out: Raw = {};
      let ok = true;
      for (const [f, value] of Object.entries(values)) {
        const schema = variant.get(f);
        if (!schema) {
          ok = false;
          out[f] = value;
          continue;
        }
        out[f] = fromStorage(value, schema);
        if (ok && !z.safeParse(schema, out[f]).success) ok = false;
      }
      if (ok) return out;
      fallback ??= out;
    }
    return fallback ?? values;
  }

  /** フィールドのSchema（最初に現れるvariantのもの） */
  fieldSchema(field: string): z.core.$ZodType | undefined {
    for (const v of this.compiled.variants) {
      const s = v.get(field);
      if (s) return s;
    }
    return undefined;
  }

  /** 保存されている属性から、射影の結果（キーとIndexのキーと射影された属性）を作る */
  decodeProjection(raw: Raw, indexName: string | undefined): Raw {
    const values: Raw = { ...this.keyFromPrimary(raw) };
    if (indexName !== undefined) {
      const idx = this.compiled.indexes.get(indexName)!;
      Object.assign(
        values,
        decomposeKey(
          this.entity,
          idx.partition,
          raw[idx.physical.pk] as string,
        ),
        decomposeKey(this.entity, idx.sort, raw[idx.physical.sk] as string),
      );
    }
    const rest: Raw = {};
    for (const [attr, value] of Object.entries(this.strip(raw))) {
      if (!(attr in values)) rest[attr] = value;
    }
    return { ...this.decodePartial({ ...values, ...rest }) };
  }

  /** フィールドの指定から `ProjectionExpression` を作る。列挙できない場合は `undefined` */
  projection(
    selection: FieldSelection | undefined,
    ctx: ExpressionContext,
  ): { expression: string | undefined; fields: Set<string> | undefined } {
    if (!selection) return { expression: undefined, fields: undefined };
    const fields = new Set<string>(this.compiled.keyFields);
    if (selection.pick) {
      for (const f of selection.pick) fields.add(f);
    } else {
      const omit = new Set(selection.omit);
      for (const f of this.compiled.fieldNames) if (!omit.has(f)) fields.add(f);
    }
    const attributes = new Set<string>([
      this.compiled.physical.primary.pk,
      this.compiled.physical.primary.sk,
      VERSION_ATTRIBUTE,
    ]);
    for (const f of fields) {
      const vector = [...this.compiled.vectors.values()].find(
        (v) => v.field === f,
      );
      if (vector) {
        for (const slot of this.vectorSlots(vector)) {
          attributes.add(this.compiled.physical.vectorIndexes[slot]!.vector);
        }
      } else {
        attributes.add(f);
      }
    }
    return {
      expression: [...attributes].map((a) => ctx.name(a)).join(", "),
      fields,
    };
  }

  /** 指定したフィールドだけを返す */
  decodeSelected(
    raw: Raw,
    fields: ReadonlySet<string>,
  ): { item: Raw; version: number } {
    const values: Raw = {};
    for (const [attr, value] of Object.entries(this.strip(raw))) {
      if (fields.has(attr)) values[attr] = value;
    }
    return {
      item: this.decodePartial(values),
      version: Number(raw[VERSION_ATTRIBUTE] ?? 0),
    };
  }

  // ---- 書き込みの条件 ----

  /** `where` を `ConditionExpression` に変換する（§6.4） */
  whereExpression(
    where: Record<string, unknown> | undefined,
    ctx: ExpressionContext,
  ): string | undefined {
    const parts: string[] = [];
    for (const { field, op, value } of normalizeWhere(where)) {
      if (!this.compiled.fieldNames.has(field)) {
        throw new ValidationError(
          `${this.entity}: unknown field "${field}" in where`,
        );
      }
      if ([...this.compiled.vectors.values()].some((v) => v.field === field)) {
        throw new ValidationError(
          `${this.entity}: where conditions on vector field "${field}" are not supported`,
        );
      }
      const schema = this.fieldSchema(field)!;
      const enc = (v: unknown) => ctx.value(toStorage(v, schema));
      const name = ctx.name(field);
      switch (op) {
        case "eq":
          parts.push(`${name} = ${enc(value)}`);
          break;
        case "ne":
          parts.push(`${name} <> ${enc(value)}`);
          break;
        case "gt":
          parts.push(`${name} > ${enc(value)}`);
          break;
        case "gte":
          parts.push(`${name} >= ${enc(value)}`);
          break;
        case "lt":
          parts.push(`${name} < ${enc(value)}`);
          break;
        case "lte":
          parts.push(`${name} <= ${enc(value)}`);
          break;
        case "between": {
          const [low, high] = value as [unknown, unknown];
          parts.push(`${name} BETWEEN ${enc(low)} AND ${enc(high)}`);
          break;
        }
        case "in": {
          const list = value as unknown[];
          if (list.length === 0) {
            parts.push(
              `attribute_exists(${name}) AND attribute_not_exists(${name})`,
            );
          } else {
            parts.push(`${name} IN (${list.map(enc).join(", ")})`);
          }
          break;
        }
        case "exists":
          parts.push(`attribute_exists(${name})`);
          break;
        case "notExists":
          parts.push(`attribute_not_exists(${name})`);
          break;
        case "beginsWith":
          parts.push(`begins_with(${name}, ${ctx.value(value)})`);
          break;
        case "contains":
          parts.push(`contains(${name}, ${ctx.value(value)})`);
          break;
        case "size": {
          const ops: Record<string, string> = {
            eq: "=",
            ne: "<>",
            gt: ">",
            gte: ">=",
            lt: "<",
            lte: "<=",
          };
          for (const [sizeOp, n] of Object.entries(
            value as Record<string, number>,
          )) {
            if (n === undefined) continue;
            parts.push(`size(${name}) ${ops[sizeOp]} ${ctx.value(n)}`);
          }
          break;
        }
      }
    }
    return and(...parts);
  }
}
