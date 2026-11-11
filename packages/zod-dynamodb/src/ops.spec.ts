import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { appTable, tasks } from "./__fixtures__/tasks";
import { tableConfig } from "./table";
import type { Api, ServerApi, SharedApi } from "./api";
import { DefinitionError } from "./errors";
import { isOp } from "./ops";
import { defineContext } from "./register";
import {
  defineEndpoints,
  parseSubscriptionId,
  subscriptionId,
} from "./register";

type Auth = { userId: string; workspaces: string[] };
const { createOps, override } = defineContext<Auth>();

const taskOps = createOps(tasks, (o) => ({
  get: o.get({
    authorize: (ctx, { key }) => ctx.workspaces.includes(key.workspaceId),
  }),
  create: o.create({
    authorize: (ctx, { key }) => ctx.workspaces.includes(key.workspaceId),
  }),
  remove: o.delete({
    authorize: (ctx, { key }) => ctx.workspaces.includes(key.workspaceId),
    where: () => ({ status: "done" }),
  }),
  setStatus: o.mutation({
    params: z.object({ status: z.enum(["todo", "doing", "done"]) }),
    authorize: (ctx, { key, params }) => {
      expectTypeOf(params.status).toEqualTypeOf<"todo" | "doing" | "done">();
      return ctx.workspaces.includes(key.workspaceId);
    },
    patch: (p) => ({ status: p.status }),
  }),
  byStatus: o.query({
    index: "byStatus",
    params: z.object({
      workspaceId: z.string(),
      status: z.enum(["todo", "doing", "done"]),
    }),
    authorize: (ctx, { params }) => ctx.workspaces.includes(params.workspaceId),
    where: (p) => ({
      partition: { workspaceId: p.workspaceId, status: p.status },
    }),
  }),
  purge: o.delete(),
}));

describe("createOps", () => {
  it("gives each operation its key as a literal name", () => {
    expectTypeOf(taskOps.setStatus.name).toEqualTypeOf<"setStatus">();
    expect(taskOps.setStatus.name).toBe("setStatus");
    expect(taskOps.byStatus.name).toBe("byStatus");
    expect(taskOps.byStatus.index).toBe("byStatus");
    expect(isOp(taskOps.get)).toBe(true);
    expect(isOp({ kind: "get" })).toBe(false);
  });

  it("infers ctx from defineContext", () => {
    createOps(tasks, (o) => ({
      x: o.get({
        authorize: (ctx) => {
          expectTypeOf(ctx).toEqualTypeOf<Auth>();
          return true;
        },
      }),
    }));
  });

  it("tracks whether authorize is present", () => {
    expectTypeOf(taskOps.purge.authorize).toEqualTypeOf<undefined>();
    expect(taskOps.purge.authorize).toBeUndefined();
  });

  it("rejects operations not built by the builder", () => {
    expect(() =>
      createOps(tasks, () => ({ bad: { kind: "get" } as never })),
    ).toThrow(DefinitionError);
  });

  it("override checks its target", () => {
    const o = override(taskOps.setStatus, {
      authorize: (ctx, req, shared) => shared(ctx, req),
    });
    expect(o.op).toBe(taskOps.setStatus);
    expect(() => override({} as never, {} as never)).toThrow(DefinitionError);
  });
});

const endpoints = defineEndpoints({
  tasks: [
    { op: taskOps.get, path: "/tasks/get" },
    { op: taskOps.create, path: "/tasks/create" },
    { op: taskOps.remove, path: "/tasks/delete" },
    { op: taskOps.setStatus, path: "/tasks/set-status" },
    { op: taskOps.byStatus, path: "/tasks/by-status", live: true },
    { op: taskOps.purge },
  ],
});

