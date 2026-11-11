/**
 * 登録簿（defineEndpoints）の型の検査。
 * 実行時の検査は ops.spec.ts にある。ここでは、型エラーになること・ならないことを固定する。
 */
import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { tasks } from "./__fixtures__/tasks";
import type { Api, ServerApi } from "./api";
import { defineContext, defineEndpoints } from "./register";

type AuthA = { userId: string };
type AuthB = { userId: string; admin: boolean };
const a = defineContext<AuthA>();
const b = defineContext<AuthB>();

const opsA = a.createOps(tasks, (o) => ({
  get: o.get({ authorize: () => true }),
  create: o.create({ authorize: () => true }),
  set: o.set({ authorize: () => true }),
  remove: o.delete({ authorize: () => true }),
  setStatus: o.mutation({
    params: z.object({ status: z.enum(["todo", "doing", "done"]) }),
    authorize: () => true,
    patch: (p) => ({ status: p.status }),
  }),
  byStatus: o.query({
    index: "byStatus",
    params: z.object({
      workspaceId: z.string(),
      status: z.enum(["todo", "doing", "done"]),
    }),
    authorize: () => true,
    where: (p) => ({
      partition: { workspaceId: p.workspaceId, status: p.status },
    }),
  }),
  purge: o.delete(),
  internalQuery: o.query({
    index: "byStatus",
    params: z.object({
      workspaceId: z.string(),
      status: z.enum(["todo", "doing", "done"]),
    }),
    where: (p) => ({
      partition: { workspaceId: p.workspaceId, status: p.status },
    }),
  }),
}));

const opsB = b.createOps(tasks, (o) => ({
  get: o.get({ authorize: (ctx) => ctx.admin }),
}));

/** 型だけを確かめる（実行時の DefinitionError は ops.spec.ts で確かめる） */
const typeOnly = (_: () => unknown) => {};

describe("defineEndpoints の型の検査", () => {
  it("サーバー専用の操作に path・live を付けるとエラー", () => {
    typeOnly(() =>
      defineEndpoints({
        // @ts-expect-error サーバー専用の操作に path
        x: [{ op: opsA.purge, path: "/purge" }],
      }),
    );
    typeOnly(() =>
      defineEndpoints({
        // @ts-expect-error サーバー専用の操作に live
        x: [{ op: opsA.internalQuery, live: true }],
      }),
    );
  });

  it("クエリ以外に live を付けるとエラー", () => {
    typeOnly(() =>
      defineEndpoints({
        // @ts-expect-error ミューテーションに live
        x: [{ op: opsA.setStatus, path: "/s", live: true }],
      }),
    );
  });

  it("GET は get・query・search だけ", () => {
    typeOnly(() =>
      defineEndpoints({
        // @ts-expect-error create に GET
        x: [{ op: opsA.create, path: "/c", method: "GET" }],
      }),
    );
    typeOnly(() =>
      defineEndpoints({
        // @ts-expect-error set に GET
        x: [{ op: opsA.set, path: "/s", method: "GET" }],
      }),
    );
    typeOnly(() =>
      defineEndpoints({
        // @ts-expect-error delete に GET
        x: [{ op: opsA.remove, path: "/d", method: "GET" }],
      }),
    );
    typeOnly(() =>
      defineEndpoints({
        // @ts-expect-error mutation に GET
        x: [{ op: opsA.setStatus, path: "/m", method: "GET" }],
      }),
    );
    typeOnly(() =>
      defineEndpoints({
        x: [
          { op: opsA.get, path: "/g", method: "GET" },
          { op: opsA.byStatus, path: "/q", method: "GET", live: true },
        ],
      }),
    );
  });

  it("live の fields は、テーブルのフィールドだけ", () => {
    typeOnly(() =>
      defineEndpoints({
        x: [{ op: opsA.byStatus, live: { fields: { pick: ["title"] } } }],
      }),
    );
    typeOnly(() =>
      defineEndpoints({
        // @ts-expect-error ないフィールド
        x: [{ op: opsA.byStatus, live: { fields: { pick: ["nope"] } } }],
      }),
    );
  });

  it("defineContext から得た defineEndpoints は、別の Auth の操作をエラーにする", () => {
    typeOnly(() =>
      a.defineEndpoints({
        // @ts-expect-error defineContext<AuthB>() の操作（AuthB は AuthA の部分型だが、同じ型ではない）
        x: [{ op: opsB.get }],
      }),
    );
    typeOnly(() =>
      b.defineEndpoints({
        // @ts-expect-error defineContext<AuthA>() の操作
        x: [{ op: opsA.get }],
      }),
    );
    typeOnly(() => a.defineEndpoints({ x: [{ op: opsA.get }] }));
    // 単独の defineEndpoints は、Auth の一致を型では見ない（実行時に確かめる）
    typeOnly(() => defineEndpoints({ x: [{ op: opsB.get }] }));
  });

  it("正しい登録簿では、Api の推論が変わらない", () => {
    const viaContext = a.defineEndpoints({
      tasks: [
        { op: opsA.get, path: "/tasks/get", method: "GET" },
        { op: opsA.byStatus, path: "/tasks/by-status", live: true },
        { op: opsA.purge },
      ],
    });
    const standalone = defineEndpoints({
      tasks: [
        { op: opsA.get, path: "/tasks/get", method: "GET" },
        { op: opsA.byStatus, path: "/tasks/by-status", live: true },
        { op: opsA.purge },
      ],
    });
    expectTypeOf<Api<typeof viaContext>>().toEqualTypeOf<
      Api<typeof standalone>
    >();
    expectTypeOf<ServerApi<typeof viaContext>>().toEqualTypeOf<
      ServerApi<typeof standalone>
    >();
    expectTypeOf<keyof Api<typeof viaContext>["tasks"]>().toEqualTypeOf<
      "get" | "byStatus"
    >();
    expectTypeOf<keyof ServerApi<typeof viaContext>["tasks"]>().toEqualTypeOf<
      "get" | "byStatus" | "purge"
    >();
  });
});
