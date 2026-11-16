import React, { createContext, useContext, useMemo } from "react";
import type { z } from "zod";

/**
 * 同じ path に重なった schema の連なり（外から内の順）。
 *
 * TanStack Form は path ごとに欄を持つが、zod の `.optional()`・`.nullable()`・
 * `.default()`・`.refine()` などは、同じ path の外側の schema が持つ。
 * 部品が path で欄を切り出すと、その外側の情報が見えなくなるので、
 * {@link Switch} が描くたびに自分の schema をここへ積み、同じ path の内側の部品に渡す。
 *
 * - path が変われば（object・array・record・tuple の子）連なりは切れる（積み直す）
 * - union の腕は同じ path だが、腕を選ぶ欄が空を受け持つので {@link SamePathReset} で切る
 */
type SamePathValue = {
  path: string;
  chain: readonly z.ZodTypeAny[];
};

const SamePathContext = createContext<SamePathValue | null>(null);

/**
 * 同じ path の連なりに schema を積む。最後に積んだものと同じなら積まない。
 * `schemas` を渡したら、外から内の順にまとめて積む（Switch が剥がした包みと中身）
 */
export const SamePathProvider = ({
  path,
  schema,
  schemas,
  children,
}: {
  path: string;
  schema?: z.ZodTypeAny;
  schemas?: readonly z.ZodTypeAny[];
  children: React.ReactNode;
}) => {
  const outer = useContext(SamePathContext);
  const value = useMemo<SamePathValue>(() => {
    const base = outer && outer.path === path ? outer.chain : [];
    let chain = base;
    for (const next of schemas ?? (schema ? [schema] : [])) {
      if (chain[chain.length - 1] !== next) chain = [...chain, next];
    }
    return chain === base && outer && outer.path === path
      ? outer
      : { path, chain };
  }, [outer, path, schema, schemas]);
  return (
    <SamePathContext.Provider value={value}>
      {children}
    </SamePathContext.Provider>
  );
};

/** 同じ path の連なりを切る（union の腕など、外の包みを内に伝えないところ） */
export const SamePathReset = ({ children }: { children: React.ReactNode }) => (
  <SamePathContext.Provider value={null}>{children}</SamePathContext.Provider>
);

const EMPTY_CHAIN: readonly z.ZodTypeAny[] = [];

/** fieldPath の同じ path の連なり（外から内の順。自分を含む） */
export const useSamePathChain = (
  fieldPath: string,
): readonly z.ZodTypeAny[] => {
  const ctx = useContext(SamePathContext);
  return ctx && ctx.path === fieldPath ? ctx.chain : EMPTY_CHAIN;
};

const typeOf = (schema: z.ZodTypeAny): string =>
  (schema as { def?: { type?: string } }).def?.type ?? "";

/**
 * 連なりから、欄が空を受け付けるかを求める。
 * - optional：optional・default・prefault の中にある（空なら undefined を書く）
 * - nullable：nullable の中にある（optional でなければ空なら null を書く）
 */
export const emptinessOf = (
  chain: readonly z.ZodTypeAny[],
): { optional: boolean; nullable: boolean } => {
  let optional = false;
  let nullable = false;
  for (const schema of chain) {
    const type = typeOf(schema);
    if (type === "optional" || type === "default" || type === "prefault") {
      optional = true;
    } else if (type === "nullable") {
      nullable = true;
    }
  }
  return { optional, nullable };
};

/**
 * fieldPath の欄が空を受け付けるか（{@link emptinessOf}）と、欄を空にするときに書く値。
 * optional なら undefined、nullable だけなら null、どちらでもない（必須の）欄は undefined
 * （「必須」のエラーにする）。
 */
export const useEmptiness = (fieldPath: string) => {
  const chain = useSamePathChain(fieldPath);
  return useMemo(() => {
    const { optional, nullable } = emptinessOf(chain);
    return {
      optional,
      nullable,
      emptyValue: optional ? undefined : nullable ? null : undefined,
    };
  }, [chain]);
};

