import {
  GetItemCommand,
  SearchVectorsCommand,
  type DynamoDBClient,
  type SearchVectorsCommandInput,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  buildFilters,
  DefinitionError,
  defineContext,
  physicalTable,
  type Override,
  tableConfig,
  ValidationError,
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
import { createRepository } from "./repository";
import { createTestTable, localClient } from "./test/local";

// DynamoDB Local は SearchVectors に対応していないため、そのリクエストだけを差し替え、
// それ以外（書き込みと BatchGetItem）は DynamoDB Local に送る。
const local = localClient();
let searchRequests: SearchVectorsCommandInput[] = [];
let searchResponse: { keys: { PK: string; SK: string }[] } = { keys: [] };
const client = {
  send: (command: unknown) => {
    if (command instanceof SearchVectorsCommand) {
      searchRequests.push(command.input);
      return Promise.resolve({
        SearchResults: searchResponse.keys.map((k, i) => ({
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
      filters: ["VF1_01", "VF1_02"],
      dimensions: 3,
      distance: "COSINE",
      projection: "KEYS_ONLY",
    },
    VEC2: {
      vector: "V2",
      hash: "VH2",
      filters: ["VF2_01"],
      dimensions: 2,
      distance: "COSINE",
      projection: "KEYS_ONLY",
    },
  },
});

const productItem = z.object({
  shopId: z.string(),
  productId: z.string(),
  status: z.enum(["active", "archived"]),
  category: z.string(),
  brand: z.string().optional(),
  embedding: z.array(z.number()).optional(),
});

const products = tableConfig({
  table: layout,
  entity: "Product",
  item: productItem,
  create: productItem.omit({ shopId: true, productId: true }),
  key: { partition: ["shopId"], sort: ["productId"] },
  vectors: {
    content: {
      field: "embedding",
      slot: "VEC1",
      partition: ["shopId"],
      filters: { VF1_01: ["status"], VF1_02: ["category", "brand"] },
    },
  },
});

const rowItem = z.object({
  sourceId: z.string(),
  version: z.string(),
  rowId: z.string(),
  attributes: z.record(z.string(), z.string()),
  embedding: z.array(z.number()),
});

const rows = tableConfig({
  table: layout,
  entity: "Row",
  item: rowItem,
  create: rowItem.omit({ sourceId: true, version: true, rowId: true }),
  key: { partition: ["sourceId", "version"], sort: ["rowId"] },
  vectors: {
    content: { field: "embedding", partition: ["sourceId", "version"] },
  },
});

const { createOps, override } = defineContext<undefined>();

const productSearches = createOps(products, (o) => ({
  similar: o.search({
    vector: "content",
    params: z.object({
      shopId: z.string(),
      status: z.enum(["active", "archived"]).optional(),
    }),
    topK: 10,
    partition: (p) => ({ shopId: p.shopId }),
    filters: (p) => (p.status ? { VF1_01: { status: p.status } } : {}),
  }),
}));

const rowSearches = createOps(rows, (o) => ({
  similar: o.search({
    vector: "content",
    params: z.object({
      sourceId: z.string(),
      version: z.string(),
      filterValues: z.record(z.string(), z.string()).optional(),
    }),
    topK: 5,
    select: "projection",
    partition: (p) => ({ sourceId: p.sourceId, version: p.version }),
    filters: (p, _ctx, { vectorConfig }) =>
      buildFilters(vectorConfig?.filters, p.filterValues ?? {}),
  }),
}));

let table: Awaited<ReturnType<typeof createTestTable>>;
let resolved = 0;
const config: VectorRuntimeConfig = {
  slot: "VEC2",
  filters: { VF2_01: ["model", "color"] },
};

const repo = (extra: readonly Override[] = []) =>
  createRepository({
    tables: { products, rows },
    vectors: {
      rows: {
        content: {
          slot: (_row, { vectorConfig }) => vectorConfig.slot,
          filters: (row, { vectorConfig }) =>
            buildFilters(vectorConfig.filters, row.attributes),
        },
      },
    },
    overrides: [
      override(productSearches.similar, { queryVector: () => [1, 0, 0] }),
      override(rowSearches.similar, { queryVector: () => [0.5, 0.5] }),
      ...extra,
    ],
    dynamodb: client,
    tableNames: { vec: table.name },
    resolveVectorConfig: () => {
      resolved++;
      return config;
    },
  });

const raw = async (pk: string, sk: string) => {
  const res = await local.send(
    new GetItemCommand({
      TableName: table.name,
      Key: marshall({ PK: pk, SK: sk }),
    }),
  );
  return res.Item ? unmarshall(res.Item) : undefined;
};

beforeAll(async () => {
  table = await createTestTable(local, layout);
});
afterAll(async () => {
  await table.drop();
});
beforeEach(() => {
  searchRequests = [];
  resolved = 0;
});

describe("ベクトルの書き込み", () => {
  it("embeddingをスロットの属性に書き、HASHとフィルターを組み立てる。読み取りでは元に戻す", async () => {
    const r = repo();
    const created = await r.products.create(
      { shopId: "s 1", productId: "p1" },
      {
        status: "active",
        category: "家電",
        brand: "ACME",
        embedding: [1, 2, 3],
      },
    );
    const stored = (await raw("Product#s$P1", "Product#p1"))!;
    expect(stored).toMatchObject({
      V1: [1, 2, 3],
      VH1: "Product#s$P1",
      VF1_01: "active",
      VF1_02: "家電#ACME",
    });
    expect(stored).not.toHaveProperty("embedding");
    expect(await r.products.get({ shopId: "s 1", productId: "p1" })).toEqual(
      created,
    );
  });

  it("フィールドが欠けるフィルターは書かない", async () => {
    const r = repo();
    await r.products.create(
      { shopId: "s1", productId: "p2" },
      { status: "active", category: "c", embedding: [1, 2, 3] },
    );
    const stored = (await raw("Product#s1", "Product#p2"))!;
    expect(stored.VF1_01).toBe("active");
    expect(stored).not.toHaveProperty("VF1_02");
  });

  it("次元数がスロットと合わないembeddingは拒否する", async () => {
    const r = repo();
    await expect(
      r.products.create(
        { shopId: "s1", productId: "bad" },
        { status: "active", category: "c", embedding: [1, 2] },
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("フィルターのフィールドを更新すると属性を付け直し、embeddingを消すと属性を外す", async () => {
    const r = repo();
    const key = { shopId: "s1", productId: "p3" };
    await r.products.create(key, {
      status: "active",
      category: "c",
      embedding: [1, 2, 3],
    });
    await r.products.update(key, { status: "archived" });
    expect((await raw("Product#s1", "Product#p3"))!.VF1_01).toBe("archived");
    await r.products.update(key, { embedding: undefined });
    const stored = (await raw("Product#s1", "Product#p3"))!;
    expect(stored).not.toHaveProperty("V1");
    expect(await r.products.get(key)).not.toHaveProperty("embedding");
  });

  it("動的な設定：スロットとフィルターを実行時の設定で選び、設定はHASHごとにキャッシュする", async () => {
    const r = repo();
    for (const id of ["r1", "r2"]) {
      await r.rows.create(
        { sourceId: "src", version: "v1", rowId: id },
        { attributes: { model: "A100", color: "red" }, embedding: [0.1, 0.2] },
      );
    }
    expect(resolved).toBe(1);
    const stored = (await raw("Row#src#v1", "Row#r1"))!;
    expect(stored).toMatchObject({
      V2: [0.1, 0.2],
      VH2: "Row#src#v1",
      VF2_01: "A100#red",
    });
    expect(stored).not.toHaveProperty("V1");
    expect(
      (await r.rows.get({ sourceId: "src", version: "v1", rowId: "r1" }))!
        .embedding,
    ).toEqual([0.1, 0.2]);
  });
});

describe("名前付きの検索", () => {
  it("HASHとフィルターの条件を組み立て、KEYS_ONLYでは本体を取得して返す", async () => {
    const r = repo();
    await r.products.create(
      { shopId: "s2", productId: "a" },
      { status: "active", category: "c", embedding: [1, 0, 0] },
    );
    await r.products.create(
      { shopId: "s2", productId: "b" },
      { status: "active", category: "c", embedding: [0, 1, 0] },
    );
    searchResponse = {
      keys: [
        { PK: "Product#s2", SK: "Product#b" },
        { PK: "Product#s2", SK: "Product#a" },
        { PK: "Product#s2", SK: "Product#deleted" },
      ],
    };
    const results = await r.products.search(productSearches.similar, {
      shopId: "s2",
      status: "active",
    });
    expect(searchRequests[0]).toMatchObject({
      TableName: table.name,
      IndexName: "VEC1",
      TopK: 10,
      SearchConditionExpression: "#n0 = :v0 AND #n1 = :v1",
      ExpressionAttributeNames: { "#n0": "VH1", "#n1": "VF1_01" },
      ExpressionAttributeValues: {
        ":v0": { S: "Product#s2" },
        ":v1": { S: "active" },
      },
    });
    expect(results.map((x) => [x.item.productId, x.score])).toEqual([
      ["b", 1],
      ["a", 0.9],
    ]);
    expectTypeOf(results[0]!.item.category).toEqualTypeOf<string>();
  });

  it("書き込み時と検索時で動的なフィルターの値が一致する", async () => {
    const r = repo();
    searchResponse = { keys: [{ PK: "Row#src#v1", SK: "Row#r1" }] };
    const results = await r.rows.search(rowSearches.similar, {
      sourceId: "src",
      version: "v1",
      filterValues: { model: "A100", color: "red" },
    });
    const stored = (await raw("Row#src#v1", "Row#r1"))!;
    expect(searchRequests[0]!.IndexName).toBe("VEC2");
    expect(searchRequests[0]!.ExpressionAttributeValues![":v1"]).toEqual({
      S: stored.VF2_01,
    });
    expect(results[0]!.item).toEqual({
      sourceId: "src",
      version: "v1",
      rowId: "r1",
    });
  });

  it("queryVector の上書きを登録していない検索はエラー", async () => {
    const r = createRepository({
      tables: { products },
      dynamodb: client,
      tableNames: { vec: table.name },
    });
    await expect(
      r.products.search(productSearches.similar, { shopId: "s1" }),
    ).rejects.toThrow(DefinitionError);
  });

  it("検索用のベクトルの次元数を検証する", async () => {
    const bad = createOps(products, (o) => ({
      x: o.search({
        vector: "content",
        params: z.object({}),
        topK: 1,
        partition: () => ({ shopId: "s" }),
      }),
    }));
    const badOverride = override(bad.x, { queryVector: () => [1] });
    await expect(
      repo([badOverride]).products.search(bad.x, {}),
    ).rejects.toThrow(/dimensions/);
  });

  it("topKは100以下", () => {
    expect(() =>
      createOps(products, (o) => ({
        x: o.search({
          vector: "content",
          params: z.object({}),
          topK: 101,
          partition: () => ({ shopId: "s" }),
        }),
      })),
    ).toThrow(/topK/);
  });
});
