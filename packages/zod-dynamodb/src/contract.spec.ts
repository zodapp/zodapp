import { describe, expect, it } from "vitest";
import { z } from "zod";
import { tasks } from "./__fixtures__/tasks";
import { DefinitionError } from "./errors";
import { physicalTable } from "./physical";
import { tableConfig, withVectorRuntime } from "./table";
import { defineContext } from "./register";

const { createOps } = defineContext<any>();

const vecLayout = physicalTable({
  name: "vec",
  primary: { pk: "PK", sk: "SK" },
  vectorIndexes: {
    VEC1: {
      vector: "V1",
      hash: "VH1",
      filters: ["VF1_01"],
      dimensions: 2,
      distance: "COSINE",
      projection: "KEYS_ONLY",
    },
  },
});

const rowItem = z.object({
  sourceId: z.string(),
  rowId: z.string(),
  embedding: z.array(z.number()),
});

const rows = tableConfig({
  table: vecLayout,
  entity: "Row",
  item: rowItem,
  create: rowItem.omit({ sourceId: true, rowId: true }),
  key: { partition: ["sourceId"], sort: ["rowId"] },
  vectors: { content: { field: "embedding", partition: ["sourceId"] } },
});

describe("withVectorRuntime（createRepository の vectors）", () => {
  it("ベクトルの実行時のスロットと絞り込みを付ける", () => {
    const impl = withVectorRuntime(rows, {
      content: { slot: () => "VEC1", filters: () => ({ VF1_01: "x" }) },
    });
    expect(impl._compiled.vectors.get("content")!.dynamic).toBe(true);
    expect(impl.entity).toBe(rows.entity);
  });

  it("スロットを持たないベクトルは、実行時の設定でスロットを与える必要がある", () => {
    expect(() => withVectorRuntime(rows, {})).toThrow(DefinitionError);
  });

  it("Table 定義にないベクトルの設定はエラー", () => {
    expect(() =>
      withVectorRuntime(rows, {
        content: { slot: () => "VEC1" },
        other: { slot: () => "VEC1" },
      }),
    ).toThrow(/other/);
  });
});

describe("o.search", () => {
  it("Table 定義にないベクトルと、100 を超える topK はエラー", () => {
    const base = {
      params: z.object({}),
      partition: () => ({ sourceId: "s" }),
    };
    expect(() =>
      createOps(rows, (o) => ({
        x: o.search({ ...base, vector: "nope" as never, topK: 1 }),
      })),
    ).toThrow(/unknown vector/);
    expect(() =>
      createOps(rows, (o) => ({
        x: o.search({ ...base, vector: "content", topK: 101 }),
      })),
    ).toThrow(/topK/);
  });
});

describe("フック", () => {
  it("フックは tableConfig に書く", () => {
    expect(typeof tasks.onCreate).toBe("function");
  });
});