describe("defineEndpoints", () => {
  it("resolves entries with HTTP and subscription codecs", () => {
    const e = endpoints.entryOf(taskOps.byStatus)!;
    expect(e.group).toBe("tasks");
    expect(e.method).toBe("POST");
    expect(e.endpoint?.path).toBe("/tasks/by-status");
    expect(e.subscription).toBeDefined();
    expect(subscriptionId(e)).toBe("tasks.byStatus");
    expect(parseSubscriptionId("tasks.byStatus")).toEqual({
      group: "tasks",
      name: "byStatus",
    });
    expect(endpoints.entryByName("tasks", "purge")?.serverOnly).toBe(true);
    expect(endpoints.entryOf(taskOps.get)?.endpoint?.withToken).toBe(true);
  });

  it("rejects duplicate names in a group", () => {
    expect(() =>
      defineEndpoints({
        tasks: [{ op: taskOps.get }, { op: taskOps.get }] as never,
      }),
    ).toThrow(/used twice/);
  });

  it("rejects the same operation in two groups", () => {
    expect(() =>
      defineEndpoints({ a: [{ op: taskOps.get }], b: [{ op: taskOps.get }] }),
    ).toThrow(/already registered/);
  });

  it("rejects path or live on a server-only operation", () => {
    expect(() =>
      defineEndpoints({ a: [{ op: taskOps.purge, path: "/x" }] as never }),
    ).toThrow(/server-only/);
  });

  it("rejects live on a non-query", () => {
    expect(() =>
      defineEndpoints({
        a: [{ op: taskOps.get, path: "/x", live: true }] as never,
      }),
    ).toThrow(/only for queries/);
  });

  it("rejects GET on a write", () => {
    expect(() =>
      defineEndpoints({
        a: [{ op: taskOps.create, path: "/x", method: "GET" }] as never,
      }),
    ).toThrow(/GET is only for get, query and search/);
    expect(
      defineEndpoints({
        a: [
          { op: taskOps.get, path: "/g", method: "GET" },
          { op: taskOps.byStatus, path: "/q", method: "GET" },
        ],
      }).entryOf(taskOps.get)?.method,
    ).toBe("GET");
  });

  it("rejects the same method and path, ignoring parameter names", () => {
    expect(() =>
      defineEndpoints({
        a: [
          { op: taskOps.get, path: "/tasks/:id" },
          { op: taskOps.create, path: "/tasks/:key" },
        ],
      }),
    ).toThrow("POST /tasks/:key is used by both a.get and a.create");
    // メソッドが違えば重ならない
    expect(() =>
      defineEndpoints({
        a: [
          { op: taskOps.get, path: "/tasks/:id", method: "GET" },
          { op: taskOps.create, path: "/tasks/:id" },
        ],
      }),
    ).not.toThrow();
  });

  it("rejects operations from different defineContext calls", () => {
    const other = defineContext<Auth>();
    const otherOps = other.createOps(tasks, (o) => ({
      find: o.get({ authorize: () => true }),
    }));
    const mixed = { a: [{ op: taskOps.get }, { op: otherOps.find }] };
    expect(() => defineEndpoints(mixed)).toThrow(
      /different defineContext calls are mixed/,
    );
    // defineContext から得た defineEndpoints は、その defineContext の操作だけ
    expect(() => other.defineEndpoints({ a: [{ op: taskOps.get }] })).toThrow(
      /different defineContext calls are mixed/,
    );
    expect(other.defineEndpoints({ a: [{ op: otherOps.find }] }).mark).toBe(
      defineEndpoints({ a: [{ op: otherOps.find }] }).mark,
    );
    // override も、自分の defineContext の操作だけ
    expect(() =>
      other.override(taskOps.setStatus as never, {} as never),
    ).toThrow(/different defineContext calls are mixed/);
  });
});

