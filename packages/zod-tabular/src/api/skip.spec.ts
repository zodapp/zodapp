import { describe, expect, it } from "vitest";
import { z } from "zod";
import { fromTable } from "./fromTable.js";
import { toTable } from "./toTable.js";

const opaque = z.unknown().meta({ id: "opaque-for-skip-spec" });
const schema = z.object({
  name: z.string(),
  extra: opaque.optional(),
});
const skip = (s: z.ZodType) =>
  s === opaque || (s instanceof z.ZodOptional && s.unwrap() === opaque);

describe("skip", () => {
  it("toTable：skip した欄は書き出さない", () => {
    const table = toTable(schema, [{ name: "a", extra: { x: 1 } }], { skip });
    expect(table[0]).toEqual(["name"]);
    expect(table[1]).toEqual(["a"]);
  });

  it("skip しなければ書き出す（今までの動き）", () => {
    const table = toTable(schema, [{ name: "a", extra: "v" }]);
    expect(table[0]).toContain("extra");
  });

  it("fromTable：skip した欄は読まない", () => {
    const rows = fromTable(
      schema,
      [
        ["name", "extra"],
        ["a", "v"],
      ],
      { skip },
    );
    expect(rows).toEqual([{ name: "a" }]);
  });
});
