import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { memoryTransport } from "@zodapp/zod-dynamodb";
import { createRepository, createServerApi } from "@zodapp/zod-dynamodb-node";
import { createRealtimeGateway } from "./index";
import { connect, endpoints, startApp, tasks } from "./test/app";
import { localClient } from "./test/local";

const client = localClient();

type App = Awaited<ReturnType<typeof startApp>>;

/** 接続を試み、失敗したら upgrade の応答のステータスを返す */
const statusOf = async (
  url: string,
  headers: Record<string, string>,
): Promise<number | "open"> => {
  try {
    const c = await connect(url, "u1", headers);
    c.close();
    return "open";
  } catch (error) {
    const m = /Unexpected server response: (\d+)/.exec(String(error));
    if (!m) throw error;
    return Number(m[1]);
  }
};

describe("Origin の確認", () => {
  let list: App;
  let fn: App;
  let none: App;
  beforeAll(async () => {
    [list, fn, none] = await Promise.all([
      startApp({ gateway: { origin: ["https://app.example.com"] } }),
      startApp({
        gateway: { origin: (origin) => origin.endsWith(".example.com") },
      }),
      startApp(),
    ]);
  });
  afterAll(async () => {
    await Promise.all([list?.close(), fn?.close(), none?.close()]);
  });

  it("配列：完全一致のオリジンだけ通し、ほかは 403", async () => {
    const before = list.contextCalls.total;
    expect(
      await statusOf(list.url, { origin: "https://app.example.com" }),
    ).toBe("open");
    expect(await statusOf(list.url, { origin: "https://evil.example" })).toBe(
      403,
    );
    expect(
      await statusOf(list.url, { origin: "https://app.example.com/" }),
    ).toBe(403);
    // 拒否したリクエストでは、認証コンテキストを作らない
    expect(list.contextCalls.total - before).toBe(1);
  });

  it("関数：判定が true のオリジンだけ通す", async () => {
    expect(await statusOf(fn.url, { origin: "https://a.example.com" })).toBe(
      "open",
    );
    expect(await statusOf(fn.url, { origin: "https://example.org" })).toBe(403);
  });

  it("Origin ヘッダーのないリクエストは通す", async () => {
    expect(await statusOf(list.url, {})).toBe("open");
    expect(await statusOf(fn.url, {})).toBe("open");
  });

  it("origin を省けば確かめない", async () => {
    expect(await statusOf(none.url, { origin: "https://evil.example" })).toBe(
      "open",
    );
  });
});

describe("接続ごとの購読数の上限", () => {
  let app: App;
  beforeAll(async () => {
    app = await startApp({ gateway: { maxSubscriptionsPerConnection: 2 } });
  });
  afterAll(async () => {
    await app?.close();
  });

  it("上限を超えた購読は INVALID_INPUT。解除すればまた購読できる", async () => {
    const c = await connect(app.url);
    const sub = (id: number) =>
      c.send({
        type: "subscribe",
        id,
        name: "tasks.all",
        params: { workspaceId: `limit-${id}` },
      });
    // 認可の途中の購読も数える
    sub(1);
    sub(2);
    sub(3);
    expect(await c.next((m) => m.type === "error" && m.id === 3)).toMatchObject(
      {
        code: "INVALID_INPUT",
        message: "too many subscriptions on this connection",
      },
    );
    await c.next((m) => m.type === "ready" && m.id === 1);
    await c.next((m) => m.type === "ready" && m.id === 2);

    c.send({ type: "unsubscribe", id: 1 });
    sub(4);
    expect(await c.next((m) => m.id === 4)).toMatchObject({ type: "ready" });
    expect(c.ws.readyState).toBe(c.ws.OPEN);
    c.close();
  });
});

describe("context のないサーバーの API", () => {
  it("live のクエリがあれば、Gateway を作れない", () => {
    const api = createServerApi(endpoints, {
      repository: createRepository({ tables: { tasks }, dynamodb: client }),
    });
    expect(() =>
      createRealtimeGateway({ api, transport: memoryTransport() }),
    ).toThrow(/needs the context option/);
  });
});
