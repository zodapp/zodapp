import { GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type { ChangeRecord } from "@zodapp/zod-dynamodb";
import {
  classifyChange,
  DefinitionError,
  defineContext,
  tableConfig,
  ValidationError,
} from "@zodapp/zod-dynamodb";
import { z } from "zod";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
} from "vitest";
import {
  ConditionFailedError,
  InvalidCursorError,
  ItemAlreadyExistsError,
  InvalidTokenError,
  ItemNotFoundError,
  StaleItemError,
  TransactionError,
  WriteNotAppliedError,
} from "./errors";
import { createRepository } from "./repository";
import {
  appTable,
  noteDef,
  notes,
  taskMutations,
  taskQueries,
  tasks,
} from "./test/fixtures";
import { createTestTable, localClient } from "./test/local";

const client = localClient();
let table: Awaited<ReturnType<typeof createTestTable>>;
let changes: ChangeRecord[] = [];

const repo = () =>
  createRepository({
    tables: { tasks, notes },
    dynamodb: client,
    tableNames: { app: table.name },
    cursorSecret: "secret",
    listener: { onChanges: (c) => void changes.push(...c) },
  });

const raw = async (pk: string, sk: string) => {
  const res = await client.send(
    new GetItemCommand({
      TableName: table.name,
      Key: marshall({ PK: pk, SK: sk }),
    }),
  );
  return res.Item ? unmarshall(res.Item) : undefined;
};

