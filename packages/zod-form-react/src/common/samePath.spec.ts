import { describe, expect, it } from "vitest";
import { z } from "zod";
import { emptinessOf, peelSamePath, rewrapWithChain } from "./samePath";

const messages = (schema: z.ZodTypeAny, value: unknown) =>
  schema.safeParse(value).error?.issues.map((issue) => issue.message) ?? [];

describe("emptinessOf", () => {
  it("optional・default・prefault の中なら optional、nullable の中なら nullable", () => {
    const inner = z.string();
    expect(emptinessOf([inner.optional(), inner])).toEqual({
      optional: true,
      nullable: false,
    });
    expect(emptinessOf([inner.default("x"), inner])).toEqual({
      optional: true,
      nullable: false,
    });
    expect(emptinessOf([inner.nullable(), inner])).toEqual({
      optional: false,
      nullable: true,
    });
    expect(
      emptinessOf([inner.nullable().optional(), inner.nullable(), inner]),
    ).toEqual({
      optional: true,
      nullable: true,
    });
    expect(emptinessOf([inner])).toEqual({ optional: false, nullable: false });
  });
});

describe("rewrapWithChain", () => {
  const resolved = z.enum(["a", "b", "bad"]);

  it("土台に付いた refine を付け直す（土台の型は付け直さない）", () => {
    const base = z.never().refine(() => true);
    const node = z.string().refine((v) => v !== "bad", "R");
    expect(messages(rewrapWithChain(resolved, [node]), "bad")).toEqual(["R"]);
    expect(messages(rewrapWithChain(resolved, [node]), "a")).toEqual([]);
    expect(messages(rewrapWithChain(resolved, [base]), "a")).toEqual([]);
  });

  it("optional・nullable・default で包み直す", () => {
    const node = z.string();
    expect(
      rewrapWithChain(resolved, [node.optional(), node]).safeParse(undefined)
        .success,
    ).toBe(true);
    expect(
      rewrapWithChain(resolved, [node.nullable(), node]).safeParse(null)
        .success,
    ).toBe(true);
    const withDefault = rewrapWithChain(resolved, [node.default("a"), node]);
    expect(withDefault.parse(undefined)).toBe("a");
    expect(rewrapWithChain(resolved, [node]).safeParse(undefined).success).toBe(
      false,
    );
  });

  it("包みに付いた refine は、包んだあとにかかる", () => {
    const node = z.string();
    const wrapper = node.optional().refine((v) => v !== undefined, "要る");
    expect(
      messages(rewrapWithChain(resolved, [wrapper, node]), undefined),
    ).toEqual(["要る"]);
  });

  it("入れ子の dynamic は、内と外の土台の refine を両方かける", () => {
    const outer = z.string().refine((v) => v !== "a", "外");
    const inner = z.string().refine((v) => v !== "b", "内");
    const wrapped = rewrapWithChain(resolved, [outer, inner]);
    expect(messages(wrapped, "a")).toEqual(["外"]);
    expect(messages(wrapped, "b")).toEqual(["内"]);
  });
});

describe("peelSamePath（案D）", () => {
  const noMeta = () => false;

  it("optional・nullable・default・lazy を剥がし、中身と包みを返す", () => {
    const inner = z.string();
    const schema = z.lazy(() => inner.nullable().default(null)).optional();
    const peeled = peelSamePath(schema, noMeta);
    expect(peeled.inner).toBe(inner);
    expect(peeled.wrappers.map((s) => s.def.type)).toEqual([
      "optional",
      "lazy",
      "default",
      "nullable",
    ]);
    expect(peeled.schemas[peeled.schemas.length - 1]).toBe(inner);
    expect(peeled.nullDefault).toBe(true);
    expect(emptinessOf(peeled.schemas)).toEqual({
      optional: true,
      nullable: true,
    });
  });

  it("同じ schema ならキャッシュを返す", () => {
    const schema = z.string().optional();
    expect(peelSamePath(schema, noMeta)).toBe(peelSamePath(schema, noMeta));
  });

  it("包みに meta があれば、そこで止める", () => {
    const wrapped = z.string().optional();
    const schema = wrapped.nullable();
    const peeled = peelSamePath(schema, (s) => s === wrapped);
    expect(peeled.inner).toBe(wrapped);
    expect(peeled.wrappers).toEqual([schema]);
  });

  it("包みでなければ何もしない", () => {
    const schema = z.object({ a: z.string() });
    const peeled = peelSamePath(schema, noMeta);
    expect(peeled.inner).toBe(schema);
    expect(peeled.wrappers).toEqual([]);
  });
});
