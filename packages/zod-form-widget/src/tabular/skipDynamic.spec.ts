import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zf, defineDynamicMeta } from "@zodapp/zod-form";
import { fromTable, toTable } from "@zodapp/zod-tabular";
import { tabularOptions } from "./skipDynamic";

const detail = zf
  .dynamic()
  .register(
    zf.dynamic.registry,
    defineDynamicMeta({ resolve: () => undefined }),
  );
const schema = z.object({ name: z.string(), detail, maybe: detail.optional() });

describe("CSV で zf.dynamic の欄を飛ばす", () => {
  it("書き出さない（object の値が [object Object] にならない）", () => {
    const table = toTable(
      schema,
      [{ name: "a", detail: { x: 1 }, maybe: "v" }],
      tabularOptions,
    );
    expect(table).toEqual([["name"], ["a"]]);
  });

  it("読み込まない", () => {
    const rows = fromTable(
      schema,
      [
        ["name", "detail", "maybe"],
        ["a", "x", "y"],
      ],
      tabularOptions,
    );
    expect(rows).toEqual([{ name: "a" }]);
  });
});
