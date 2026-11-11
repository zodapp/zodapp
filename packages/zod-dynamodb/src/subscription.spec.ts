import fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { tasks as unionTasks } from "./__fixtures__/tasks";
import { physicalTable } from "./physical";
import { type QueryDef } from "./query";
import { subscription } from "./subscription";
import { tableConfig } from "./table";
import {
  publishedFields,
  topicForSubscriber,
  topicMessageCodec,
  topicsForChange,
  topicsForItem,
} from "./topics";
import { defineContext } from "./register";

const { createOps } = defineContext<any>();

const table = physicalTable({
  name: "app",
  primary: { pk: "PK", sk: "SK" },
  indexes: { GSI1: { pk: "PK1", sk: "SK1", projection: "KEYS_ONLY" } },
});

const tasks = tableConfig({
  table,
  entity: "Task",
  item: z.object({
    workspaceId: z.string(),
    taskId: z.string(),
    status: z.enum(["todo", "doing", "done"]),
    priority: z.int(),
    title: z.string(),
    dueDate: z.date().optional(),
  }),
  create: z.object({}),
  key: { partition: ["workspaceId"], sort: ["taskId"] },
  indexes: {
    byStatus: {
      slot: "GSI1",
      partition: ["workspaceId", "status"],
      sort: ["priority", "taskId"],
    },
  },
});

type AnyQuery = QueryDef<any, any, any, any>;
type Task = typeof tasks.item extends z.ZodType<infer T> ? T : never;
type Ctx = { status: Task["status"] };

const q = createOps(tasks, (o) => ({
  byPartition: o.query({
    index: "byStatus",
    params: z.object({ ws: z.string(), status: z.string() }),
    where: (p) => ({
      partition: { workspaceId: p.ws, status: p.status as Task["status"] },
    }),
  }),
  minPriority: o.query({
    index: "byStatus",
    params: z.object({ ws: z.string(), status: z.string(), min: z.int() }),
    where: (p) => ({
      partition: { workspaceId: p.ws, status: p.status as Task["status"] },
      sort: { priority: { gte: p.min } },
    }),
  }),
  priority: o.query({
    index: "byStatus",
    params: z.object({ ws: z.string(), status: z.string(), priority: z.int() }),
    where: (p) => ({
      partition: { workspaceId: p.ws, status: p.status as Task["status"] },
      sort: { priority: p.priority },
    }),
  }),
  prefix: o.query({
    index: "byStatus",
    params: z.object({
      ws: z.string(),
      status: z.string(),
      priority: z.int(),
      prefix: z.string(),
    }),
    where: (p) => ({
      partition: { workspaceId: p.ws, status: p.status as Task["status"] },
      sort: { priority: p.priority, taskId: { beginsWith: p.prefix } },
    }),
  }),
  exact: o.query({
    index: "byStatus",
    params: z.object({
      ws: z.string(),
      status: z.string(),
      priority: z.int(),
      taskId: z.string(),
    }),
    where: (p) => ({
      partition: { workspaceId: p.ws, status: p.status as Task["status"] },
      sort: { priority: p.priority, taskId: p.taskId },
    }),
  }),
  mine: o.query({
    index: "byStatus",
    params: z.object({ ws: z.string() }),
    where: (p, ctx: Ctx) => ({
      partition: { workspaceId: p.ws, status: ctx.status },
    }),
  }),
  all: o.query({
    params: z.object({ ws: z.string() }),
    where: (p) => ({ partition: { workspaceId: p.ws } }),
  }),
  one: o.query({
    params: z.object({ ws: z.string(), taskId: z.string() }),
    where: (p) => ({
      partition: { workspaceId: p.ws },
      sort: { taskId: p.taskId },
    }),
  }),
}));

const subs = Object.fromEntries(
  Object.entries(q).map(([name, query]) => [name, subscription(query)]),
) as { [K in keyof typeof q]: ReturnType<typeof subscription<(typeof q)[K]>> };

const text = fc.string({
  unit: fc.oneof(
    fc.constantFrom("\u0000", "\n", " ", "#", "$", "/", "+", "-"),
    fc.constantFrom("a", "b", "0", "東", "😀"),
  ),
  maxLength: 6,
});

const taskArb = fc.record({
  workspaceId: text,
  taskId: text,
  status: fc.constantFrom("todo" as const, "doing" as const, "done" as const),
  priority: fc.integer({ min: -1000, max: 1000 }),
  title: fc.constant("t"),
});

