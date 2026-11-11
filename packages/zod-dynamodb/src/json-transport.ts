/**
 * JSON の transport（§7.4）を作る内部の補助。
 *
 * `@zodapp/zod-transport-json`（`zod-transform`）は、intersection の左右を別々に変換して
 * `{ ...left, ...right }` で浅くマージする。object の変換は shape にないキーを素通しするので、
 * 右側が素通しした値で左側の変換結果が上書きされ、左側の Date などが変換されないまま残る。
 * zodapp 側で直るまで、transport を作る前に intersection を平らな object（片方が union なら、
 * 選択肢ごとに平らにした union）に直して回避する。
 */
import {
  createJsonTransport,
  type JsonTransport,
} from "@zodapp/zod-transport-json";
import { z } from "zod";

type Def = Record<string, unknown>;
const defOf = (schema: z.ZodType): Def =>
  (schema as unknown as { _zod: { def: Def } })._zod.def;

/** intersection を取り除いた Schema（object・配列・optional・nullable の中も） */
const flatten = (schema: z.ZodType): z.ZodType => {
  const def = defOf(schema);
  switch (def.type) {
    case "union": {
      const options = (def.options as z.ZodType[]).map(flatten);
      if (options.every((o, i) => o === (def.options as z.ZodType[])[i])) {
        return schema;
      }
      return union(options, def.discriminator as string | undefined);
    }
    case "intersection":
      return merge(
        flatten(def.left as z.ZodType),
        flatten(def.right as z.ZodType),
      );
    // 出力の `{ item }` や `{ items: [...] }` の中の Item にも届くよう、入れ物の中も直す
    case "object": {
      const shape = (schema as z.ZodObject).shape as Record<string, z.ZodType>;
      const changed: Record<string, z.ZodType> = {};
      for (const [key, value] of Object.entries(shape)) {
        const next = flatten(value);
        if (next !== value) changed[key] = next;
      }
      return Object.keys(changed).length === 0
        ? schema
        : (schema as z.ZodObject).extend(changed);
    }
    case "array": {
      const element = def.element as z.ZodType;
      const next = flatten(element);
      return next === element ? schema : z.array(next);
    }
    case "optional":
    case "nullable": {
      const inner = def.innerType as z.ZodType;
      const next = flatten(inner);
      if (next === inner) return schema;
      return def.type === "optional" ? next.optional() : next.nullable();
    }
    default:
      return schema;
  }
};

const union = (options: z.ZodType[], discriminator: string | undefined) => {
  if (options.length === 1) return options[0]!;
  if (
    discriminator !== undefined &&
    options.every((o) => defOf(o).type === "object")
  ) {
    return z.discriminatedUnion(
      discriminator,
      options as [z.ZodObject, ...z.ZodObject[]],
    );
  }
  return z.union(options as [z.ZodType, z.ZodType, ...z.ZodType[]]);
};

/** 2 つの（平らにした）Schema の intersection を、平らな Schema にする */
const merge = (left: z.ZodType, right: z.ZodType): z.ZodType => {
  const l = defOf(left);
  const r = defOf(right);
  if (l.type === "union") {
    return union(
      (l.options as z.ZodType[]).map((o) => merge(o, right)),
      l.discriminator as string | undefined,
    );
  }
  if (r.type === "union") {
    return union(
      (r.options as z.ZodType[]).map((o) => merge(left, o)),
      r.discriminator as string | undefined,
    );
  }
  if (l.type === "object" && r.type === "object") {
    return z.object({
      ...(left as z.ZodObject).shape,
      ...(right as z.ZodObject).shape,
    });
  }
  // object 以外の intersection は、そのままにする
  return z.intersection(left, right);
};

/** JSON の transport を作る。intersection の制約を回避する */
export const jsonTransport = <T extends z.ZodType>(
  schema: T,
): JsonTransport<T> =>
  createJsonTransport(flatten(schema)) as unknown as JsonTransport<T>;
