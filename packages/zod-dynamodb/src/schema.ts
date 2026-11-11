import { z } from "zod";
import { DefinitionError } from "./errors";
import { schemaType } from "./encoding";

type AnySchema = z.core.$ZodType;

/**
 * itemのSchemaの1つのvariant。フィールド名からそのフィールドのSchemaへの対応。
 * itemのSchemaを辿って（object / intersection / union）作る内部専用の表現（§5.2）。
 */
export type Variant = ReadonlyMap<string, AnySchema>;

const defOf = (schema: AnySchema) =>
  (schema as unknown as { _zod: { def: Record<string, unknown> } })._zod.def;

/**
 * itemのSchemaを、フィールドの組のvariantの一覧に展開する。
 */
export const variantsOf = (schema: AnySchema): Variant[] => {
  const def = defOf(schema);
  switch (def.type) {
    case "object": {
      const shape = def.shape as Record<string, AnySchema>;
      return [new Map(Object.entries(shape))];
    }
    case "union":
      return (def.options as AnySchema[]).flatMap(variantsOf);
    case "intersection": {
      const left = variantsOf(def.left as AnySchema);
      const right = variantsOf(def.right as AnySchema);
      return left.flatMap((l) =>
        right.map((r) => {
          const merged = new Map(l);
          for (const [field, s] of r) {
            const existing = merged.get(field);
            merged.set(
              field,
              existing
                ? z.intersection(existing as z.ZodType, s as z.ZodType)
                : s,
            );
          }
          return merged;
        }),
      );
    }
    case "readonly":
      return variantsOf(def.innerType as AnySchema);
    default:
      throw new DefinitionError(
        `item schema of type "${String(def.type)}" is not supported (use object, union, discriminatedUnion or intersection)`,
      );
  }
};

/** すべてのvariantに現れるフィールド名 */
export const allFieldNames = (variants: readonly Variant[]): Set<string> => {
  const names = new Set<string>();
  for (const v of variants) for (const k of v.keys()) names.add(k);
  return names;
};

/**
 * 交差したSchemaの左辺（最初に定義されたもの）を取り出す。
 * キーのエンコード方式は、最初に定義されたSchemaから決める。
 */
export const primarySchema = (schema: AnySchema): AnySchema => {
  const def = defOf(schema);
  return def.type === "intersection"
    ? primarySchema(def.left as AnySchema)
    : schema;
};

export type FieldValidationResult =
  | { success: true; data: Record<string, unknown>; variant: Variant }
  | { success: false; error: string };

/**
 * フィールドの組を、フィールドごとのSchemaで検証する（§6.4 / §5.5）。
 *
 * すべてのフィールドを同じvariantで満たせれば通す。判別用のフィールドが含まれていれば
 * そのvariantだけが通り、含まれていなければいずれかのvariantを満たせば通す。
 * フィールドをまたぐ検証（object全体の `superRefine` など）は行わない。
 */
export const validateFields = (
  variants: readonly Variant[],
  values: Record<string, unknown>,
): FieldValidationResult => {
  const fields = Object.keys(values);
  let firstError: string | undefined;
  for (const variant of variants) {
    const data: Record<string, unknown> = {};
    let ok = true;
    for (const field of fields) {
      const schema = variant.get(field);
      if (!schema) {
        ok = false;
        firstError ??= `unknown field "${field}"`;
        break;
      }
      const result = z.safeParse(schema, values[field]);
      if (!result.success) {
        ok = false;
        firstError ??= `invalid value for "${field}": ${z.prettifyError(result.error)}`;
        break;
      }
      data[field] = result.data;
    }
    if (ok) return { success: true, data, variant };
  }
  return { success: false, error: firstError ?? "no matching variant" };
};

/** Schemaが `undefined` を受け付けるか（optionalなフィールドか） */
export const acceptsUndefined = (schema: AnySchema): boolean =>
  z.safeParse(schema, undefined).success;

export { schemaType };

/**
 * 「出力をもう一度同じ Schema に通しても通る」ことを確かめる（§5.4）。
 * ライブラリは、認可の前の検証、フックの値を足した後の item の検証、読み取りの検証で、
 * 同じ値を何度か parse する。入力と出力の型が違う `transform`・`pipe`（`preprocess`・`codec` も中身は pipe）
 * があると、出力を入力として通せず壊れるので、定義時にエラーにする。
 * `default`・`prefault`・`catch`・`coerce` は、出力をもう一度通しても通るので許す。
 * `z.custom` などの中身までは確かめられない。
 */
export const assertReparseable = (schema: AnySchema, label: string): void => {
  const seen = new Set<AnySchema>();
  const walk = (s: AnySchema, path: string): void => {
    if (seen.has(s)) return;
    seen.add(s);
    const def = defOf(s);
    const at = path === "" ? label : `${label}, field "${path}"`;
    switch (def.type) {
      case "pipe":
      case "transform":
        throw new DefinitionError(
          `${at}: ${String(def.type)} (transform, pipe, preprocess, codec) cannot be used because the output must parse again as input`,
        );
      case "object": {
        for (const [k, v] of Object.entries(
          def.shape as Record<string, AnySchema>,
        )) {
          walk(v, path === "" ? k : `${path}.${k}`);
        }
        if (def.catchall) walk(def.catchall as AnySchema, path);
        return;
      }
      case "union":
        for (const o of def.options as AnySchema[]) walk(o, path);
        return;
      case "intersection":
        walk(def.left as AnySchema, path);
        walk(def.right as AnySchema, path);
        return;
      case "optional":
      case "nullable":
      case "readonly":
      case "nonoptional":
      case "default":
      case "prefault":
      case "catch":
      case "success":
        walk(def.innerType as AnySchema, path);
        return;
      case "array":
        walk(def.element as AnySchema, `${path}[]`);
        return;
      case "tuple":
        (def.items as AnySchema[]).forEach((it, i) =>
          walk(it, `${path}[${i}]`),
        );
        if (def.rest) walk(def.rest as AnySchema, `${path}[]`);
        return;
      case "record":
      case "map":
        walk(def.keyType as AnySchema, `${path}{key}`);
        walk(def.valueType as AnySchema, `${path}{}`);
        return;
      case "set":
        walk(def.valueType as AnySchema, `${path}[]`);
        return;
      case "lazy":
        walk((def.getter as () => AnySchema)(), path);
        return;
      default:
        return;
    }
  };
  walk(schema, "");
};
