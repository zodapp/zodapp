import {
  SearchVectorsCommand,
  type DynamoDBClient,
  type SearchVectorsCommandInput,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import {
  buildFilters,
  defineContext,
  defineEndpoints,
  physicalTable,
  tableConfig,
  type VectorRuntimeConfig,
} from "@zodapp/zod-dynamodb";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
} from "vitest";
import { z } from "zod";
import { ForbiddenError } from "./errors";
import { createRepository } from "./repository";
import { createServerApi } from "./server-api";
import { createTestTable, localClient } from "./test/local";

// DynamoDB Local は SearchVectors に対応していないため、そのリクエストだけを差し替える
const local = localClient();
let searchRequests: SearchVectorsCommandInput[] = [];
let searchKeys: { PK: string; SK: string }[] = [];
const client = {
  send: (command: unknown) => {
    if (command instanceof SearchVectorsCommand) {
      searchRequests.push(command.input);
      return Promise.resolve({
        SearchResults: searchKeys.map((k, i) => ({
          Item: marshall(k),
          Score: 1 - i / 10,
        })),
      });
    }
    return local.send(command as never);
  },
} as unknown as DynamoDBClient;

const layout = physicalTable({
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
  projectId: z.string(),
  versionId: z.string(),
  rowId: z.string(),
  category: z.string(),
  attributes: z.record(z.string(), z.string()),
  embedding: z.array(z.number()),
});

// ---- 共有 ----

const rows = tableConfig({
  table: layout,
  entity: "SRow",
  item: rowItem,
  create: rowItem.omit({ projectId: true, versionId: true, rowId: true }),
  key: { partition: ["projectId", "versionId"], sort: ["rowId"] },
  // スロットの静的な割り当て。スロットとフィルターは実行時の設定で選ぶ
  vectors: {
    content: { field: "embedding", partition: ["projectId", "versionId"] },
  },
});

type Auth = { projects: string[] };
const { createOps, override } = defineContext<Auth>();

const rowOps = createOps(rows, (o) => ({
  similar: o.search({
    vector: "content",
    params: z.object({
      projectId: z.string(),
      versionId: z.string(),
      text: z.string(),
      filterValues: z.record(z.string(), z.string()).optional(),
    }),
    topK: 5,
    authorize: (ctx, { params }) => ctx.projects.includes(params.projectId),
    partition: (p) => ({ projectId: p.projectId, versionId: p.versionId }),
    filters: (p, _ctx, { vectorConfig }) =>
      buildFilters(vectorConfig?.filters, p.filterValues ?? {}),
  }),
}));

const endpoints = defineEndpoints({
  rows: [{ op: rowOps.similar, path: "/rows/similar" }],
});

// ---- サーバー ----

const config: VectorRuntimeConfig = {
  slot: "VEC1",
  filters: { VF1_01: ["model", "color"] },
};
const embedded: string[] = [];
let table: Awaited<ReturnType<typeof createTestTable>>;

const repo = (withOverride = true) =>
  createRepository({
    tables: { rows },
    dynamodb: client,
    tableNames: { vec: table.name },
    vectors: {
      rows: {
        content: {
          slot: (_row, { vectorConfig }) => vectorConfig.slot,
          filters: (row, { vectorConfig }) =>
            buildFilters(vectorConfig.filters, row.attributes),
        },
      },
    },
    resolveVectorConfig: () => config,
    overrides: withOverride
      ? [
          override(rowOps.similar, {
            queryVector: (p) => {
              embedded.push(p.text);
              return [0.5, 0.5];
            },
          }),
        ]
      : [],
  });

beforeAll(async () => {
  table = await createTestTable(local, layout);
});
afterAll(async () => {
  await table.drop();
});
beforeEach(() => {
  searchRequests = [];
  embedded.length = 0;
});

describe("o.search", () => {
  it("書き込みと検索で、実行時の設定から同じフィルターを組み立てる", async () => {
    const r = repo();
    const api = createServerApi(endpoints, { repository: r });
    const key = { projectId: "p1", versionId: "v1", rowId: "r1" };
    await r.rows.create(key, {
      category: "boots",
      attributes: { model: "A100", color: "red" },
      embedding: [1, 0],
    });
    searchKeys = [{ PK: "SRow#p1#v1", SK: "SRow#r1" }];
    const results = await api.rows.similar(
      {
        projectId: "p1",
        versionId: "v1",
        text: "防水 ブーツ",
        filterValues: { model: "A100", color: "red" },
      },
      { context: { projects: ["p1"] }, fields: { pick: ["category"] } },
    );
    expect(embedded).toEqual(["防水 ブーツ"]);
    expect(searchRequests[0]).toMatchObject({
      IndexName: "VEC1",
      TopK: 5,
      ExpressionAttributeNames: { "#n0": "VH1", "#n1": "VF1_01" },
    });
    expect(results).toEqual([
      { item: { ...key, category: "boots" }, score: 1 },
    ]);
    expectTypeOf(results[0]!.score).toEqualTypeOf<number>();
  });

  it("authorize で拒否する", async () => {
    const api = createServerApi(endpoints, { repository: repo() });
    await expect(
      api.rows.similar(
        { projectId: "p1", versionId: "v1", text: "x" },
        { context: { projects: [] } },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(searchRequests).toHaveLength(0);
  });

  it("queryVector の上書きがないまま呼ぶとエラー", async () => {
    const api = createServerApi(endpoints, { repository: repo(false) });
    await expect(
      api.rows.similar(
        { projectId: "p1", versionId: "v1", text: "x" },
        { context: { projects: ["p1"] } },
      ),
    ).rejects.toThrow(/queryVector/);
  });

  it("登録簿は検索の HTTP の入出力の変換を作る", () => {
    expect(endpoints.entryOf(rowOps.similar)?.endpoint?.kind).toBe("search");
  });
});
