import type { z } from "zod";

type Check = z.core.$ZodCheck<unknown>;

/** 同じ path の外側の包み 1 つぶん */
export type OuterWrap = {
  /** 包みの種類。optional・nullable・default・prefault 以外（dynamic の土台、preprocess など）は "checks" */
  type: "optional" | "nullable" | "default" | "prefault" | "checks";
  /** その包み（または schema）に付いた検査（`.refine()` など） */
  checks: readonly Check[];
  /** default・prefault の既定の値 */
  defaultValue?: unknown;
};

/**
 * 同じ path の外側の包みの情報（案F）。包みの部品が自分の分を足して、内の Switch に props で渡す。
 * path が変わるところ（object・array・record・tuple の子）と union の腕では消して渡す。
 *
 * - optional・nullable：undefined・null を受け付けるか。部品は取り消しの UI、必須の印、空にしたときに書く値をここから決める
 * - wraps：外側の包みの並び（外から内の順）。dynamic・externalKey が、決まった schema を包み直すのに使う
 */
export type Outer = {
  readonly optional: boolean;
  readonly nullable: boolean;
  readonly wraps: readonly OuterWrap[];
};

const typeOf = (schema: z.ZodTypeAny): string =>
  (schema as unknown as { def?: { type?: string } }).def?.type ?? "";

/** schema に付いた検査（zod 4 では refine も包みを作らず、同じ型の複製の def.checks に入る） */
export const checksOf = (schema: z.ZodTypeAny | undefined): readonly Check[] =>
  ((schema as unknown as { def?: { checks?: Check[] } } | undefined)?.def
    ?.checks ?? []) as Check[];

const EMPTY: Outer = { optional: false, nullable: false, wraps: [] };
const ROOT_KEY = {};
const cache = new WeakMap<object, WeakMap<z.ZodTypeAny, Outer>>();

/**
 * outer に schema（自分）の分を足した outer を返す。同じ outer と schema なら同じ object を返す
 * （props が毎回変わって、memo した部品が描き直されないように）。
 *
 * - optional・nullable・default・prefault：その種類と、付いた検査を足す
 * - それ以外：付いた検査だけを足す（検査が無ければ outer をそのまま返す）
 */
export const addOuter = (
  outer: Outer | undefined,
  schema: z.ZodTypeAny,
): Outer => {
  const base = outer ?? EMPTY;
  const key = outer ?? ROOT_KEY;
  let bySchema = cache.get(key);
  if (!bySchema) {
    bySchema = new WeakMap();
    cache.set(key, bySchema);
  }
  const cached = bySchema.get(schema);
  if (cached) return cached;

  const type = typeOf(schema);
  const checks = checksOf(schema);
  let next: Outer;
  if (
    type === "optional" ||
    type === "nullable" ||
    type === "default" ||
    type === "prefault"
  ) {
    const def = (schema as unknown as { def: { defaultValue?: unknown } }).def;
    next = {
      optional: base.optional || type !== "nullable",
      nullable: base.nullable || type === "nullable",
      wraps: [
        ...base.wraps,
        {
          type,
          checks,
          ...(type === "default" || type === "prefault"
            ? { defaultValue: def.defaultValue }
            : {}),
        },
      ],
    };
  } else if (checks.length > 0) {
    next = { ...base, wraps: [...base.wraps, { type: "checks", checks }] };
  } else {
    next = base;
  }
  bySchema.set(schema, next);
  return next;
};

/** 欄が空を受け付けるかと、空にしたときに書く値 */
export const emptinessOf = (outer: Outer | undefined) => {
  const optional = outer?.optional === true;
  const nullable = outer?.nullable === true;
  return {
    optional,
    nullable,
    emptyValue: optional ? undefined : nullable ? null : undefined,
  } as const;
};

const withChecks = (schema: z.ZodTypeAny, checks: readonly Check[]) =>
  checks.length === 0
    ? schema
    : (schema.check(...(checks as Check[])) as z.ZodTypeAny);

/**
 * 実行時に決まった schema（inner）を、欄の schema（own：dynamic・externalKey の土台）の検査と、
 * 外側の包み（outer.wraps）で包み直す。内から外の順に、own の検査 → wraps を内から外へ
 * （optional・nullable・default・prefault は同じ包み、そのあとにその包みの検査）。
 *
 * zod の公開されている def（`def.type`・`def.checks`・`def.defaultValue`）と `.check()` だけを使う。
 */
export const rewrapWithOuter = (
  inner: z.ZodTypeAny,
  own: z.ZodTypeAny | undefined,
  outer: Outer | undefined,
): z.ZodTypeAny => {
  let schema = withChecks(inner, checksOf(own));
  const wraps = outer?.wraps ?? [];
  for (let index = wraps.length - 1; index >= 0; index -= 1) {
    const wrap = wraps[index]!;
    switch (wrap.type) {
      case "optional":
        schema = schema.optional();
        break;
      case "nullable":
        schema = schema.nullable();
        break;
      case "default":
        schema = schema.default(wrap.defaultValue as never) as z.ZodTypeAny;
        break;
      case "prefault":
        schema = schema.prefault(wrap.defaultValue as never) as z.ZodTypeAny;
        break;
      default:
        break;
    }
    schema = withChecks(schema, wrap.checks);
  }
  return schema;
};

const WRAPPER_TYPES = new Set(["optional", "nullable", "default", "prefault"]);

/**
 * 包みの部品（optional・nullable・default・prefault）が、内の Switch に渡す defaultValue（defaultValue の決まり）。
 *
 * - optional・nullable は、受け取った値に手を付けない（null で埋めない）
 * - default・prefault は、受け取った値が undefined なら `.default(x)` の x を入れる
 * - 一番内側の包み（中が包みでない）で、まだ undefined で、欄が nullable だけ（optional でない）なら null にする
 *
 * これで `.default("x").nullable()`・`.nullable().default("x")` のどちらも x になり、zod と同じになる。
 */
export const innerDefaultValue = (
  defaultValue: unknown,
  schema: z.ZodTypeAny,
  outer: Outer,
): unknown => {
  const def = (
    schema as unknown as {
      def: { type?: string; defaultValue?: unknown; innerType?: z.ZodTypeAny };
    }
  ).def;
  let value = defaultValue;
  if (
    value === undefined &&
    (def.type === "default" || def.type === "prefault")
  )
    value = def.defaultValue;
  if (
    value === undefined &&
    !WRAPPER_TYPES.has(typeOf(def.innerType as z.ZodTypeAny)) &&
    outer.nullable &&
    !outer.optional
  )
    value = null;
  return value;
};
