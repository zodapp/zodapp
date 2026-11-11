import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { appTable, tasks } from "./__fixtures__/tasks";
import { buildPath, endpoint, type InputOf, type OutputOf } from "./endpoint";
import { DefinitionError } from "./errors";
import { toErrorBody, toErrorCode, ERROR_STATUS } from "./protocol-errors";
import { tableConfig } from "./table";
import { defineContext } from "./register";

const { createOps } = defineContext<any>();

const queries = createOps(tasks, (o) => ({
  byStatus: o.query({
    index: "byStatus",
    params: z.object({
      workspaceId: z.string(),
      status: z.enum(["todo", "doing", "done"]),
    }),
    where: (p) => ({
      partition: { workspaceId: p.workspaceId, status: p.status },
    }),
  }),
  byAssigneeKeys: o.query({
    index: "byAssignee",
    params: z.object({ workspaceId: z.string(), assignee: z.string() }),
    select: "projection",
    where: (p) => ({
      partition: { workspaceId: p.workspaceId, assignee: p.assignee },
    }),
  }),
}));

const mutations = createOps(tasks, (o) => ({
  setStatus: o.mutation({
    params: z.object({ status: z.enum(["todo", "doing", "done"]) }),
  }),
}));

const now = new Date("2026-01-02T03:04:05.000Z");
const todo = {
  workspaceId: "ws1",
  taskId: "t1",
  kind: "todo" as const,
  title: "a",
  status: "todo" as const,
  assignee: "u1",
  priority: 3,
  createdAt: now,
  updatedAt: now,
};

describe("endpoint", () => {
  it("既定のHTTPメソッドはPOST", () => {
    const e = endpoint.get(tasks, { path: "/tasks/get" });
    expect(e.method).toBe("POST");
    expect(e.path).toBe("/tasks/get");
    expect(e.name).toBe("Task");
    const g = endpoint.get(tasks, {
      path: "/tasks/:workspaceId/:taskId",
      method: "GET",
    });
    expect(g.method).toBe("GET");
  });

  it("Getの入力はキーで、出力の Date はJSONの文字列になる", () => {
    const e = endpoint.get(tasks, { path: "/tasks/get" });
    expectTypeOf<InputOf<typeof e>>().toEqualTypeOf<{
      workspaceId: string;
      taskId: string;
    }>();
    const key = { workspaceId: "ws1", taskId: "t1" };
    expect(e.decodeInput(e.encodeInput(key))).toEqual(key);
    expect(() => e.decodeInput({ workspaceId: "ws1" })).toThrow();
    const json = e.encodeOutput({ item: todo }, key) as {
      item: Record<string, unknown>;
    };
    expect(typeof json.item.createdAt).toBe("string");
    const back = e.decodeOutput(JSON.parse(JSON.stringify(json)), key);
    expect(back.item).toEqual(todo);
    expect(e.decodeOutput({ item: null }, key)).toEqual({ item: null });
  });

  it("Mutationの入力はキー・パラメーター・ifUnchanged", () => {
    const e = endpoint.mutation(mutations.setStatus, {
      path: "/tasks/set-status",
    });
    expect(e.name).toBe("setStatus");
    const input = {
      key: { workspaceId: "ws1", taskId: "t1" },
      params: { status: "done" as const },
      ifUnchanged: "tok",
    };
    expect(e.decodeInput(e.encodeInput(input))).toEqual(input);
    expect(() =>
      e.decodeInput({ key: input.key, params: { status: "x" } }),
    ).toThrow();
  });

  it("Queryの fields で、出力のSchemaを返すフィールドに絞る", () => {
    const e = endpoint.query(queries.byStatus, { path: "/tasks/by-status" });
    const input = {
      params: { workspaceId: "ws1", status: "todo" as const },
      fields: { pick: ["title" as const] },
    };
    expect(e.decodeInput(e.encodeInput(input))).toEqual(input);
    // キーと判別子（kind）は常に返す
    const picked = {
      workspaceId: "ws1",
      taskId: "t1",
      kind: "todo" as const,
      title: "a",
    };
    const json = e.encodeOutput(
      { items: [picked as never], cursor: "c" },
      input,
    );
    expect(json).toEqual({ items: [picked], cursor: "c" });
    // 絞らなければ item 全体を検証する
    expect(() =>
      e.encodeOutput({ items: [picked as never] }, { params: input.params }),
    ).toThrow();
    // 存在しないフィールドは入力の検証で拒否する
    expect(() =>
      e.decodeInput({ params: input.params, fields: { pick: ["nope"] } }),
    ).toThrow();
  });

  it("射影のクエリの出力は、キーとIndexのフィールドだけが必須", () => {
    const e = endpoint.query(queries.byAssigneeKeys, { path: "/x" });
    const projected = {
      workspaceId: "ws1",
      taskId: "t1",
      assignee: "u1",
      updatedAt: now,
    };
    const input = { params: { workspaceId: "ws1", assignee: "u1" } };
    const json = e.encodeOutput({ items: [projected as never] }, input);
    expect(e.decodeOutput(json, input).items[0]).toEqual(projected);
    expect(() =>
      e.encodeOutput(
        { items: [{ workspaceId: "ws1", taskId: "t1" } as never] },
        input,
      ),
    ).toThrow();
  });

  it("Date・bigint・Set・Map を含む値を往復できる", () => {
    const item = z.object({
      id: z.string(),
      at: z.date(),
      big: z.bigint(),
      tags: z.set(z.string()),
      counts: z.map(z.string(), z.number()),
    });
    const things = tableConfig({
      table: appTable,
      entity: "Thing",
      item,
      create: item.omit({ id: true }),
      key: { partition: ["id"] },
    });
    const e = endpoint.create(things, { path: "/things/create" });
    const value = {
      key: { id: "x" },
      input: {
        at: now,
        big: 12345678901234567890n,
        tags: new Set(["a", "b"]),
        counts: new Map([["a", 1]]),
      },
    };
    const json = JSON.parse(JSON.stringify(e.encodeInput(value)));
    expect(json.input.big).toBe("12345678901234567890");
    expect(e.decodeInput(json)).toEqual(value);
    const out = { item: { id: "x", ...value.input } };
    const outJson = JSON.parse(JSON.stringify(e.encodeOutput(out, value)));
    expect(e.decodeOutput(outJson, value)).toEqual(out);
  });

  it("出力の型", () => {
    const e = endpoint.query(queries.byStatus, { path: "/x" });
    expectTypeOf<
      OutputOf<typeof e>["items"][number]["kind"]
    >().toEqualTypeOf<"todo">();
  });
});