/** Item に一致する購読のパラメーターと、使う等値の部分の長さ */
const matchingCases = (t: Task) =>
  [
    [subs.byPartition, { ws: t.workspaceId, status: t.status }, undefined, 0],
    [
      subs.minPriority,
      { ws: t.workspaceId, status: t.status, min: t.priority - 1 },
      undefined,
      0,
    ],
    [
      subs.priority,
      { ws: t.workspaceId, status: t.status, priority: t.priority },
      undefined,
      1,
    ],
    [
      subs.prefix,
      {
        ws: t.workspaceId,
        status: t.status,
        priority: t.priority,
        prefix: [...t.taskId].slice(0, 2).join(""),
      },
      undefined,
      1,
    ],
    [
      subs.exact,
      {
        ws: t.workspaceId,
        status: t.status,
        priority: t.priority,
        taskId: t.taskId,
      },
      undefined,
      2,
    ],
    [subs.mine, { ws: t.workspaceId }, { status: t.status }, 0],
    [subs.all, { ws: t.workspaceId }, undefined, 0],
    [subs.one, { ws: t.workspaceId, taskId: t.taskId }, undefined, 1],
  ] as const;

describe("トピック", () => {
  it("購読者のトピックは、一致するItemのトピックの、等値の部分の長さの位置にある", async () => {
    await fc.assert(
      fc.asyncProperty(taskArb, async (t) => {
        for (const [sub, params, ctx, k] of matchingCases(t)) {
          expect((sub.query as AnyQuery).matches(t, params, ctx)).toBe(true);
          const topic = await topicForSubscriber(sub, params, ctx);
          const topics = await topicsForItem(tasks, sub.query.index, t);
          expect(topics[k]).toBe(topic);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("別の Partition の購読とは、トピックが重ならない", async () => {
    await fc.assert(
      fc.asyncProperty(taskArb, taskArb, async (a, b) => {
        fc.pre(a.workspaceId !== b.workspaceId);
        const topics = new Set([
          ...(await topicsForItem(tasks, "byStatus", a)),
          ...(await topicsForItem(tasks, undefined, a)),
        ]);
        for (const [sub, params, ctx] of matchingCases(b)) {
          expect(topics.has(await topicForSubscriber(sub, params, ctx))).toBe(
            false,
          );
        }
      }),
      { numRuns: 100 },
    );
  });

  it("名前の形と、Index の外の Item", async () => {
    const t: Task = {
      workspaceId: "w",
      taskId: "t",
      status: "todo",
      priority: 1,
      title: "x",
    };
    const topics = await topicsForItem(tasks, "byStatus", t, {
      prefix: "app/rt",
    });
    expect(topics).toHaveLength(3);
    expect(new Set(topics).size).toBe(3);
    for (const topic of topics) {
      expect(topic).toMatch(/^app\/rt\/Task\/byStatus\/[A-Za-z0-9_-]{43}$/);
    }
    expect((await topicsForItem(tasks, undefined, t))[0]).toMatch(
      /^zod-dynamodb\/Task\/_primary\//,
    );
    // sparse index：Index のキーのフィールドがなければ、どのトピックにも入らない
    const noStatus = { ...t, status: undefined } as unknown as Task;
    expect(await topicsForItem(tasks, "byStatus", noStatus)).toEqual([]);
    await expect(topicsForItem(tasks, "nope", t)).rejects.toThrow(/unknown/);
  });

  it("変更の Before と After のトピックを、重複なく求める", async () => {
    const before: Task = {
      workspaceId: "w",
      taskId: "t",
      status: "todo",
      priority: 1,
      title: "x",
    };
    const after = { ...before, priority: 2 };
    const topics = await topicsForChange(tasks, "byStatus", { before, after });
    // k=0 は共通で、k=1・k=2 はそれぞれ別
    expect(topics).toHaveLength(5);
    expect(
      await topicsForChange(tasks, "byStatus", { before: null, after }),
    ).toHaveLength(3);
  });
});

describe("Subscription", () => {
  it("fields で Item を絞る。型も絞られる", () => {
    const sub = subscription(q.all, { fields: { pick: ["title"] } });
    expect([...sub.fields!].sort()).toEqual(["taskId", "title", "workspaceId"]);
    expectTypeOf(sub.$item).toEqualTypeOf<{
      workspaceId: string;
      taskId: string;
      title: string;
    }>();
    const json = sub.encodeItem({
      workspaceId: "w",
      taskId: "t",
      title: "x",
    });
    expect(json).toEqual({ workspaceId: "w", taskId: "t", title: "x" });
    // Index のキーのフィールド（並べ替えに使う）は常に含める
    const onIndex = subscription(q.byPartition, {
      fields: { pick: ["title"] },
    });
    expect([...onIndex.fields!].sort()).toEqual([
      "priority",
      "status",
      "taskId",
      "title",
      "workspaceId",
    ]);
    expect(onIndex.name).toBe("byPartition");
    const full = subscription(q.byPartition);
    expectTypeOf(full.$item).toEqualTypeOf<Task>();
    expect(full.fields).toBeUndefined();
  });

  it("params・Item・キーを JSON と往復する", () => {
    const sub = subscription(q.all);
    const dueDate = new Date("2026-01-01T00:00:00Z");
    const item = {
      workspaceId: "w",
      taskId: "t",
      status: "todo" as const,
      priority: 1,
      title: "x",
      dueDate,
    };
    const json = JSON.parse(JSON.stringify(sub.encodeItem(item)));
    expect(sub.decodeItem(json)).toEqual(item);
    expect(sub.decodeParams(sub.encodeParams({ ws: "w" }))).toEqual({
      ws: "w",
    });
    expect(
      sub.decodeKey(sub.encodeKey({ workspaceId: "w", taskId: "t" })),
    ).toEqual({ workspaceId: "w", taskId: "t" });
  });
});

describe("トピックのメッセージ", () => {
  const origin = { kind: "single" as const, id: "o1" };

  it("同じ Index の Subscription のフィールドの和と、Index のキー", () => {
    const a = subscription(q.byPartition, { fields: { pick: ["title"] } });
    const b = subscription(q.priority, { fields: { pick: ["dueDate"] } });
    expect([...publishedFields(tasks, "byStatus", [a, b])!].sort()).toEqual([
      "dueDate",
      "priority",
      "status",
      "taskId",
      "title",
      "workspaceId",
    ]);
    expect(
      publishedFields(tasks, "byStatus", [a, subscription(q.mine)]),
    ).toBeUndefined();
  });

  it("フィールドを絞って変換し、Gateway で戻す", () => {
    const fields = publishedFields(tasks, "byStatus", [
      subscription(q.byPartition, { fields: { pick: [] } }),
    ]);
    const codec = topicMessageCodec(tasks, fields);
    const dueDate = new Date("2026-01-01T00:00:00Z");
    const after = {
      workspaceId: "w",
      taskId: "t",
      status: "todo" as const,
      priority: 1,
      title: "x",
      dueDate,
    };
    const message = codec.encodeChange({
      entity: "Task",
      key: { workspaceId: "w", taskId: "t" },
      before: null,
      after,
      version: 3,
      origin,
    });
    const decoded = topicMessageCodec(tasks).decode(message);
    expect(decoded).toEqual({
      type: "change",
      entity: "Task",
      key: { workspaceId: "w", taskId: "t" },
      before: null,
      after: { workspaceId: "w", taskId: "t", status: "todo", priority: 1 },
      version: 3,
      origin,
    });
    const marker = {
      type: "BATCH_FINISHED" as const,
      origin,
      entity: "Task",
      scope: { workspaceId: "w" },
      count: 2,
      status: "completed" as const,
    };
    expect(codec.decode(codec.encodeBatch(marker))).toEqual({
      type: "batch",
      marker,
    });
    expect(() => codec.decode('{"type":"change","entity":"Other"}')).toThrow();
  });

  it("判別子のある union は、絞っても判別子を残し、別の選択肢と取り違えない", () => {
    const codec = topicMessageCodec(
      unionTasks,
      new Set(["workspaceId", "taskId", "dueDate"]),
    );
    const now = new Date("2026-01-01T00:00:00Z");
    const after = {
      workspaceId: "w",
      taskId: "t",
      kind: "milestone" as const,
      title: "m",
      dueDate: now,
      createdAt: now,
      updatedAt: now,
    };
    const decoded = codec.decode(
      codec.encodeChange({
        entity: "Task",
        key: { workspaceId: "w", taskId: "t" },
        before: null,
        after,
        version: 1,
        origin,
      }),
    );
    expect(decoded.type === "change" && decoded.after).toEqual({
      workspaceId: "w",
      taskId: "t",
      kind: "milestone",
      dueDate: now,
    });
  });
});