type Check = z.core.$ZodCheck<unknown>;

const checksOf = (schema: z.ZodTypeAny): readonly Check[] =>
  ((schema as { def?: { checks?: Check[] } }).def?.checks ?? []) as Check[];

const withChecks = (
  schema: z.ZodTypeAny,
  checks: readonly Check[],
): z.ZodTypeAny =>
  checks.length === 0
    ? schema
    : (schema.check(...(checks as Check[])) as z.ZodTypeAny);

/**
 * 実行時に決まった schema（inner）を、同じ path の外側の schema の連なりで包み直す。
 *
 * 内から外へ順に、optional・nullable・default・prefault は同じ包みを、
 * それ以外（dynamic の土台、lazy、preprocess など）は包まずに、
 * それぞれの schema に付いた検査（`.refine()`・`.min()` など）を付け直す。
 *
 * zod の公開されている def（`def.type`・`def.checks`・`def.defaultValue`）と
 * `.check()` だけを使う。pipe（transform）の out は付け直さない（検証の issue には効かないため）。
 */
export const rewrapWithChain = (
  inner: z.ZodTypeAny,
  chain: readonly z.ZodTypeAny[],
): z.ZodTypeAny => {
  let schema = inner;
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const outer = chain[index]!;
    const def = (outer as unknown as { def: Record<string, unknown> }).def;
    switch (typeOf(outer)) {
      case "optional":
        schema = schema.optional();
        break;
      case "nullable":
        schema = schema.nullable();
        break;
      case "default":
        schema = schema.default(def.defaultValue as never) as z.ZodTypeAny;
        break;
      case "prefault":
        schema = schema.prefault(def.defaultValue as never) as z.ZodTypeAny;
        break;
      default:
        break;
    }
    schema = withChecks(schema, checksOf(outer));
  }
  return schema;
};

/** Switch が剥がす包み（同じ path のまま中身を描くだけの schema） */
const PEELABLE = new Set([
  "optional",
  "nullable",
  "default",
  "prefault",
  "lazy",
]);

export type PeeledSchema = {
  /** 剥がした包み（外から内の順） */
  wrappers: readonly z.ZodTypeAny[];
  /** 包みの中身。部品はこれで選ぶ */
  inner: z.ZodTypeAny;
  /** 包みと中身（外から内の順）。連なりにまとめて積む */
  schemas: readonly z.ZodTypeAny[];
  /** nullable・default の中にあるか（初期値が無いとき null を渡す。今の部品と同じ） */
  nullDefault: boolean;
};

const peelCache = new WeakMap<z.ZodTypeAny, PeeledSchema>();

/**
 * 案D：schema の外側の同じ path の包み（optional・nullable・default・prefault・lazy）を剥がす。
 * 結果は schema ごとに WeakMap にキャッシュする（schema は不変）。
 * 包みに meta が付いていれば（hidden など、部品を meta で選ぶとき）、そこで止める。
 */
export const peelSamePath = (
  schema: z.ZodTypeAny,
  hasMeta: (schema: z.ZodTypeAny) => boolean,
): PeeledSchema => {
  const cached = peelCache.get(schema);
  if (cached) return cached;
  const wrappers: z.ZodTypeAny[] = [];
  let inner = schema;
  let nullDefault = false;
  for (let guard = 0; guard < 64; guard += 1) {
    const type = typeOf(inner);
    if (!PEELABLE.has(type) || hasMeta(inner)) break;
    wrappers.push(inner);
    const def = (inner as unknown as { def: Record<string, unknown> }).def;
    if (type === "nullable" || type === "default") nullDefault = true;
    inner =
      type === "lazy"
        ? (def.getter as () => z.ZodTypeAny)()
        : (def.innerType as z.ZodTypeAny);
  }
  const peeled = {
    wrappers,
    inner,
    schemas: [...wrappers, inner],
    nullDefault,
  };
  peelCache.set(schema, peeled);
  return peeled;
};
