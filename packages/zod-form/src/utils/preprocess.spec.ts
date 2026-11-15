import { describe, expect, it } from "vitest";
import { z } from "zod";
import { getMeta, zf } from "../def";
import { normalizePreprocessValue, stripPreprocess } from "./preprocess";

const fillType = (value: unknown) =>
  value && typeof value === "object" && !("type" in value)
    ? { type: "a", ...value }
    : value;

const union = z.discriminatedUnion("type", [
  z.object({ type: z.literal("a"), x: z.string() }),
  z.object({ type: z.literal("b"), y: z.string() }),
]);

describe("stripPreprocess", () => {
  it("preprocess を外し、preprocess に付けた meta を中に移す", () => {
    const schema = z.preprocess(fillType, union);
    (schema as unknown as typeof union).register(zf.union.registry, {
      label: "通知先",
      selectorLabel: "種類",
    });
    const stripped = stripPreprocess(schema);
    expect(stripped).toBeInstanceOf(z.ZodDiscriminatedUnion);
    expect(getMeta(stripped, "union")).toMatchObject({
      typeName: "union",
      label: "通知先",
      selectorLabel: "種類",
    });
    // 元の schema の meta は変えない
    expect(getMeta(union)).toBeUndefined();
  });

  it("optional を挟んだ入れ子の preprocess も外し、外側の meta を優先する", () => {
    const obj = z
      .object({ x: z.string() })
      .register(zf.object.registry, { label: "中", uiType: "inner" });
    const inner = z.preprocess(fillType, obj);
    (inner as unknown as typeof obj).register(zf.object.registry, {
      label: "内側",
    });
    const outer = z.preprocess((v) => v, inner.optional());
    (outer as unknown as typeof obj).register(zf.object.registry, {
      label: "外側",
    });
    const stripped = stripPreprocess(outer);
    expect(stripped).toBeInstanceOf(z.ZodOptional);
    const unwrapped = (stripped as z.ZodOptional<z.ZodTypeAny>).unwrap();
    expect(unwrapped).toBeInstanceOf(z.ZodObject);
    expect(getMeta(unwrapped, "object")).toMatchObject({
      label: "外側",
      uiType: "inner",
    });
  });

  it("中の schema に meta があれば、型は中のものを使う（zf.dynamic を object で上書きしない）", () => {
    const inner = z.object({ x: z.string() }).register(zf.dynamic.registry, {
      label: "中",
      resolve: () => undefined,
    });
    const schema = z.preprocess(fillType, inner);
    (schema as unknown as typeof inner).register(zf.object.registry, {
      label: "外",
    });
    const meta = getMeta(stripPreprocess(schema), "dynamic");
    expect(meta?.typeName).toBe("dynamic");
    expect(meta?.label).toBe("外");
    expect(typeof meta?.resolve).toBe("function");
  });

  it("preprocess が無ければ同じ schema を返す", () => {
    const schema = z.object({ x: z.string() }).optional();
    expect(stripPreprocess(schema)).toBe(schema);
  });
});

describe("normalizePreprocessValue", () => {
  it("preprocess を順に当てる", () => {
    const schema = z.preprocess(fillType, union);
    expect(normalizePreprocessValue(schema, { x: "1" })).toEqual({
      type: "a",
      x: "1",
    });
  });

  it("optional で undefined なら中を当てない", () => {
    const schema = z.preprocess(fillType, union).optional();
    expect(normalizePreprocessValue(schema, undefined)).toBeUndefined();
  });
});
