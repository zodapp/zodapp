import { describe, expect, it } from "vitest";
import { z } from "zod";
import { pruneValueToSchema } from "./prune";

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