describe("buildPath", () => {
  it("パスのパラメーターを入力で埋める", () => {
    expect(
      buildPath("/tasks/:workspaceId/:taskId", {
        workspaceId: "w 1",
        taskId: "t/1",
      }),
    ).toBe("/tasks/w%201/t%2F1");
    expect(
      buildPath("/tasks/:workspaceId/status", {
        key: { workspaceId: "w1", taskId: "t1" },
      }),
    ).toBe("/tasks/w1/status");
    expect(buildPath("/q/:workspaceId", { params: { workspaceId: "w" } })).toBe(
      "/q/w",
    );
    expect(() => buildPath("/tasks/:missing", {})).toThrow(DefinitionError);
  });
});

describe("エラーコード", () => {
  const named = (name: string) => Object.assign(new Error("x"), { name });

  it("エラーの名前から求める", () => {
    expect(toErrorCode(named("ItemNotFoundError"))).toBe("NOT_FOUND");
    expect(toErrorCode(named("ConditionFailedError"))).toBe("NOT_FOUND");
    expect(toErrorCode(named("ItemAlreadyExistsError"))).toBe("ALREADY_EXISTS");
    expect(toErrorCode(named("ConflictError"))).toBe("CONFLICT");
    expect(toErrorCode(named("StaleItemError"))).toBe("CONFLICT");
    expect(toErrorCode(named("InvalidCursorError"))).toBe("INVALID_CURSOR");
    expect(toErrorCode(named("ValidationError"))).toBe("INVALID_INPUT");
    expect(toErrorCode(new Error("boom"))).toBe("INTERNAL");
    expect(toErrorCode("not an error")).toBe("INTERNAL");
    expect(ERROR_STATUS.NOT_FOUND).toBe(404);
  });

  it("ItemがないときとWhereが成り立たないときは同じbody", () => {
    expect(toErrorBody(named("ItemNotFoundError"))).toEqual(
      toErrorBody(named("ConditionFailedError")),
    );
  });

  it("INVALID_INPUT には Zod の issue を入れ、INTERNAL はメッセージを返さない", () => {
    const parsed = z.object({ a: z.string() }).safeParse({ a: 1 });
    const body = toErrorBody(parsed.error);
    expect(body.code).toBe("INVALID_INPUT");
    expect(body.issues?.[0]?.path).toEqual(["a"]);
    expect(toErrorBody(new Error("secret")).message).not.toContain("secret");
  });
});
