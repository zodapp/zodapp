import { useMemo } from "react";
import type { z } from "zod";
import { getMeta } from "@zodapp/zod-form";
import type { MsgFn } from "@zodapp/i18n-messages";
import { useMsg } from "../messages/useMsg";

/**
 * meta のうち、表示する文言として辞書で引き直すプロパティ。
 * `msgKey(...)` で詰めたキーなら訳し、普通の文字列ならそのまま。
 */
export const TEXT_META_KEYS = [
  "label",
  "trueLabel",
  "falseLabel",
  "emptyMessage",
  "selectorLabel",
  "unselectedLabel",
  "placeholder",
] as const;

/** meta の文言（{@link TEXT_META_KEYS}）を msg.resolve に通したコピーを返す */
export const resolveMeta = <T>(meta: T, msg: Pick<MsgFn, "resolve">): T => {
  if (!meta || typeof meta !== "object") return meta;
  let resolved: Record<string, unknown> | undefined;
  for (const key of TEXT_META_KEYS) {
    const value = (meta as Record<string, unknown>)[key];
    if (typeof value !== "string") continue;
    const next = msg.resolve(value);
    if (next === value) continue;
    resolved ??= { ...(meta as Record<string, unknown>) };
    resolved[key] = next;
  }
  return (resolved as T | undefined) ?? meta;
};

/**
 * `getMeta(schema)` の結果の文言（label など）を、辞書で引き直して返す hook。
 * 部品の本体（hook を呼べる位置）で getMeta の代わりに使う。
 */
type TypeNameArg = NonNullable<Parameters<typeof getMeta>[1]>;

export const useResolvedMeta = <
  S extends z.ZodTypeAny,
  TypeName extends TypeNameArg = S["type"] extends TypeNameArg
    ? S["type"]
    : TypeNameArg,
>(
  schema: S,
  typeName?: TypeName,
): ReturnType<typeof getMeta<S, TypeName>> => {
  const msg = useMsg();
  const meta = getMeta<S, TypeName>(schema, typeName);
  return useMemo(() => resolveMeta(meta, msg), [meta, msg]);
};

/**
 * 文言（キーで詰めた文字列か、普通の文字列）を辞書で引き直す関数を返す hook。
 * ループや callback の中で meta の label などを表示するときに使う。
 */
export const useResolveText = (): MsgFn["resolve"] => useMsg().resolve;
