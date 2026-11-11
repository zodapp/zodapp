import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import {
  defineContext,
  tableConfig,
  type ChangeRecord,
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
import { appTable } from "./test/fixtures";
import { createTestTable, localClient } from "./test/local";

const docItem = z.object({
  folderId: z.string(),
  docId: z.string(),
  title: z.string(),
  deletedAt: z.date().optional(),
});

/** キーを生成するエンティティ */
const docs = tableConfig({
  table: appTable,
  entity: "Doc",
  item: docItem,
  create: z.object({ title: z.string() }),
  key: { partition: ["folderId"], sort: ["docId"] },
  generateKey: {
    args: z.object({ folderId: z.string() }),
    key: ({ folderId }, input) => ({
      folderId,
      docId: `${input.title}-${Math.random().toString(36).slice(2, 8)}`,
    }),
  },
});

const { createOps } = defineContext<undefined>();

const eventItem = z.object({
  id: z.string(),
  name: z.string(),
});

/** キーを生成しないエンティティ */
const events = tableConfig({
  table: appTable,
  entity: "Event",
  item: eventItem,
  create: z.object({ name: z.string() }),
  key: { partition: ["id"] },
});

const docQueries = createOps(docs, (o) => ({
  inFolder: o.query({
    params: z.object({ folderId: z.string() }),
    where: (p) => ({ partition: { folderId: p.folderId } }),
  }),
}));

const client = localClient();
let table: Awaited<ReturnType<typeof createTestTable>>;
let changes: ChangeRecord[] = [];

const repo = (invalidItems?: "throw" | "skip") =>
  createRepository({
    tables: { docs, events },
    dynamodb: client,
    tableNames: { app: table.name },
    invalidItems,
    listener: { onChanges: (c) => void changes.push(...c) },
  });

beforeAll(async () => {
  table = await createTestTable(client, appTable);
});
afterAll(async () => {
  await table.drop();
});
beforeEach(() => {
  changes = [];
});

describe("generateKey", () => {
  it("生成に必要な値を引数として受け取り、キーを生成して作成する", async () => {
    const r = repo();
    const doc = await r.docs.createWithGeneratedKey(
      { folderId: "f1" },
      { title: "memo" },
    );
    expect(doc.folderId).toBe("f1");
    expect(doc.docId).toMatch(/^memo-/);
    expect(await r.docs.get({ folderId: "f1", docId: doc.docId })).toEqual(doc);
    expectTypeOf(r.docs.createWithGeneratedKey)
      .parameter(0)
      .toEqualTypeOf<{ folderId: string }>();
  });

  it("generateKeyのないTable定義では使えない", async () => {
    const r = repo();
    await expect(
      r.events.createWithGeneratedKey(undefined as never, { name: "x" }),
    ).rejects.toThrow(/generateKey/);
  });
});

describe("削除", () => {
  it("常に物理削除する。存在しないItemは null を返す", async () => {
    const r = repo();
    await r.events.create({ id: "e1" }, { name: "x" });
    expect(await r.events.delete({ id: "e1" })).toEqual({
      id: "e1",
      name: "x",
    });
    expect(await r.events.get({ id: "e1" })).toBeNull();
    expect(changes.map((c) => [c.before, c.after])).toEqual([
      [null, { id: "e1", name: "x" }],
      [{ id: "e1", name: "x" }, null],
    ]);
    expect(await r.events.delete({ id: "e1" })).toBeNull();
  });

  it("runnerの中でも物理削除する", async () => {
    const r = repo();
    await r.events.create({ id: "e2" }, { name: "x" });
    await r.runTransaction(async (tx) => {
      await r.events.withContext({ runner: tx }).delete({ id: "e2" });
    });
    expect(await r.events.get({ id: "e2" })).toBeNull();
  });
});

describe("Schemaに合わない保存データ", () => {
  it("既定ではエラーにし、skipでは結果から除外する。getは常にエラー", async () => {
    await client.send(
      new PutItemCommand({
        TableName: table.name,
        Item: marshall({
          PK: "Doc#f9",
          SK: "Doc#bad",
          folderId: "f9",
          docId: "bad",
          title: 1,
        }),
      }),
    );
    const r = repo();
    await r.docs.create({ folderId: "f9", docId: "ok" }, { title: "ok" });
    await expect(
      r.docs.query(docQueries.inFolder, { folderId: "f9" }),
    ).rejects.toThrow();
    const skipped = await repo("skip").docs.query(docQueries.inFolder, {
      folderId: "f9",
    });
    expect(skipped.items.map((d) => d.docId)).toEqual(["ok"]);
    await expect(
      repo("skip").docs.get({ folderId: "f9", docId: "bad" }),
    ).rejects.toThrow();
  });
});