const todo = (title: string, extra: Record<string, unknown> = {}) => ({
  kind: "todo" as const,
  title,
  status: "todo" as const,
  assignee: null,
  priority: 3,
  ...extra,
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

let seq = 0;
const ws = () => `ws ${++seq}`;

describe("CRUD", () => {
  it("作成と取得。物理キーとライブラリ管理属性は現れない", async () => {
    const r = repo();
    const w = ws();
    const created = await r.tasks.create(
      { workspaceId: w, taskId: "t1" },
      todo("設計"),
    );
    expect(created).toMatchObject({
      workspaceId: w,
      taskId: "t1",
      kind: "todo",
      title: "設計",
    });
    expect(created.createdAt).toBeInstanceOf(Date);
    const got = await r.tasks.get({ workspaceId: w, taskId: "t1" });
    expect(got).toEqual(created);
    expect(Object.keys(got!)).not.toContain("PK");
    expect(Object.keys(got!)).not.toContain("_version");

    const stored = await raw(`Task#ws$P${seq}`, "Task#t1");
    expect(stored).toMatchObject({
      PK1: `Task#ws$P${seq}#todo`,
      PK2: `Task#ws$P${seq}#$%`,
      _version: 1,
    });
    expect(stored!.SK1).toMatch(/^Task#\$\*c008000000000000#\$\+2\d{3}-/);
    expect(stored!.PK3).toBeUndefined(); // dueDate がないvariant
  });

  it("作成済みのItemは作成できない。存在しないItemはnull", async () => {
    const r = repo();
    const w = ws();
    await r.tasks.create({ workspaceId: w, taskId: "t1" }, todo("a"));
    await expect(
      r.tasks.create({ workspaceId: w, taskId: "t1" }, todo("a")),
    ).rejects.toThrow(ItemAlreadyExistsError);
    expect(await r.tasks.get({ workspaceId: w, taskId: "nope" })).toBeNull();
  });

  it("作成の入力が不正なら拒否する", async () => {
    const r = repo();
    await expect(
      r.tasks.create(
        { workspaceId: ws(), taskId: "t1" },
        todo("a", { priority: 10 }),
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("削除はBeforeを返し、whereが成り立たなければ拒否する", async () => {
    const r = repo();
    const w = ws();
    await r.tasks.create({ workspaceId: w, taskId: "t1" }, todo("a"));
    await expect(
      r.tasks.delete(
        { workspaceId: w, taskId: "t1" },
        { where: { status: "done" } },
      ),
    ).rejects.toThrow(ConditionFailedError);
    await expect(
      r.tasks.delete(
        { workspaceId: w, taskId: "zz" },
        { where: { status: "done" } },
      ),
    ).rejects.toThrow(ItemNotFoundError);
    const before = await r.tasks.delete({ workspaceId: w, taskId: "t1" });
    expect(before?.title).toBe("a");
    expect(await r.tasks.get({ workspaceId: w, taskId: "t1" })).toBeNull();
    expect(changes.at(-1)).toMatchObject({ after: null, version: 2 });
  });

  it("読み取るフィールドを指定できる。キーは常に返す", async () => {
    const r = repo();
    const w = ws();
    await r.tasks.create({ workspaceId: w, taskId: "t1" }, todo("a"));
    const picked = await r.tasks.get(
      { workspaceId: w, taskId: "t1" },
      { fields: { pick: ["title"] } },
    );
    expect(picked).toEqual({ workspaceId: w, taskId: "t1", title: "a" });
    expectTypeOf(picked!).toEqualTypeOf<{
      workspaceId: string;
      taskId: string;
      title: string;
    }>();
    const omitted = await r.tasks.get(
      { workspaceId: w, taskId: "t1" },
      { fields: { omit: ["createdAt", "updatedAt", "workspaceId"] } },
    );
    expect(omitted).toMatchObject({ workspaceId: w, title: "a" });
    expect(omitted).not.toHaveProperty("createdAt");
  });

  it("同じエンティティのTable定義を2つ渡すとエラーにする", () => {
    expect(() =>
      createRepository({
        tables: { notes, notesAgain: notes },
        dynamodb: client,
        tableNames: { app: table.name },
      }),
    ).toThrow(DefinitionError);
  });
});

describe("差分更新", () => {
  it("変更したフィールドだけを書き、Afterは保存された内容と一致する", async () => {
    const r = repo();
    const w = ws();
    const key = { workspaceId: w, taskId: "t1" };
    await r.tasks.create(key, todo("a", { note: "keep" }));
    const after = await r.tasks.update(key, { title: "b" });
    expect(after).toMatchObject({ title: "b", note: "keep" });
    expect(await r.tasks.get(key)).toEqual(after);
    const change = changes.at(-1)!;
    expect(change.before).toMatchObject({ title: "a" });
    expect(change.after).toEqual(after);
    expect(change.version).toBe(2);
    expect((await raw(`Task#ws$P${seq}`, "Task#t1"))!._version).toBe(2);
  });

  it("undefinedはフィールドを削除する。必須のフィールドは削除できない", async () => {
    const r = repo();
    const key = { workspaceId: ws(), taskId: "t1" };
    await r.tasks.create(key, todo("a", { note: "x" }));
    const after = await r.tasks.update(key, { note: undefined });
    expect(after).not.toHaveProperty("note");
    await expect(r.tasks.update(key, { title: undefined })).rejects.toThrow(
      ValidationError,
    );
  });

  it("キーは変更できない。不正な値は拒否する", async () => {
    const r = repo();
    const key = { workspaceId: ws(), taskId: "t1" };
    await r.tasks.create(key, todo("a"));
    await expect(r.tasks.update(key, { taskId: "other" })).rejects.toThrow(
      /key field/,
    );
    await expect(r.tasks.update(key, { priority: 99 })).rejects.toThrow(
      ValidationError,
    );
    // 同じ値なら許す
    await expect(
      r.tasks.update(key, { taskId: "t1", title: "b" }),
    ).resolves.toMatchObject({ title: "b" });
  });

  it("存在しないItemは更新できない", async () => {
    const r = repo();
    await expect(
      r.tasks.update({ workspaceId: ws(), taskId: "zz" }, { title: "b" }),
    ).rejects.toThrow(ItemNotFoundError);
  });

  it("Indexのキーのフィールドを変えると物理キーを付け直す（足りない値は事前に読む）", async () => {
    const r = repo();
    const w = ws();
    const key = { workspaceId: w, taskId: "t1" };
    await r.tasks.create(key, todo("a", { priority: 7 }));
    await r.tasks.mutate(taskMutations.setStatus, key, { status: "done" });
    const stored = (await raw(`Task#ws$P${seq}`, "Task#t1"))!;
    expect(stored.PK1).toBe(`Task#ws$P${seq}#done`);
    expect(stored.SK1).toMatch(/^Task#\$\*c01c000000000000#/);
    const res = await r.tasks.query(taskQueries.byStatus, {
      workspaceId: w,
      status: "done",
    });
    expect(res.items.map((t) => t.taskId)).toEqual(["t1"]);
    const before = await r.tasks.query(taskQueries.byStatus, {
      workspaceId: w,
      status: "todo",
    });
    expect(before.items).toEqual([]);
  });

  it("Itemがないことと条件不成立は、クライアント向けには同じメッセージになる", async () => {
    const r = repo();
    const w = ws();
    const key = { workspaceId: w, taskId: "t1" };
    await r.tasks.create(key, todo("a"));
    const missing = await r.tasks
      .update({ workspaceId: w, taskId: "none" }, { title: "x" })
      .catch((e: unknown) => e);
    const failed = await r.tasks
      .update(key, { title: "x" }, { where: { title: "other" } })
      .catch((e: unknown) => e);
    expect(missing).toBeInstanceOf(ItemNotFoundError);
    expect(failed).toBeInstanceOf(ConditionFailedError);
    for (const e of [missing, failed]) {
      expect(e).toBeInstanceOf(WriteNotAppliedError);
      expect((e as WriteNotAppliedError).publicMessage).toBe(
        WriteNotAppliedError.publicMessage,
      );
    }
  });

  it("whereによる条件付き更新", async () => {
    const r = repo();
    const key = { workspaceId: ws(), taskId: "t1" };
    await r.tasks.create(key, todo("a", { assignee: "alice" }));
    await expect(
      r.tasks.mutate(
        taskMutations.rename,
        key,
        { title: "x" },
        { context: { userId: "bob" } },
      ),
    ).rejects.toThrow(ConditionFailedError);
    await expect(
      r.tasks.mutate(
        taskMutations.rename,
        key,
        { title: "x" },
        { context: { userId: "alice" } },
      ),
    ).resolves.toMatchObject({ title: "x" });
    for (const [where, ok] of [
      [{ priority: { between: [0, 5] } }, true],
      [{ priority: { in: [1, 2] } }, false],
      [{ note: { notExists: true } }, true],
      [{ title: { beginsWith: "x" } }, true],
      [{ title: { size: { gt: 3 } } }, false],
      [{ assignee: { ne: null } }, true],
    ] as const) {
      const p = r.tasks.update(key, { note: undefined }, { where });
      if (ok) await expect(p).resolves.toBeDefined();
      else await expect(p).rejects.toThrow(ConditionFailedError);
    }
  });

  it("原子的な加算は同時に行っても失われない", async () => {
    const r = repo();
    const key = { workspaceId: ws(), taskId: "t1" };
    await r.tasks.create(key, todo("a"));
    await Promise.all(
      Array.from({ length: 10 }, () =>
        r.tasks.mutate(taskMutations.bumpViews, key, { delta: 1 }),
      ),
    );
    const final = (await r.tasks.get(key))!;
    expect(final.kind === "todo" && final.views).toBe(10);
    expect(changes.at(-1)!.after).toMatchObject({ views: expect.any(Number) });
  });

  it("Indexのキーに使われるフィールドには加算できない", async () => {
    const r = repo();
    const key = { workspaceId: ws(), taskId: "t1" };
    await r.tasks.create(key, todo("a"));
    await expect(
      r.tasks.mutate(taskMutations.bumpPriority, key, { delta: 1 }),
    ).rejects.toThrow(/index/);
  });

  it("コントラクトのTable定義からアクセサを引ける", async () => {
    const r = repo();
    const key = { workspaceId: ws(), taskId: "t1" };
    await r.tasks.create(key, todo("a"));
    expect((await r.forTable(tasks).get(key))?.title).toBe("a");
    expect(() =>
      r.forTable({ ...notes, entity: "Other" } as typeof notes),
    ).toThrow(DefinitionError);
  });

  it("createOps で作っていないミューテーションはエラー", async () => {
    const r = repo();
    const key = { workspaceId: ws(), taskId: "t1" };
    await r.tasks.create(key, todo("a"));
    const { kind: _kind, ...notAnOp } = taskMutations.setStatus;
    await expect(
      r.tasks.mutate(notAnOp as never, key, { status: "done" } as never),
    ).rejects.toThrow(DefinitionError);
  });

  it("事前に読んだ後に他の更新が入ったら再試行する", async () => {
    const r = repo();
    const w = ws();
    const key = { workspaceId: w, taskId: "t1" };
    await r.tasks.create(key, todo("a"));
    await Promise.all([
      r.tasks.mutate(taskMutations.setStatus, key, { status: "doing" }),
      r.tasks.update(key, { priority: 5 }),
      r.tasks.mutate(taskMutations.setStatus, key, { status: "done" }),
    ]);
    const final = (await r.tasks.get(key))!;
    const stored = (await raw(`Task#ws$P${seq}`, "Task#t1"))!;
    expect(final.kind === "todo" && stored.PK1).toBe(
      `Task#ws$P${seq}#${final.kind === "todo" ? final.status : ""}`,
    );
    expect(stored.SK1).toMatch(/^Task#\$\*c014000000000000#/);
  });

  it("variantを切り替えると、前のvariantのフィールドとIndexの物理キーを消す", async () => {
    const r = repo();
    const w = ws();
    const key = { workspaceId: w, taskId: "t1" };
    await r.tasks.create(key, todo("a", { note: "n" }));
    const due = new Date("2026-12-01T00:00:00Z");
    const after = await r.tasks.update(key, {
      kind: "milestone",
      dueDate: due,
    });
    expect(after).toMatchObject({
      kind: "milestone",
      title: "a",
      dueDate: due,
    });
    expect(after).not.toHaveProperty("status");
    expect(after).not.toHaveProperty("note");
    const stored = (await raw(`Task#ws$P${seq}`, "Task#t1"))!;
    for (const attr of [
      "status",
      "assignee",
      "priority",
      "note",
      "PK1",
      "SK1",
      "PK2",
      "SK2",
    ]) {
      expect(stored).not.toHaveProperty(attr);
    }
    expect(stored.SK3).toBe("Task#$+2026-12-01T00:00:00.000Z");
    expect(
      (
        await r.tasks.query(taskQueries.byStatus, {
          workspaceId: w,
          status: "todo",
        })
      ).items,
    ).toEqual([]);
    expect(changes.at(-1)!.after).toEqual(after);
  });

  it("切り替えた先のvariantで必須のフィールドがなければ拒否する", async () => {
    const r = repo();
    const w = ws();
    const key = { workspaceId: w, taskId: "t1" };
    await r.tasks.create(key, todo("a"));
    await expect(r.tasks.update(key, { kind: "milestone" })).rejects.toThrow(
      ValidationError,
    );
    expect((await r.tasks.get(key))!.kind).toBe("todo");
  });
});

describe("ifUnchanged", () => {
  it("トークンを取得した後に他の更新が入ると、StaleItemErrorで拒否する", async () => {
    const r = repo();
    const w = ws();
    const key = { workspaceId: w, taskId: "t1" };
    await r.tasks.create(key, todo("a"));
    const got = (await r.tasks.get(key, { withToken: true }))!;
    const plain = await r.tasks.get(key);
    expectTypeOf(got.item).toEqualTypeOf<NonNullable<typeof plain>>();
    expect(got.item).toEqual(plain);
    expect(got.item.title).toBe("a");
    await r.tasks.update(key, { title: "other" });
    await expect(
      r.tasks.mutate(
        taskMutations.rename,
        key,
        { title: "mine" },
        { ifUnchanged: got.token, context: { userId: "u" } },
      ),
    ).rejects.toThrow(StaleItemError);
    await expect(
      r.tasks.update(key, { title: "mine" }, { ifUnchanged: got.token }),
    ).rejects.toThrow(StaleItemError);
    const fresh = (await r.tasks.get(key, { withToken: true }))!;
    const updated = await r.tasks.update(
      key,
      { title: "mine" },
      { ifUnchanged: fresh.token },
    );
    expect(updated.title).toBe("mine");
  });

  it("読む経路とrunnerでも検査する", async () => {
    const r = repo();
    const w = ws();
    const key = { workspaceId: w, taskId: "t1" };
    await r.tasks.create(key, todo("a"));
    const { token } = (await r.tasks.get(key, { withToken: true }))!;
    await r.tasks.update(key, { title: "other" });
    await expect(
      r.tasks.mutate(
        taskMutations.setStatus,
        key,
        { status: "done" },
        { ifUnchanged: token },
      ),
    ).rejects.toThrow(StaleItemError);
    await expect(
      r.runTransaction(async (tx) => {
        await r.tasks
          .withContext({ runner: tx })
          .update(key, { title: "tx" }, { ifUnchanged: token });
      }),
    ).rejects.toThrow(StaleItemError);
  });

  it("別のItemのトークンや改ざんしたトークンは拒否する", async () => {
    const r = repo();
    const w = ws();
    await r.tasks.create({ workspaceId: w, taskId: "a" }, todo("a"));
    await r.tasks.create({ workspaceId: w, taskId: "b" }, todo("b"));
    const { token } = (await r.tasks.get(
      { workspaceId: w, taskId: "a" },
      { withToken: true },
    ))!;
    await expect(
      r.tasks.update(
        { workspaceId: w, taskId: "b" },
        { title: "x" },
        { ifUnchanged: token },
      ),
    ).rejects.toThrow(InvalidTokenError);
    await expect(
      r.tasks.update(
        { workspaceId: w, taskId: "a" },
        { title: "x" },
        { ifUnchanged: token + "x" },
      ),
    ).rejects.toThrow(InvalidTokenError);
  });

  it("required の設定では、トークンのない書き込みを拒否する", async () => {
    const strict = tableConfig({ ...noteDef, ifUnchanged: "required" });
    const strictMutations = defineContext<any>().createOps(strict, (o) => ({
      rename: o.mutation({
        params: z.object({ title: z.string() }),
        patch: (p) => ({ title: p.title }),
      }),
      touch: o.mutation({
        params: z.object({ title: z.string() }),
        ifUnchanged: "optional",
        patch: (p) => ({ title: p.title }),
      }),
    }));
    const r = createRepository({
      tables: { strict },
      dynamodb: client,
      tableNames: { app: table.name },
      cursorSecret: "secret",
    });
    await r.strict.create({ id: "s1" }, { title: "t", body: "b" });
    await expect(r.strict.update({ id: "s1" }, { title: "x" })).rejects.toThrow(
      ValidationError,
    );
    await expect(
      r.strict.mutate(strictMutations.rename, { id: "s1" }, { title: "x" }),
    ).rejects.toThrow(ValidationError);
    await r.strict.mutate(strictMutations.touch, { id: "s1" }, { title: "y" });
    const { token } = (await r.strict.get({ id: "s1" }, { withToken: true }))!;
    await r.strict.mutate(
      strictMutations.rename,
      { id: "s1" },
      { title: "z" },
      { ifUnchanged: token },
    );
    expect((await r.strict.get({ id: "s1" }))!.title).toBe("z");
  });
});

describe("全体置換", () => {
  it("通常のアクセサの set：なければ作成し、あれば置き換える。Beforeは正確", async () => {
    const r = repo();
    const w = ws();
    const key = { workspaceId: w, taskId: "t1" };
    const now = new Date("2026-11-01T00:00:00Z");
    const full = (title: string, extra: Record<string, unknown> = {}) => ({
      ...key,
      ...todo(title, extra),
      createdAt: now,
      updatedAt: now,
    });
    const created = await r.tasks.set(key, full("a", { note: "n" }));
    expect(created.title).toBe("a");
    const replaced = await r.tasks.set(key, full("b"));
    expect(replaced).not.toHaveProperty("note");
    expect(await r.tasks.get(key)).toEqual(replaced);
    expect(changes.map((c) => c.origin.kind)).toEqual(["single", "single"]);
    expect(changes.at(-1)).toMatchObject({
      before: { title: "a", note: "n" },
      after: { title: "b" },
      version: 2,
    });
  });
});

describe("名前付きクエリ", () => {
  it("ALL：Sort Keyの範囲と方向", async () => {
    const r = repo();
    const w = ws();
    for (const [id, priority] of [
      ["a", 1],
      ["b", 5],
      ["c", 3],
      ["d", 9],
    ] as const) {
      await r.tasks.create(
        { workspaceId: w, taskId: id },
        todo(id, { priority }),
      );
    }
    const res = await r.tasks.query(taskQueries.byStatus, {
      workspaceId: w,
      status: "todo",
      minPriority: 3,
    });
    expect(res.items.map((t) => t.taskId)).toEqual(["d", "b", "c"]);
    expectTypeOf(res.items[0]!.kind).toEqualTypeOf<"todo">();
  });

  it("ページネーションと、トークンの改ざん・流用の拒否", async () => {
    const r = repo();
    const w = ws();
    for (const id of ["a", "b", "c", "d", "e"]) {
      await r.tasks.create({ workspaceId: w, taskId: id }, todo(id));
    }
    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await r.tasks.query(
        taskQueries.all,
        { workspaceId: w },
        { limit: 2, cursor },
      );
      seen.push(...page.items.map((t) => t.taskId));
      cursor = page.cursor;
      if (cursor) {
        await expect(
          r.tasks.query(taskQueries.all, { workspaceId: "other" }, { cursor }),
        ).rejects.toThrow(InvalidCursorError);
        await expect(
          r.tasks.query(
            taskQueries.all,
            { workspaceId: w },
            { cursor: cursor.slice(0, -2) + "xx" },
          ),
        ).rejects.toThrow(InvalidCursorError);
      }
    } while (cursor);
    expect(seen).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("トークンは認証コンテキストを含めたキー条件に結び付く", async () => {
    const r = repo();
    const w = ws();
    const mine = defineContext<{ userId: string }>().createOps(tasks, (o) => ({
      mine: o.query({
        index: "byAssignee",
        params: z.object({ workspaceId: z.string() }),
        where: (p, ctx) => ({
          partition: { workspaceId: p.workspaceId, assignee: ctx.userId },
        }),
      }),
    })).mine;
    for (const id of ["a", "b", "c"]) {
      await r.tasks.create(
        { workspaceId: w, taskId: id },
        todo(id, { assignee: "u1" }),
      );
    }
    const first = await r.tasks.query(
      mine,
      { workspaceId: w },
      { limit: 2, context: { userId: "u1" } },
    );
    expect(first.cursor).toBeDefined();
    // 同じパラメーターでも、別のユーザーのキー条件では使えない
    await expect(
      r.tasks.query(
        mine,
        { workspaceId: w },
        { cursor: first.cursor, context: { userId: "u2" } },
      ),
    ).rejects.toThrow(InvalidCursorError);
    const second = await r.tasks.query(
      mine,
      { workspaceId: w },
      { cursor: first.cursor, context: { userId: "u1" } },
    );
    expect([...first.items, ...second.items].map((t) => t.taskId)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("範囲外の境界でも数値の順序を保つ", async () => {
    const r = repo();
    const w = ws();
    for (const [id, priority] of [
      ["a", 0],
      ["b", 5],
      ["c", 9],
    ] as const) {
      await r.tasks.create(
        { workspaceId: w, taskId: id },
        todo(id, { priority }),
      );
    }
    const ids = async (minPriority: number) =>
      (
        await r.tasks.query(taskQueries.byStatus, {
          workspaceId: w,
          status: "todo",
          minPriority,
        })
      ).items.map((t) => t.taskId);
    expect(await ids(-1)).toEqual(["c", "b", "a"]);
    expect(await ids(10)).toEqual([]);
  });

  it("KEYS_ONLY：全体はBatchGetItemで取得し、射影ではキーを逆算する。nullもIndexに載る", async () => {
    const r = repo();
    const w = ws();
    await r.tasks.create({ workspaceId: w, taskId: "a" }, todo("a"));
    await r.tasks.create(
      { workspaceId: w, taskId: "b" },
      todo("b", { assignee: "bob" }),
    );
    const full = await r.tasks.query(taskQueries.byAssignee, {
      workspaceId: w,
      assignee: null,
    });
    expect(full.items).toHaveLength(1);
    expect(full.items[0]).toMatchObject({ taskId: "a", title: "a" });
    const keys = await r.tasks.query(taskQueries.byAssigneeKeys, {
      workspaceId: w,
      assignee: "bob",
    });
    expect(keys.items).toEqual([
      {
        workspaceId: w,
        taskId: "b",
        assignee: "bob",
        updatedAt: expect.any(Date),
      },
    ]);
  });

  it("withVersions：各Itemの version を返す。KEYS_ONLY の射影でも本体を読む", async () => {
    const r = repo();
    const w = ws();
    await r.tasks.create({ workspaceId: w, taskId: "a" }, todo("a"));
    await r.tasks.create({ workspaceId: w, taskId: "b" }, todo("b"));
    await r.tasks.update({ workspaceId: w, taskId: "b" }, { title: "b2" });
    const all = await r.tasks.query(
      taskQueries.all,
      { workspaceId: w },
      { withVersions: true },
    );
    expect(all.items.map((t) => t.taskId)).toEqual(["a", "b"]);
    expect(all.versions).toEqual([1, 2]);
    const plain = await r.tasks.query(taskQueries.all, { workspaceId: w });
    expect(plain.versions).toBeUndefined();
    const keys = await r.tasks.query(
      taskQueries.byAssigneeKeys,
      { workspaceId: w, assignee: null },
      { withVersions: true },
    );
    expect(keys.versions).toEqual([1, 2]);
    expect(keys.items[1]).toMatchObject({ taskId: "b", title: "b2" });
  });

  it("INCLUDE：射影された属性を返す。sparse indexにはvariantにないItemは載らない", async () => {
    const r = repo();
    const w = ws();
    await r.tasks.create({ workspaceId: w, taskId: "t" }, todo("t"));
    await r.tasks.create(
      { workspaceId: w, taskId: "m1" },
      {
        kind: "milestone",
        title: "m1",
        dueDate: new Date("2026-01-01T00:00:00Z"),
      },
    );
    await r.tasks.create(
      { workspaceId: w, taskId: "m2" },
      {
        kind: "milestone",
        title: "m2",
        dueDate: new Date("2026-06-01T00:00:00Z"),
      },
    );
    const res = await r.tasks.query(taskQueries.dueBefore, {
      workspaceId: w,
      before: new Date("2026-03-01T00:00:00Z"),
    });
    expect(res.items).toEqual([
      {
        workspaceId: w,
        taskId: "m1",
        dueDate: new Date("2026-01-01T00:00:00Z"),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      },
    ]);
  });

  it("所属判定とQueryの結果が一致し、変更イベントを分類できる", async () => {
    const r = repo();
    const w = ws();
    const key = { workspaceId: w, taskId: "t1" };
    await r.tasks.create(key, todo("a"));
    await r.tasks.mutate(taskMutations.setStatus, key, { status: "done" });
    const change = changes.at(-1)!;
    const todoParams = {
      workspaceId: w,
      status: "todo" as const,
      minPriority: 0,
    };
    const doneParams = {
      workspaceId: w,
      status: "done" as const,
      minPriority: 0,
    };
    expect(classifyChange(taskQueries.byStatus, todoParams, change)).toBe(
      "REMOVED",
    );
    expect(classifyChange(taskQueries.byStatus, doneParams, change)).toBe(
      "ADDED",
    );
    const res = await r.tasks.query(taskQueries.byStatus, doneParams);
    expect(
      res.items.every((i) =>
        taskQueries.byStatus.matches(i, doneParams, undefined as never),
      ),
    ).toBe(true);
  });
});

describe("runner", () => {
  it("runTransaction：読み書きを1回で確定する", async () => {
    const r = repo();
    const w = ws();
    await r.tasks.create({ workspaceId: w, taskId: "p" }, todo("parent"));
    await r.runTransaction(async (tx) => {
      const t = r.tasks.withContext({ runner: tx });
      const parent = await t.get({ workspaceId: w, taskId: "p" });
      await t.create(
        { workspaceId: w, taskId: "c" },
        todo(`child of ${parent!.title}`),
      );
      await t.update({ workspaceId: w, taskId: "p" }, { title: "parent2" });
    });
    expect((await r.tasks.get({ workspaceId: w, taskId: "c" }))!.title).toBe(
      "child of parent",
    );
    expect((await r.tasks.get({ workspaceId: w, taskId: "p" }))!.title).toBe(
      "parent2",
    );
    const origins = new Set(changes.slice(-2).map((c) => c.origin.id));
    expect(origins.size).toBe(1);
    expect(changes.at(-1)!.origin.kind).toBe("transaction");
  });

  it("runTransaction：読んだItemが変わればやり直す", async () => {
    const r = repo();
    const w = ws();
    const a = { workspaceId: w, taskId: "a" };
    await r.tasks.create(a, todo("a"));
    let attempts = 0;
    await r.runTransaction(async (tx) => {
      attempts++;
      const t = r.tasks.withContext({ runner: tx });
      const item = await t.get(a);
      if (attempts === 1) await r.tasks.update(a, { title: "changed outside" });
      await t.create({ workspaceId: w, taskId: `copy` }, todo(item!.title));
    });
    expect(attempts).toBe(2);
    expect((await r.tasks.get({ workspaceId: w, taskId: "copy" }))!.title).toBe(
      "changed outside",
    );
  });

  it("where / check が成り立たなければ再試行せずにエラー", async () => {
    const r = repo();
    const w = ws();
    const a = { workspaceId: w, taskId: "a" };
    await r.tasks.create(a, todo("a"));
    let attempts = 0;
    await expect(
      r.runTransaction(async (tx) => {
        attempts++;
        const t = r.tasks.withContext({ runner: tx });
        await t.check(a, { status: "done" });
        await t.create({ workspaceId: w, taskId: "b" }, todo("b"));
      }),
    ).rejects.toThrow(ConditionFailedError);
    expect(attempts).toBe(1);
    expect(await r.tasks.get({ workspaceId: w, taskId: "b" })).toBeNull();
    await expect(
      r.runTransaction(async (tx) => {
        await r.tasks
          .withContext({ runner: tx })
          .update(a, { title: "x" }, { where: { status: "done" } });
      }),
    ).rejects.toThrow(ConditionFailedError);
  });

  it("読んだItemにcheckを付けても、読んだ後の変更でやり直す", async () => {
    const r = repo();
    const w = ws();
    const a = { workspaceId: w, taskId: "a" };
    await r.tasks.create(a, todo("a"));
    let attempts = 0;
    await r.runTransaction(async (tx) => {
      attempts++;
      const t = r.tasks.withContext({ runner: tx });
      const item = await t.get(a);
      // where は成り立ったまま、読んだ値だけが変わる
      if (attempts === 1) await r.tasks.update(a, { title: "changed" });
      await t.check(a, { status: "todo" });
      await t.create({ workspaceId: w, taskId: "copy" }, todo(item!.title));
    });
    expect(attempts).toBe(2);
    expect((await r.tasks.get({ workspaceId: w, taskId: "copy" }))!.title).toBe(
      "changed",
    );
  });

  it("書き込んだItemは同じトランザクションで読めない", async () => {
    const r = repo();
    const w = ws();
    await expect(
      r.runTransaction(async (tx) => {
        const t = r.tasks.withContext({ runner: tx });
        await t.create({ workspaceId: w, taskId: "a" }, todo("a"));
        await t.get({ workspaceId: w, taskId: "a" });
      }),
    ).rejects.toThrow(TransactionError);
  });

  it("同じItemへの重複した操作を拒否する", async () => {
    const r = repo();
    const w = ws();
    await expect(
      r.runTransaction(async (tx) => {
        const t = r.tasks.withContext({ runner: tx });
        await t.create({ workspaceId: w, taskId: "a" }, todo("a"));
        await t.delete({ workspaceId: w, taskId: "a" });
      }),
    ).rejects.toThrow(TransactionError);
  });

  it("createBatch：書き込みだけをまとめて確定し、競合しても読み直して成功する", async () => {
    const r = repo();
    const w = ws();
    const a = { workspaceId: w, taskId: "a" };
    await r.tasks.create(a, todo("a"));
    const batch = r.createBatch();
    const t = r.tasks.withContext({ runner: batch });
    await t.set(
      { workspaceId: w, taskId: "b" },
      {
        ...a,
        ...todo("b"),
        taskId: "b",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );
    await t.update(a, { title: "a2" });
    await t.delete({ workspaceId: w, taskId: "none" });
    await batch.commit();
    expect((await r.tasks.get(a))!.title).toBe("a2");
    expect((await r.tasks.get({ workspaceId: w, taskId: "b" }))!.title).toBe(
      "b",
    );
  });
});

describe("一括での書き込み", () => {
  it("BatchWriteItemで書き込み、開始・終了のイベントを送る", async () => {
    const markers: string[] = [];
    const r = createRepository({
      tables: { tasks },
      dynamodb: client,
      tableNames: { app: table.name },
      listener: {
        onChanges: (c) => void changes.push(...c),
        onBatchMarker: (m) => void markers.push(m.type),
      },
    });
    const w = ws();
    const result = await r.tasks.bulkWrite({
      scope: { workspaceId: w },
      items: Array.from({ length: 30 }, (_, i) => ({
        key: { workspaceId: w, taskId: `t${String(i).padStart(2, "0")}` },
        input: todo(`t${i}`),
      })),
    });
    expect(result.count).toBe(30);
    expect(markers).toEqual(["BATCH_STARTED", "BATCH_FINISHED"]);
    expect(changes).toHaveLength(30);
    expect(new Set(changes.map((c) => c.origin.id))).toEqual(
      new Set([result.id]),
    );
    const all = await r.tasks.query(
      taskQueries.all,
      { workspaceId: w },
      { limit: 100 },
    );
    expect(all.items).toHaveLength(30);
  });
});

describe("保存されたデータとの整合", () => {
  it("別のエンティティのItemや壊れたデータはエラーにする", async () => {
    await client.send(
      new PutItemCommand({
        TableName: table.name,
        Item: marshall({ PK: "Task#broken", SK: "Task#x", title: 1 }),
      }),
    );
    const r = repo();
    await expect(
      r.tasks.get({ workspaceId: "broken", taskId: "x" }),
    ).rejects.toThrow();
  });

  it("長すぎるキーは拒否する", async () => {
    const r = repo();
    await expect(
      r.tasks.create({ workspaceId: "x".repeat(3000), taskId: "t" }, todo("a")),
    ).rejects.toThrow(/exceeds/);
  });
});
