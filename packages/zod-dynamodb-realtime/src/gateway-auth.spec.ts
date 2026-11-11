import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CLOSE_UNAUTHENTICATED } from "./index";
import { connect, override, startApp, taskOps, tasks } from "./test/app";

let app: Awaited<ReturnType<typeof startApp>>;
beforeAll(async () => {
  app = await startApp();
});
afterAll(async () => {
  await app?.close();
});

let seq = 0;
const ws = () => `auth-w${++seq}`;
const task = () => ({
  title: "a",
  status: "todo" as const,
  priority: 3,
  assignee: "u1",
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const subscribeAll = async (
  c: Awaited<ReturnType<typeof connect>>,
  id: number,
  workspaceId: string,
) => {
  c.send({ type: "subscribe", id, name: "tasks.all", params: { workspaceId } });
  await c.next((m) => m.type === "ready" && m.id === id);
};

describe("Realtime Gateway の認証", () => {
  it("期限が切れたら、次の配信の前に UNAUTHENTICATED を送って接続を閉じる", async () => {
    const w = ws();
    const c = await connect(app.url, `u1@${Date.now() + 300}`);
    await subscribeAll(c, 1, w);
    await sleep(400);
    await app.repository
      .forTable(tasks)
      .create({ workspaceId: w, taskId: "a" }, task());
    expect(
      await c.next((m) => m.type === "error" && m.id === undefined),
    ).toMatchObject({ code: "UNAUTHENTICATED" });
    expect(await c.closed).toBe(CLOSE_UNAUTHENTICATED);
    expect(c.received.some((m) => m.type === "change")).toBe(false);
  });

  it("期限の切れた接続での購読の開始とページも、接続を閉じる", async () => {
    const c = await connect(app.url, `u1@${Date.now() + 200}`);
    await sleep(300);
    c.send({
      type: "subscribe",
      id: 1,
      name: "tasks.all",
      params: { workspaceId: ws() },
    });
    expect(await c.closed).toBe(CLOSE_UNAUTHENTICATED);

    const d = await connect(app.url, `u1@${Date.now() + 300}`);
    await subscribeAll(d, 1, ws());
    await sleep(400);
    d.send({ type: "page", id: 1, limit: 10 });
    expect(await d.closed).toBe(CLOSE_UNAUTHENTICATED);
    expect(d.received.some((m) => m.type === "page")).toBe(false);
  });

  it("auth メッセージで、接続を保ったまま認証の情報を入れ替える", async () => {
    const w = ws();
    const c = await connect(app.url, `u1@${Date.now() + 300}`);
    await subscribeAll(c, 1, w);
    c.send({ type: "auth", payload: { user: `u1@${Date.now() + 60_000}` } });
    await sleep(400); // 最初の期限を過ぎる
    await app.repository
      .forTable(tasks)
      .create({ workspaceId: w, taskId: "a" }, task());
    expect(
      await c.next((m) => m.type === "change" && m.id === 1),
    ).toMatchObject({
      change: "ADDED",
    });
    expect(c.ws.readyState).toBe(c.ws.OPEN);
    c.close();
  });

  it("auth メッセージから認証コンテキストが作れなければ、接続を閉じる", async () => {
    const c = await connect(app.url);
    await subscribeAll(c, 1, ws());
    c.send({ type: "auth", payload: { user: "forged" } });
    expect(await c.closed).toBe(CLOSE_UNAUTHENTICATED);

    const d = await connect(app.url);
    d.send({ type: "auth", payload: { token: 1 } }); // credentialOf が投げる
    expect(await d.closed).toBe(CLOSE_UNAUTHENTICATED);
  });

  it("入れ替えたコンテキストで認可が通らない購読だけを FORBIDDEN で止める", async () => {
    const w = ws();
    const c = await connect(app.url, "admin");
    c.send({
      type: "subscribe",
      id: 1,
      name: "tasks.byStatus",
      params: { workspaceId: "secret", status: "todo" },
    });
    await c.next((m) => m.type === "ready" && m.id === 1);
    await subscribeAll(c, 2, w);
    // 範囲が認証コンテキストで決まる購読は、利用者が変わると続けられない
    c.send({
      type: "subscribe",
      id: 3,
      name: "tasks.mine",
      params: { workspaceId: w },
    });
    await c.next((m) => m.type === "ready" && m.id === 3);

    c.send({ type: "auth", payload: { user: "u2" } });
    expect(await c.next((m) => m.type === "error" && m.id === 1)).toMatchObject(
      {
        code: "FORBIDDEN",
      },
    );
    expect(await c.next((m) => m.type === "error" && m.id === 3)).toMatchObject(
      {
        code: "FORBIDDEN",
      },
    );
    await app.repository
      .forTable(tasks)
      .create({ workspaceId: w, taskId: "a" }, task());
    expect(
      await c.next((m) => m.type === "change" && m.id === 2),
    ).toMatchObject({
      change: "ADDED",
    });
    expect(c.ws.readyState).toBe(c.ws.OPEN);
    c.close();
  });

  it("revalidate は filter に合う接続だけを作り直し、外された人には届かなくなる", async () => {
    const w = ws();
    const alice = await connect(app.url, "alice");
    const bob = await connect(app.url, "bob");
    await subscribeAll(alice, 1, w);
    await subscribeAll(bob, 1, w);

    app.deny(w, "alice");
    app.deny(w, "bob");
    // alice だけを作り直す。bob は作り直すまで、前のコンテキストのまま
    await app.gateway.revalidate((ctx) => ctx.userId === "alice");
    expect(
      await alice.next((m) => m.type === "error" && m.id === 1),
    ).toMatchObject({
      code: "FORBIDDEN",
    });
    await app.repository
      .forTable(tasks)
      .create({ workspaceId: w, taskId: "a" }, task());
    expect(
      await bob.next((m) => m.type === "change" && m.id === 1),
    ).toMatchObject({
      change: "ADDED",
    });
    await sleep(50);
    expect(alice.received.some((m) => m.type === "change")).toBe(false);
    expect(alice.ws.readyState).toBe(alice.ws.OPEN);

    // 全部を作り直す
    await app.gateway.revalidate();
    expect(
      await bob.next((m) => m.type === "error" && m.id === 1),
    ).toMatchObject({
      code: "FORBIDDEN",
    });
    alice.close();
    bob.close();
  });

  it("revalidate は、最後に受け取った認証の情報から作り直す", async () => {
    const c = await connect(app.url, "carol");
    c.send({ type: "auth", payload: { user: "forged" } });
    expect(await c.closed).toBe(CLOSE_UNAUTHENTICATED);

    const d = await connect(app.url, "dan");
    d.send({ type: "auth", payload: { user: `dan@${Date.now() + 200}` } });
    await sleep(300);
    await app.gateway.revalidate((ctx) => ctx.userId === "dan");
    expect(await d.closed).toBe(CLOSE_UNAUTHENTICATED);
  });
});

describe("期限の前の作り直し", () => {
  it("寿命の 8 割で作り直し、接続を保ったまま配信を続ける。作り直しでロールの変更も反映する", async () => {
    const w = ws();
    const before = app.contextCalls.total;
    const c = await connect(app.url, "erin~400");
    await subscribeAll(c, 1, w);
    // 何回か作り直しをまたいでも、配信が続く
    for (let i = 0; i < 3; i++) {
      await sleep(350);
      await app.repository
        .forTable(tasks)
        .create({ workspaceId: w, taskId: `r${i}` }, task());
      expect(
        await c.next((m) => m.type === "change" && m.key.taskId === `r${i}`),
      ).toMatchObject({ change: "ADDED" });
    }
    expect(app.contextCalls.total - before).toBeGreaterThanOrEqual(3);
    expect(c.ws.readyState).toBe(c.ws.OPEN);

    // revalidate を呼ばなくても、次の作り直しで外されたことが反映される
    app.deny(w, "erin");
    expect(
      await c.next((m) => m.type === "error" && m.id === 1, 1000),
    ).toMatchObject({ code: "FORBIDDEN" });
    expect(c.ws.readyState).toBe(c.ws.OPEN);
    c.close();
  });

  it("作り直せなければ（認証を取り消した）、接続を閉じる", async () => {
    const c = await connect(app.url, "fred~300");
    await subscribeAll(c, 1, ws());
    app.block("fred");
    expect(await c.closed).toBe(CLOSE_UNAUTHENTICATED);
  });

  it("認証の情報そのものの期限が来たら、作り直しを繰り返さずに閉じる", async () => {
    const w = ws();
    const before = app.contextCalls.total;
    const c = await connect(app.url, `gail@${Date.now() + 300}`);
    await subscribeAll(c, 1, w);
    await sleep(400);
    // 期限が延びないので、作り直しは 1 回で止まる
    expect(app.contextCalls.total - before).toBeLessThanOrEqual(2);
    await app.repository
      .forTable(tasks)
      .create({ workspaceId: w, taskId: "late" }, task());
    expect(await c.closed).toBe(CLOSE_UNAUTHENTICATED);
  });
});

describe("作り直しの同時実行数", () => {
  let slow: Awaited<ReturnType<typeof startApp>>;
  beforeAll(async () => {
    slow = await startApp({ maxConcurrentRebuilds: 2, contextDelay: 50 });
  });
  afterAll(async () => {
    await slow?.close();
  });

  it("revalidate で一度に作り直すのは maxConcurrentRebuilds まで", async () => {
    const conns = await Promise.all(
      Array.from({ length: 6 }, (_, i) => connect(slow.url, `h${i}`)),
    );
    slow.contextCalls.max = 0;
    await slow.gateway.revalidate();
    expect(slow.contextCalls.max).toBe(2);
    for (const c of conns) {
      expect(c.ws.readyState).toBe(c.ws.OPEN);
      c.close();
    }
  });
});

describe("credentialOf を渡さない Gateway", () => {
  let other: Awaited<ReturnType<typeof startApp>>;
  beforeAll(async () => {
    other = await startApp({ acceptAuth: false });
  });
  afterAll(async () => {
    await other?.close();
  });

  it("auth メッセージは INVALID_INPUT で、接続は続く", async () => {
    const c = await connect(other.url);
    c.send({ type: "auth", payload: { user: "u1" } });
    expect(
      await c.next((m) => m.type === "error" && m.id === undefined),
    ).toMatchObject({ code: "INVALID_INPUT" });
    expect(c.ws.readyState).toBe(c.ws.OPEN);
    c.close();
  });
});

describe("サーバーの上書き", () => {
  let guarded: Awaited<ReturnType<typeof startApp>>;
  beforeAll(async () => {
    guarded = await startApp({
      overrides: [
        override(taskOps.all, {
          authorize: (ctx, req, shared) =>
            shared(ctx, req) && ctx.userId !== "mallory",
        }),
      ],
    });
  });
  afterAll(async () => {
    await guarded?.close();
  });

  it("上書きの authorize が false なら、購読の開始は FORBIDDEN", async () => {
    const c = await connect(guarded.url, "mallory");
    c.send({
      type: "subscribe",
      id: 1,
      name: "tasks.all",
      params: { workspaceId: ws() },
    });
    expect(await c.next((m) => m.type === "error" && m.id === 1)).toMatchObject(
      { code: "FORBIDDEN" },
    );
    // 共有の規則だけなら通る利用者は購読できる
    const d = await connect(guarded.url, "u1");
    await subscribeAll(d, 1, ws());
    c.close();
    d.close();
  });
});