describe("Api types", () => {
  type B = Api<typeof endpoints>;
  type S = ServerApi<typeof endpoints>;
  type Task = z.output<typeof tasks.item>;
  const key = { workspaceId: "w", taskId: "t" };

  it("exposes only public operations to the browser", () => {
    expectTypeOf<keyof B["tasks"]>().toEqualTypeOf<
      "get" | "create" | "remove" | "setStatus" | "byStatus"
    >();
    expectTypeOf<keyof S["tasks"]>().toEqualTypeOf<
      "get" | "create" | "remove" | "setStatus" | "byStatus" | "purge"
    >();
  });

  it("types calls and results", () => {
    // 型だけの検査（呼ばない）
    const check = (b: B, s: S) => {
      expectTypeOf(b.tasks.get(key)).toEqualTypeOf<Promise<Task | null>>();
      expectTypeOf(
        b.tasks.get(key, { withToken: true }),
      ).resolves.toHaveProperty("token");
      expectTypeOf(b.tasks.remove(key)).toEqualTypeOf<Promise<void>>();
      expectTypeOf(s.tasks.remove(key)).toEqualTypeOf<Promise<Task | null>>();
      expectTypeOf(b.tasks.setStatus(key, { status: "done" })).toEqualTypeOf<
        Promise<Task>
      >();
      expectTypeOf(
        b.tasks.byStatus({ workspaceId: "w", status: "todo" }, { limit: 10 }),
      ).resolves.toHaveProperty("items");
      expectTypeOf(b.tasks.byStatus).toHaveProperty("live");
      expectTypeOf(s.tasks.byStatus).not.toHaveProperty("live");
      expectTypeOf(b.tasks.setStatus.can).returns.toHaveProperty("ok");
      expectTypeOf(s.tasks.purge).toBeCallableWith(key);
      // @ts-expect-error: params の型が違う
      void b.tasks.setStatus(key, { status: "nope" });
      // @ts-expect-error: context の型が違う
      void s.tasks.get(key, { context: { userId: 1 } });
    };
    expect(typeof check).toBe("function");
  });

  it("SharedApi accepts both the browser and the server API", () => {
    type C = SharedApi<typeof endpoints>;
    expectTypeOf<B>().toExtend<C>();
    expectTypeOf<S>().toExtend<C>();
    expectTypeOf<keyof C["tasks"]>().toEqualTypeOf<
      "get" | "create" | "remove" | "setStatus" | "byStatus"
    >();
    expectTypeOf<C["tasks"]["byStatus"]>().not.toHaveProperty("live");
    expectTypeOf<C["tasks"]["byStatus"]>().toHaveProperty("pages");
  });
});

describe("hooks and generateKey in tableConfig", () => {
  const notes = tableConfig({
    table: appTable,
    entity: "Note",
    item: z.object({
      workspaceId: z.string(),
      noteId: z.string(),
      body: z.string(),
      createdAt: z.date(),
      updatedAt: z.date(),
    }),
    create: z.object({ body: z.string() }),
    key: { partition: ["workspaceId"], sort: ["noteId"] },
    onCreate: ({ now }) => ({ createdAt: now }),
    onWrite: ({ now }) => ({ updatedAt: now }),
    generateKey: {
      args: z.object({ workspaceId: z.string() }),
      key: (args) => ({ workspaceId: args.workspaceId, noteId: "n1" }),
    },
  });

  it("keeps hooks and generateKey on the table", () => {
    expectTypeOf(notes.$createCheck).toEqualTypeOf<true>();
    const now = new Date(0);
    expect(notes.onCreate?.({ now, key: {} })).toEqual({ createdAt: now });
    expect(notes.generateKey?.({ workspaceId: "w" }, { body: "" })).toEqual({
      workspaceId: "w",
      noteId: "n1",
    });
  });

  it("builds set and createWithGeneratedKey operations", () => {
    const noteOps = createOps(notes, (o) => ({
      add: o.createWithGeneratedKey({
        authorize: (ctx, { args }) => {
          expectTypeOf(args).toEqualTypeOf<{ workspaceId: string }>();
          return ctx.workspaces.includes(args.workspaceId);
        },
      }),
      replace: o.set({ authorize: () => true }),
    }));
    const e = defineEndpoints({
      notes: [
        { op: noteOps.add, path: "/notes/add" },
        { op: noteOps.replace, path: "/notes/replace" },
      ],
    });
    expect(e.entryOf(noteOps.add)?.endpoint?.kind).toBe(
      "createWithGeneratedKey",
    );
    const check = (b: Api<typeof e>) => {
      expectTypeOf(b.notes.add).toBeCallableWith(
        { workspaceId: "w" },
        { body: "x" },
      );
      // @ts-expect-error: args が足りない
      void b.notes.add({}, { body: "x" });
    };
    expect(typeof check).toBe("function");
  });

  it("rejects createWithGeneratedKey without generateKey", () => {
    expect(() =>
      createOps(tasks, (o) => ({ add: o.createWithGeneratedKey() })),
    ).toThrow(/generateKey/);
  });

  it("reports a create check error when hooks do not fill the item", () => {
    const t = tableConfig({
      table: appTable,
      entity: "Bad",
      item: z.object({ id: z.string(), createdAt: z.date() }),
      create: z.object({}),
      key: { partition: ["id"] },
    });
    expectTypeOf(t.$createCheck).not.toEqualTypeOf<true>();
  });
});
