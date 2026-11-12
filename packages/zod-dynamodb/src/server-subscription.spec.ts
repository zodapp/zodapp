import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DefinitionError } from "./errors";
import type { ChangeRecord } from "./events";
import { physicalTable } from "./physical";
import { createChangePublisher } from "./publisher";
import { defineContext } from "./register";
import {
  subscribeOnServer,
  type ServerChangeEvent,
} from "./server-subscription";
import { tableConfig } from "./table";
import { memoryTransport } from "./topics";

const { createOps, defineEndpoints } = defineContext<{ userId: string }>();

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

const ops = createOps(tasks, (o) => ({
  /** サーバー専用 */
  all: o.query({
    params: z.object({ ws: z.string() }),
    where: (p) => ({ partition: { workspaceId: p.ws } }),
  }),
  todo: o.query({
    index: "byStatus",
    params: z.object({ ws: z.string() }),
    authorize: () => true,
    where: (p) => ({ partition: { workspaceId: p.ws, status: "todo" } }),
  }),
  get: o.get({ authorize: () => true }),
}));

const endpoints = defineEndpoints({
  server: [{ op: ops.all, live: { fields: { pick: ["title"] } } }],
  tasks: [
    { op: ops.todo, live: true },
    { op: ops.get, path: "/tasks/get" },
  ],
});

type Task = z.output<typeof tasks.item>;
const item = (status: Task["status"], extra: Partial<Task> = {}): Task => ({
  workspaceId: "w",
  taskId: "t1",
  status,
  title: "a",
  note: "n",
  ...extra,
});
const change = (before: Task | null, after: Task | null): ChangeRecord => ({
  entity: "Task",
  key: { workspaceId: (after ?? before)!.workspaceId, taskId: "t1" },
  before,
  after,
  version: 2,
  origin: { kind: "single", id: "o1" },
});

const setup = () => {
  const transport = memoryTransport();
  const publisher = createChangePublisher({ transport, endpoints });
  const publish = async (c: ChangeRecord) => {
    await publisher.onChanges!([c]);
    // memoryTransport は queueMicrotask で届ける
    await new Promise((r) => setTimeout(r, 0));
  };
  return { transport, publish };
};

describe("subscribeOnServer", () => {
  it("サーバー専用の live を購読し、ADDED・MODIFIED・REMOVED を受け取る", async () => {
    const { transport, publish } = setup();
    const events: ServerChangeEvent<typeof tasks>[] = [];
    await subscribeOnServer({
      endpoints,
      transport,
      op: ops.all,
      params: { ws: "w" },
      onChange: (e) => {
        events.push(e);
      },
    });
    await publish(change(null, item("todo")));
    await publish(change(item("todo"), item("done", { title: "b" })));
    await publish(change(item("done"), null));
    // 別のワークスペースは届かない
    await publish(change(null, item("todo", { workspaceId: "x" })));
    expect(events.map((e) => e.type)).toEqual(["ADDED", "MODIFIED", "REMOVED"]);
    // live の fields に絞る（Index のキーは含む）
    expect(events[1]!.item).toEqual({
      workspaceId: "w",
      taskId: "t1",
      title: "b",
    });
    expect(events[2]!.item).toMatchObject({ title: "a" });
    expect(events[2]!.after).toBeNull();
    expect(events[0]!.key).toEqual({ workspaceId: "w", taskId: "t1" });
  });

  it("クエリの範囲（matches）で、出入りを判定する", async () => {
    const { transport, publish } = setup();
    const events: string[] = [];
    await subscribeOnServer({
      endpoints,
      transport,
      op: ops.todo,
      params: { ws: "w" },
      onChange: (e) => {
        events.push(e.type);
      },
    });
    await publish(change(null, item("todo")));
    await publish(change(item("todo"), item("done")));
    await publish(change(null, item("done")));
    expect(events).toEqual(["ADDED", "REMOVED"]);
  });

  it("close のあとは届かず、同じトピックをまた購読できる", async () => {
    const { transport, publish } = setup();
    const events: string[] = [];
    const options = {
      endpoints,
      transport,
      op: ops.all,
      params: { ws: "w" },
      onChange: (e: { type: string }) => {
        events.push(e.type);
      },
    };
    const sub = await subscribeOnServer(options);
    await expect(subscribeOnServer(options)).rejects.toThrow(
      /already subscribed/,
    );
    await sub.close();
    await publish(change(null, item("todo")));
    expect(events).toEqual([]);
    const again = await subscribeOnServer(options);
    await publish(change(null, item("todo")));
    expect(events).toEqual(["ADDED"]);
    await again.close();
  });

  it("onChange の失敗と、形の合わないメッセージは onError に渡す", async () => {
    const { transport, publish } = setup();
    const errors: unknown[] = [];
    const sub = await subscribeOnServer({
      endpoints,
      transport,
      op: ops.all,
      params: { ws: "w" },
      onChange: async () => {
        throw new Error("boom");
      },
      onError: (e) => errors.push(e),
    });
    await publish(change(null, item("todo")));
    await transport.publish(sub.topic, JSON.stringify({ entity: "Task" }));
    await transport.publish(sub.topic, JSON.stringify({ entity: "Other" }));
    await new Promise((r) => setTimeout(r, 0));
    expect(errors).toHaveLength(2);
    expect((errors[0] as Error).message).toBe("boom");
  });

  it("live のない操作は DefinitionError", async () => {
    const { transport } = setup();
    await expect(
      subscribeOnServer({
        endpoints: defineEndpoints({ tasks: [{ op: ops.todo }] }),
        transport,
        op: ops.todo,
        params: { ws: "w" },
        onChange: () => {},
      }),
    ).rejects.toBeInstanceOf(DefinitionError);
  });
});
