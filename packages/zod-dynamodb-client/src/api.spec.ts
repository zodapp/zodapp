import { afterEach, describe, expect, expectTypeOf, it } from "vitest";
import { createClient } from "./api";
import { endpoints } from "./test/app";

const key = { workspaceId: "ws1", taskId: "t1" };
const now = new Date();
const task = {
  ...key,
  title: "a",
  status: "todo" as const,
  priority: 3,
  assignee: "u1",
  createdAt: now,
  updatedAt: now,
};
const alice = { userId: "u1", workspaces: ["ws1"] };

const g = globalThis as { window?: unknown };
afterEach(() => {
  delete g.window;
});

describe("can と認証コンテキスト", () => {
  it("明示の context で判定する（入力の検証 → authorize → where）", () => {
    const api = createClient(endpoints, { baseUrl: "" });
    const ok = api.tasks.setStatus.can(
      key,
      { status: "done" },
      {
        context: alice,
        item: task,
      },
    );
    expect(ok).toEqual({ ok: true });
    expectTypeOf(ok.ok).toEqualTypeOf<boolean>();
    expect(
      api.tasks.setStatus.can(
        key,
        { status: "done" },
        {
          context: { ...alice, userId: "u2" },
          item: task,
        },
      ),
    ).toEqual({ ok: false, reason: "CONDITION" });
    expect(
      api.tasks.setStatus.can(
        { workspaceId: "other", taskId: "t1" },
        { status: "done" },
        { context: alice },
      ),
    ).toEqual({ ok: false, reason: "FORBIDDEN" });
    expect(
      api.tasks.setStatus.can(key, { status: "nope" } as never, {
        context: alice,
      }),
    ).toMatchObject({ ok: false, reason: "INVALID_INPUT" });
    // where は item を渡したときだけ見る
    expect(
      api.tasks.setStatus.can(
        key,
        { status: "done" },
        {
          context: { ...alice, userId: "u2" },
        },
      ),
    ).toEqual({ ok: true });
  });

  it("ブラウザでは、グローバルな値を使う", () => {
    g.window = {};
    const api = createClient(endpoints, { baseUrl: "" });
    expect(api.tasks.get.can(key)).toEqual({ ok: false, reason: "NO_CONTEXT" });
    api.context.set(alice);
    expect(api.tasks.get.can(key)).toEqual({ ok: true });
    expect(
      api.tasks.byStatus.can({ workspaceId: "ws1", status: "todo" }),
    ).toEqual({ ok: true });
  });

  it("bind した API は、その認証コンテキストを使う", () => {
    const api = createClient(endpoints, { baseUrl: "" });
    const bound = api.bind(alice);
    expect(bound.tasks.get.can(key)).toEqual({ ok: true });
    expect(
      bound.tasks.get.can(key, {
        context: { userId: "x", workspaces: [] },
      }),
    ).toEqual({ ok: false, reason: "FORBIDDEN" });
  });

  it("context を書いたら、値が undefined / null でも bind やグローバルの値に戻らない", () => {
    g.window = {};
    const api = createClient(endpoints, { baseUrl: "" });
    api.context.set(alice);
    const bound = api.bind(alice);
    for (const a of [api, bound]) {
      expect(a.tasks.get.can(key, { context: undefined })).toEqual({
        ok: false,
        reason: "NO_CONTEXT",
      });
      expect(a.tasks.get.can(key, { context: null } as never)).toEqual({
        ok: false,
        reason: "NO_CONTEXT",
      });
      // キーを書かなければ、いままでどおり
      expect(a.tasks.get.can(key, {})).toEqual({ ok: true });
    }
  });

  it("サーバー（SSR）では、グローバルな値を使えない", () => {
    const api = createClient(endpoints, { baseUrl: "" });
    expect(() => api.context.set(alice)).toThrow(/only for the browser/);
    expect(() => api.tasks.get.can(key)).toThrow(/only for the browser/);
  });
});
