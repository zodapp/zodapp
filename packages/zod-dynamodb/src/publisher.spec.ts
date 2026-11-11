import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { ChangeRecord } from "./events";
import { physicalTable } from "./physical";
import { createChangePublisher, type PublishError } from "./publisher";
import { subscription } from "./subscription";
import { tableConfig } from "./table";
import {
  memoryTransport,
  topicForSubscriber,
  topicMessageCodec,
  topicsForItem,
  type RealtimeTransport,
} from "./topics";
import { defineContext } from "./register";

const { createOps } = defineContext<any>();

const table = physicalTable({
  name: "app",
  primary: { pk: "PK", sk: "SK" },
  indexes: { GSI1: { pk: "PK1", sk: "SK1", projection: "ALL" } },
});

const tasks = tableConfig({
  table,
  entity: "Task",
  item: z.object({
    workspaceId: z.string(),
    taskId: z.string(),
    status: z.enum(["todo", "done"]),
    title: z.string(),
    note: z.string(),
  }),
  create: z.object({}),
  key: { partition: ["workspaceId"], sort: ["taskId"] },
  indexes: {
    byStatus: {
      slot: "GSI1",
      partition: ["workspaceId", "status"],
      sort: ["taskId"],
    },
  },
});

const q = createOps(tasks, (o) => ({
  byStatus: o.query({
    index: "byStatus",
    params: z.object({ ws: z.string(), status: z.enum(["todo", "done"]) }),
    where: (p) => ({ partition: { workspaceId: p.ws, status: p.status } }),
  }),
  all: o.query({
    params: z.object({ ws: z.string() }),
    where: (p) => ({ partition: { workspaceId: p.ws } }),
  }),
}));

const subs = {
  byStatus: subscription(q.byStatus, { fields: { pick: ["title"] } }),
  all: subscription(q.all, { fields: { pick: ["note"] } }),
};

const origin = { kind: "single" as const, id: "o1" };
const item = (status: "todo" | "done", extra = {}) => ({
  workspaceId: "w",
  taskId: "t1",
  status,
  title: "a",
  note: "n",
  ...extra,
});
const change = (
  before: ReturnType<typeof item> | null,
  after: ReturnType<typeof item> | null,
): ChangeRecord => ({
  entity: "Task",
  key: { workspaceId: "w", taskId: "t1" },
  before,
  after,
  version: 2,
  origin,
});

describe("変更の発行", () => {
  it("Index ごとに、Before と After のトピックへ、フィールドを絞って 1 回ずつ発行する", async () => {
    const transport = memoryTransport();
    const publisher = createChangePublisher({ transport, subscriptions: subs });
    await publisher.onChanges!([change(item("todo"), item("done"))]);
    const topics = transport.published.map((p) => p.topic);
    const todo = await topicForSubscriber(
      subs.byStatus,
      { ws: "w", status: "todo" },
      undefined,
    );
    const done = await topicForSubscriber(
      subs.byStatus,
      { ws: "w", status: "done" },
      undefined,
    );
    const all = await topicForSubscriber(subs.all, { ws: "w" }, undefined);
    expect(topics).toContain(todo);
    expect(topics).toContain(done);
    expect(topics).toContain(all);
    // byStatus：2 つの Partition × k=0,1。ベーステーブル：同じ Partition の k=0,1
    expect(new Set(topics).size).toBe(topics.length);
    expect(topics).toHaveLength(6);

    const decode = topicMessageCodec(tasks).decode;
    const onIndex = decode(
      transport.published.find((p) => p.topic === todo)!.message,
    );
    // byStatus の Subscription は title だけ。Index のキー（status）は所属判定に要るので含める
    expect(onIndex.type === "change" && onIndex.after).toEqual({
      workspaceId: "w",
      taskId: "t1",
      status: "done",
      title: "a",
    });
    const onBase = decode(
      transport.published.find((p) => p.topic === all)!.message,
    );
    expect(onBase.type === "change" && onBase.after).toEqual({
      workspaceId: "w",
      taskId: "t1",
      note: "n",
    });
  });

  it("Subscription のない Entity と、Index に入らない変更は発行しない", async () => {
    const transport = memoryTransport();
    const publisher = createChangePublisher({
      transport,
      subscriptions: [subs.byStatus],
    });
    await publisher.onChanges!([
      { ...change(null, item("todo")), entity: "Other" },
    ]);
    expect(transport.published).toHaveLength(0);
  });

  it("一括での書き込みの開始・終了は、範囲から決まるトピックに発行する", async () => {
    const transport = memoryTransport();
    const publisher = createChangePublisher({ transport, subscriptions: subs });
    await publisher.onBatchMarker!({
      type: "BATCH_STARTED",
      origin: { kind: "batch", id: "b1" },
      entity: "Task",
      scope: { workspaceId: "w" },
    });
    // byStatus の Partition は範囲から決まらないので、ベーステーブルの k=0 だけ
    expect(transport.published.map((p) => p.topic)).toEqual([
      await topicForSubscriber(subs.all, { ws: "w" }, undefined),
    ]);
  });

  it("発行の失敗と大きさの超過は onPublishError に渡し、例外にしない", async () => {
    const errors: PublishError[] = [];
    const failing: RealtimeTransport = {
      ...memoryTransport(),
      publish: async () => {
        throw new Error("down");
      },
    };
    const publisher = createChangePublisher({
      transport: failing,
      subscriptions: [subs.all],
      onPublishError: (e) => errors.push(e),
    });
    await publisher.onChanges!([change(null, item("todo"))]);
    expect(errors).toHaveLength(2);
    expect((errors[0]!.error as Error).message).toBe("down");
    expect(errors[0]!.change?.version).toBe(2);

    const big: PublishError[] = [];
    const small = createChangePublisher({
      transport: memoryTransport(),
      subscriptions: [subs.all],
      maxMessageBytes: 10,
      onPublishError: (e) => big.push(e),
    });
    await small.onChanges!([change(null, item("todo"))]);
    expect(big.map((e) => (e.error as Error).name)).toEqual([
      "MessageTooLargeError",
      "MessageTooLargeError",
    ]);
    expect(big.map((e) => e.topic).sort()).toEqual(
      (await topicsForItem(tasks, undefined, item("todo"))).sort(),
    );
  });
});
