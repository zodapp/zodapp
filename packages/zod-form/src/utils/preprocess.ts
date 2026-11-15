import { z } from "zod";
import { getMeta, zf } from "../def";
import { isPreprocessPipe } from "./schema";

type AnyMeta = Record<string, unknown> & { typeName?: string };

const metaOf = (schema: z.ZodTypeAny): AnyMeta | undefined =>
  getMeta(schema) as AnyMeta | undefined;

/**
 * schema の複製に meta を付け直す。meta は既存の meta に上書きで重ねる。
 * 型（typeName）は、中の schema に meta があればそちらを使う（preprocess に付けた
 * typeName は描画先を選ぶための仮のものなので、中の `zf.dynamic` などを上書きしない）。
 * typeName が zf の registry に無い（未知の型）なら何もしない。
 */
const withMeta = (schema: z.ZodTypeAny, meta: AnyMeta): z.ZodTypeAny => {
  const typeName = metaOf(schema)?.typeName ?? meta.typeName;
  const registry =
    typeName !== undefined
      ? (zf as Record<string, { registry?: z.core.$ZodRegistry<any> }>)[
          typeName
        ]?.registry
      : undefined;
  if (!registry) return schema;
  const { typeName: _ignored, ...rest } = { ...metaOf(schema), ...meta };
  const cloned = schema.clone({ ...schema.def });
  registry.add(cloned as never, rest as never);
  return cloned;
};

const hasInnerType = (
  schema: z.ZodTypeAny,
): schema is z.ZodOptional | z.ZodNullable | z.ZodDefault =>
  schema instanceof z.ZodOptional ||
  schema instanceof z.ZodNullable ||
  schema instanceof z.ZodDefault;

/**
 * フォームに描画するための schema を作る。`z.preprocess` を取り除き、
 * preprocess に登録されていた meta を中の schema に移す。
 *
 * zod-form はフォームの値を「中の schema の形」で扱う。preprocess は
 * 「型に合わない保存データを中の schema の形にそろえる」一方向の変換なので、
 * 描画では取り除き、値は {@link normalizePreprocessValue} で先にそろえておく。
 *
 * - optional / nullable / default を挟んで入れ子になっている preprocess も取り除く
 * - preprocess の meta は、外側ほど優先して中に重ねる
 *   （`z.preprocess(fn, schema).register(zf.union.registry, ...)` のように
 *   preprocess に meta を付けた書き方をそのまま受ける）
 */
export const stripPreprocess = (
  schema: z.ZodTypeAny,
  outerMeta?: AnyMeta,
): z.ZodTypeAny => {
  if (isPreprocessPipe(schema)) {
    const own = metaOf(schema);
    const merged =
      own || outerMeta ? ({ ...own, ...outerMeta } as AnyMeta) : undefined;
    return stripPreprocess(schema.def.out as z.ZodTypeAny, merged);
  }
  if (hasInnerType(schema)) {
    const inner = schema.def.innerType as z.ZodTypeAny;
    const nextInner = stripPreprocess(inner, outerMeta);
    if (nextInner === inner) return schema;
    return schema.clone({ ...schema.def, innerType: nextInner } as never);
  }
  return outerMeta ? withMeta(schema, outerMeta) : schema;
};

/**
 * schema 中の preprocess を値に順に当てて、中の schema の形にそろえる。
 * 変換が失敗したら、その段の値はそのままにする。
 * optional / nullable は値が undefined / null ならそこで止める。default は当てない。
 */
export const normalizePreprocessValue = (
  schema: z.ZodTypeAny,
  value: unknown,
): unknown => {
  if (isPreprocessPipe(schema)) {
    const result = schema.def.in.safeParse(value);
    const next = result.success ? result.data : value;
    return normalizePreprocessValue(schema.def.out as z.ZodTypeAny, next);
  }
  if (schema instanceof z.ZodOptional && value === undefined) return value;
  if (schema instanceof z.ZodNullable && value === null) return value;
  if (hasInnerType(schema)) {
    return normalizePreprocessValue(
      schema.def.innerType as z.ZodTypeAny,
      value,
    );
  }
  return value;
};
