import { describe, expect, expectTypeOf, it } from "vitest";
import { createClient } from "./api";
import { ClientError, isClientError } from "./errors";
import { defineEndpoints } from "@zodapp/zod-dynamodb";
import { endpoints, taskOps } from "./test/app";

type Recorded = { url: string; init: RequestInit };

/** 応答を決めた fetch。送ったリクエストを記録する */
const fakeFetch = (
  respond: (req: Recorded) => Response | Promise<Response>,
) => {
  const calls: Recorded[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    const req = { url, init };
    calls.push(req);
    return respond(req);
  }) as unknown as typeof fetch;
  return { fn, calls };
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const now = new Date("2026-11-05T00:00:00.000Z");
const task = {
  workspaceId: "ws1",
  taskId: "t1",
  title: "a",
  status: "todo" as const,
  priority: 3,
  assignee: "u1",
  createdAt: now,
  updatedAt: now,
};
const taskJson = JSON.parse(JSON.stringify(task));

describe("HTTP の呼び出し", () => {
  it("POST：入力をJSONにしてbodyに入れ、出力を戻す", async () => {
    const { fn, calls } = fakeFetch(() => json(200, { item: taskJson }));
    const client = createClient(endpoints, {
      baseUrl: "https://example.com/api/",
      fetch: fn,
      headers: async () => ({ authorization: "Bearer t" }),
      credentials: "include",
    });
    const item = await client.tasks.get(
      { workspaceId: "ws1", taskId: "t1" },
      { headers: { "x-trace": "1" } },
    );
    expect(item?.createdAt).toEqual(now);
    expectTypeOf(item!.status).toEqualTypeOf<"todo" | "doing" | "done">();
    expect(calls[0]!.url).toBe("https://example.com/api/tasks/get");
    expect(calls[0]!.init.method).toBe("POST");
    expect(calls[0]!.init.credentials).toBe("include");
    expect(calls[0]!.init.headers).toEqual({
      authorization: "Bearer t",
      "x-trace": "1",
      "content-type": "application/json",
    });
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      workspaceId: "ws1",
      taskId: "t1",
    });
  });

  it("GET：パスを埋め、入力全体をクエリ文字列の input に入れる", async () => {
    const { fn, calls } = fakeFetch(() => json(200, { items: [] }));
    const client = createClient(endpoints, { baseUrl: "/api", fetch: fn });
    await client.tasks.byStatusGet(
      { workspaceId: "w 1", status: "todo", minPriority: 2 },
      { limit: 5 },
    );
    const url = new URL(calls[0]!.url, "https://x");
    expect(url.pathname).toBe("/api/workspaces/w%201/tasks");
    expect(JSON.parse(url.searchParams.get("input")!)).toEqual({
      params: { workspaceId: "w 1", status: "todo", minPriority: 2 },
      limit: 5,
    });
    expect(calls[0]!.init.body).toBeUndefined();
  });

  it("送る前の検証に失敗したら、送らずに INVALID_INPUT", async () => {
    const { fn, calls } = fakeFetch(() => json(200, {}));
    const client = createClient(endpoints, { baseUrl: "", fetch: fn });
    const error = await client.tasks
      .get({ workspaceId: "ws1" } as never)
      .catch((e: unknown) => e);
    expect(isClientError(error, "INVALID_INPUT")).toBe(true);
    expect((error as ClientError).issues?.[0]?.path).toEqual(["taskId"]);
    expect(calls).toHaveLength(0);
  });

  it("§7.5 のエラーは、そのコードの ClientError", async () => {
    const { fn } = fakeFetch(() =>
      json(404, {
        code: "NOT_FOUND",
        message: "Itemが存在しないか、条件を満たしていない",
      }),
    );
    const client = createClient(endpoints, { baseUrl: "", fetch: fn });
    const error = await client.tasks
      .setStatus({ workspaceId: "ws1", taskId: "t1" }, { status: "done" })
      .catch((e: unknown) => e);
    expect(isClientError(error, "NOT_FOUND")).toBe(true);
    if (isClientError(error, "NOT_FOUND")) {
      expectTypeOf(error.code).toEqualTypeOf<"NOT_FOUND">();
      expect(error.status).toBe(404);
    }
  });

  it("§7.5 の形でない応答は UNEXPECTED_RESPONSE", async () => {
    const html = fakeFetch(
      () => new Response("<html>blocked</html>", { status: 403 }),
    );
    const a = await createClient(endpoints, { baseUrl: "", fetch: html.fn })
      .tasks.get({ workspaceId: "ws1", taskId: "t1" })
      .catch((e: unknown) => e);
    expect(a).toMatchObject({ code: "UNEXPECTED_RESPONSE", status: 403 });

    const okHtml = fakeFetch(() => new Response("<html/>", { status: 200 }));
    const b = await createClient(endpoints, { baseUrl: "", fetch: okHtml.fn })
      .tasks.get({ workspaceId: "ws1", taskId: "t1" })
      .catch((e: unknown) => e);
    expect(b).toMatchObject({ code: "UNEXPECTED_RESPONSE", status: 200 });
  });

  it("出力がコントラクトに合わなければ INVALID_RESPONSE", async () => {
    const { fn } = fakeFetch(() =>
      json(200, { item: { ...taskJson, status: "unknown" } }),
    );
    const error = await createClient(endpoints, { baseUrl: "", fetch: fn })
      .tasks.get({ workspaceId: "ws1", taskId: "t1" })
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ code: "INVALID_RESPONSE", status: 200 });
  });

  it("通信の失敗は NETWORK、中止は AbortError のまま", async () => {
    const down = fakeFetch(() => {
      throw new TypeError("fetch failed");
    });
    const a = await createClient(endpoints, { baseUrl: "", fetch: down.fn })
      .tasks.get({ workspaceId: "ws1", taskId: "t1" })
      .catch((e: unknown) => e);
    expect(a).toMatchObject({ code: "NETWORK" });

    const controller = new AbortController();
    controller.abort();
    const aborted = fakeFetch((req) => {
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
      return json(200, req);
    });
    const b = await createClient(endpoints, { baseUrl: "", fetch: aborted.fn })
      .tasks.get(
        { workspaceId: "ws1", taskId: "t1" },
        {
          signal: controller.signal,
        },
      )
      .catch((e: unknown) => e);
    expect((b as Error).name).toBe("AbortError");
    expect(isClientError(b)).toBe(false);
  });

  it("pages() は cursor を引き継いで最後まで取る", async () => {
    let n = 0;
    const { fn, calls } = fakeFetch(() => {
      n++;
      return json(200, {
        items: [{ ...taskJson, taskId: `t${n}` }],
        ...(n < 3 ? { cursor: `c${n}` } : {}),
      });
    });
    const client = createClient(endpoints, { baseUrl: "", fetch: fn });
    const ids: string[] = [];
    for await (const page of client.tasks.byStatus.pages({
      workspaceId: "ws1",
      status: "todo",
    })) {
      ids.push(...page.items.map((t) => t.taskId));
    }
    expect(ids).toEqual(["t1", "t2", "t3"]);
    expect(calls.map((c) => JSON.parse(c.init.body as string).cursor)).toEqual([
      undefined,
      "c1",
      "c2",
    ]);
  });

  it("予約された名前のグループはエラー", () => {
    expect(() =>
      createClient(
        defineEndpoints({ context: [{ op: taskOps.get, path: "/x" }] }),
        { baseUrl: "" },
      ),
    ).toThrow(/reserved/);
  });

  it("Get は既定で Item を返し、withToken でトークンも返す。delete は何も返さない", async () => {
    const { fn } = fakeFetch((req) =>
      req.url.endsWith("/tasks/delete")
        ? json(200, {})
        : json(200, { item: taskJson, token: "tok" }),
    );
    const client = createClient(endpoints, { baseUrl: "", fetch: fn });
    const k = { workspaceId: "ws1", taskId: "t1" };
    const withToken = await client.tasks.get(k, { withToken: true });
    expect(withToken.token).toBe("tok");
    expect(withToken.item?.taskId).toBe("t1");
    expect(await client.tasks.remove(k)).toBeUndefined();
    expectTypeOf(client.tasks.remove(k)).toEqualTypeOf<Promise<void>>();
  });
});
