import type { MsgFn } from "@zodapp/i18n-messages";
import "../messages/types";
import z from "zod";
import { getMeta } from "@zodapp/zod-form";

/** 同じ値を受け持つ包み（optional など）。中の schema を見る */
const WRAPPER_TYPES = new Set([
  "optional",
  "nullable",
  "default",
  "prefault",
  "readonly",
  "catch",
  "nonoptional",
]);

const MAX_DEPTH = 32;

/** 包みを外した schema（pipe は入力の側、lazy は中身） */
const unwrap = (schema: z.ZodTypeAny): z.ZodTypeAny => {
  let current = schema;
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    const def = current.def as {
      type: string;
      innerType?: z.ZodTypeAny;
      in?: z.ZodTypeAny;
      getter?: () => z.ZodTypeAny;
    };
    if (WRAPPER_TYPES.has(def.type) && def.innerType) {
      current = def.innerType;
    } else if (def.type === "pipe" && def.in) {
      current = def.in;
    } else if (def.type === "lazy" && def.getter) {
      current = def.getter();
    } else {
      return current;
    }
  }
  return current;
};

type FoundUnion = { schema: z.ZodTypeAny; name: string };

/** union の名前（腕を選ぶ欄のラベルと同じ） */
const unionName = (schema: z.ZodTypeAny, msg: MsgFn): string => {
  const meta = getMeta(schema) as
    | { selectorLabel?: string; label?: string | false }
    | undefined;
  return (
    msg.resolve(meta?.selectorLabel ?? (meta?.label || undefined)) ??
    msg("zodFormMantine.union.selectorLabel" /* タイプ */)
  );
};

/**
 * 同じ値を受け持つ schema をたどり、key をどれかの腕（object）に持つ discriminatedUnion を探す。
 * 包みは外し、intersection は両側、discriminatedUnion は全部の腕をたどる。
 * object の子の欄（path が変わるもの）には入らない
 */
const findOwner = (
  schema: z.ZodTypeAny,
  key: string,
  msg: MsgFn,
  depth = 0,
): FoundUnion | undefined => {
  if (depth > MAX_DEPTH) return undefined;
  const current = unwrap(schema);
  const def = current.def as {
    type: string;
    left?: z.ZodTypeAny;
    right?: z.ZodTypeAny;
    options?: z.ZodTypeAny[];
    discriminator?: string;
  };
  if (def.type === "intersection" && def.left && def.right) {
    return (
      findOwner(def.left, key, msg, depth + 1) ??
      findOwner(def.right, key, msg, depth + 1)
    );
  }
  if (def.type === "union" && def.options) {
    for (const option of def.options) {
      const arm = unwrap(option);
      if (
        def.discriminator !== undefined &&
        arm.def.type === "object" &&
        key in (arm as z.ZodObject).shape
      ) {
        return { schema: current, name: unionName(current, msg) };
      }
      // 腕がまた union・intersection なら、その中を探す
      const nested = findOwner(arm, key, msg, depth + 1);
      if (nested) return nested;
    }
  }
  return undefined;
};

/**
 * unrecognized_keys の文言。キーを腕に持つ discriminatedUnion の名前を、見つけた順に「と」でつなぎ、
 * 「連絡方法と会員タイプを選択してください」とする（同じ union は 1 回だけ）。
 * どのキーも見つからない（schema のどこにも無いキー）ときは undefined（issue のメッセージをそのまま出す）
 */
export const unrecognizedKeysMessage = (
  schema: z.ZodTypeAny,
  keys: readonly string[],
  msg: MsgFn,
): string | undefined => {
  const found: FoundUnion[] = [];
  for (const key of keys) {
    const owner = findOwner(schema, key, msg);
    if (owner && !found.some((union) => union.schema === owner.schema)) {
      found.push(owner);
    }
  }
  if (found.length === 0) return undefined;
  return msg(
    "zodFormMantine.union.selectOwners" /* ${names.join("と")}を選択してください */,
    { names: found.map((union) => union.name) },
  );
};
