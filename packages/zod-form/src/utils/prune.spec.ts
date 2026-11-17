import { describe, expect, it } from "vitest";
import { z } from "zod";
import { adaptValueToSchema, pruneValueToSchema } from "./prune";

describe("pruneValueToSchema", () => {
  it("schema に無いキーと、型の合わない値を消す。制約違反は残す", () => {
    const schema = z.object({
      name: z.string().min(5),
      count: z.number().optional(),
      level: z.enum(["low", "high"]).optional(),
    });
    expect(
      pruneValueToSchema(
        { name: "ab", count: "3", level: 3, stale: true },
        schema,
      ),
    ).toEqual({ name: "ab" });
  });

  it("選択肢から外れただけの enum の値は残す（どうするかは enum の部品が unlisted で決める）", () => {
    const schema = z.object({ level: z.enum(["low", "high"]) });
    expect(pruneValueToSchema({ level: "mid" }, schema)).toEqual({
      level: "mid",
    });
  });

  it("入れ子の object も削る", () => {
    const schema = z.object({ inner: z.object({ a: z.string() }) });
    expect(pruneValueToSchema({ inner: { a: "x", b: 1 } }, schema)).toEqual({
      inner: { a: "x" },
    });
  });

  it("default の既定値は入れない", () => {
    const schema = z.object({ a: z.string().default("x") });
    expect(pruneValueToSchema({}, schema)).toEqual({});
  });
});

describe("adaptValueToSchema", () => {
  it("合わない値を消してから、配列の要素の中も既定値で補う", () => {
    const schema = z.object({
      items: z.array(
        z.object({ name: z.string(), qty: z.number().default(1) }),
      ),
    });
    expect(
      adaptValueToSchema({ items: [{ name: "a", stale: true }] }, schema),
    ).toStrictEqual({ items: [{ name: "a", qty: 1 }] });
  });

  it("値が無ければ既定値そのものになる", () => {
    const schema = z.object({ a: z.string().default("x") });
    expect(adaptValueToSchema(undefined, schema)).toStrictEqual({ a: "x" });
  });
});

describe("pruneValueToSchema（intersection）", () => {
  const base = z.object({ name: z.string() });
  const extra = z.object({ memo: z.string() });
  const arms = z.discriminatedUnion("type", [
    z.object({ type: z.literal("a"), a: z.string() }),
    z.object({ type: z.literal("b"), b: z.number() }),
  ]);

  it("両側の object の欄を残し、どちらにも無いキーだけを消す", () => {
    expect(
      pruneValueToSchema({ name: "n", memo: "q", junk: 1 }, base.and(extra)),
    ).toEqual({ name: "n", memo: "q" });
  });

  it("片側で型の合わない値は消す", () => {
    expect(pruneValueToSchema({ name: 1, memo: "q" }, base.and(extra))).toEqual(
      { memo: "q" },
    );
  });

  it("object と discriminatedUnion では、共通の欄と選ばれた腕の欄を残す", () => {
    expect(
      pruneValueToSchema(
        { name: "n", type: "b", b: 1, a: "stale" },
        base.and(arms),
      ),
    ).toEqual({ name: "n", type: "b", b: 1 });
  });

  it("adaptValueToSchema も、両側の欄を残して補う", () => {
    const withDefault = z.object({ memo: z.string().default("m") });
    expect(
      adaptValueToSchema({ name: "n", junk: 1 }, base.and(withDefault)),
    ).toEqual({ name: "n", memo: "m" });
  });
});
