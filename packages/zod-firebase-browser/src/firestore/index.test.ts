import { describe, it, expect, expectTypeOf } from "vitest";
import { z } from "zod";
import firebase from "firebase/compat/app";
import { collectionConfig, type QueryOptions } from "@zodapp/zod-firebase";
import { getAccessor } from "./index";

describe("getAccessor（@zodapp/zod-firebase-browser）", () => {
  type Tail<T extends unknown[]> = T extends [unknown, ...infer R] ? R : never;

  const taskStatusSchema = z.enum(["todo", "doing", "done"]);
  type TaskStatus = z.infer<typeof taskStatusSchema>;

  /**
   * apps/web の `tasksCollection` と同様の形を最小で再現する。
   * - path: /workspaces/:workspaceId/projects/:projectId/tasks/:taskId
   * - queries: active(), byStatus(status)
   * - mutations: setDueDate(dueAt)
   */
  const tasksCollection = collectionConfig({
    path: "/workspaces/:workspaceId/projects/:projectId/tasks/:taskId" as const,
    fieldKeys: [] as const,
    schema: z.object({
      title: z.string(),
      status: taskStatusSchema,
      dueAt: z.date().optional(),
      deletedAt: z.date().nullable().optional(),
      createdAt: z.date().optional(),
      updatedAt: z.date().optional(),
    }),
    createOmitKeys: ["createdAt", "updatedAt"] as const,
    mutations: {
      setDueDate: (dueAt: Date) => ({ dueAt }),
    },
    queries: {
      active: () => ({
        where: [{ field: "deletedAt", operator: "==" as const, value: null }],
      }),
      byStatus: (status: TaskStatus) => ({
        where: [{ field: "status", operator: "==" as const, value: status }],
      }),
    },
  });

  type DocParams = z.infer<typeof tasksCollection.documentIdentitySchema>;
  type Task = z.infer<typeof tasksCollection.dataSchema>;

  it("正常系: bound queries / mutations の「第2引数以降」の型が推論される（collectionIdentitySchema と分離）", () => {
    const firestore = {} as unknown as firebase.firestore.Firestore;
    const taskAccessor = getAccessor(firestore, tasksCollection);

    // accessor の型（queries / mutations がバインドされている）
    expectTypeOf(taskAccessor.queries).toHaveProperty("active");
    expectTypeOf(taskAccessor.queries.active).toHaveProperty("get");
    expectTypeOf(taskAccessor.queries.active).toHaveProperty("params");
    expectTypeOf(taskAccessor.mutations).toHaveProperty("setDueDate");

    // ここでは「第1引数（collectionIdentityParams）」の型は見ない（別テストで扱う）
    // 代わりに「第2引数以降」のみを検証して、mutations/queries 側の推論不具合と切り分ける。
    type ActiveGetTail = Tail<
      Parameters<typeof taskAccessor.queries.active.get>
    >;
    type ByStatusGetTail = Tail<
      Parameters<typeof taskAccessor.queries.byStatus.get>
    >;
    type SetDueDateTail = Tail<
      Parameters<typeof taskAccessor.mutations.setDueDate>
    >;

    expectTypeOf<ActiveGetTail>().toEqualTypeOf<[]>();
    expectTypeOf<ByStatusGetTail>().toEqualTypeOf<[TaskStatus]>();
    expectTypeOf<SetDueDateTail>().toEqualTypeOf<[Date]>();

    // 戻り値（Task[]）は bound query 側の責務なのでここで確認してよい
    expectTypeOf(taskAccessor.queries.active.get).returns.toEqualTypeOf<
      Promise<Task[]>
    >();
    expectTypeOf(taskAccessor.queries.byStatus.get).returns.toEqualTypeOf<
      Promise<Task[]>
    >();

    // .params(...) は QueryOptions を返す（growingList 用）
    expectTypeOf(
      taskAccessor.queries.active.params,
    ).returns.toEqualTypeOf<QueryOptions>();
    expectTypeOf(
      taskAccessor.queries.byStatus.params,
    ).returns.toEqualTypeOf<QueryOptions>();
  });

  it("異常系: bound mutations の引数が違うと型エラーになる（@ts-expect-error）", () => {
    const firestore = {} as unknown as firebase.firestore.Firestore;
    const taskAccessor = getAccessor(firestore, tasksCollection);
    const docIdentityParams: DocParams = {
      workspaceId: "w1",
      projectId: "p1",
      taskId: "t1",
    };

    if (false as boolean) {
      // mutation 引数が不足
      // @ts-expect-error dueAt が必須
      taskAccessor.mutations.setDueDate(docIdentityParams);

      // mutation 引数の型が違う
      // @ts-expect-error dueAt は Date
      taskAccessor.mutations.setDueDate(docIdentityParams, "2020-01-01");

      // @ts-expect-error mutations は定義されていないので呼び出せないはず
      taskAccessor.mutations.anything?.({ userId: "123" });
    }

    // このテスト自体は “型エラーが期待通り発生する” ことを狙うため、
    // ランタイムでは実行しない（上の if(false) ブロックで型チェックさせる）。
    expect(true).toBe(true);
  });

  it("異常系: config に mutations / queries が無い場合は accessor から触れない", () => {
    const firestore = {} as unknown as firebase.firestore.Firestore;
    const bareCollection = collectionConfig({
      path: "/users/:userId" as const,
      fieldKeys: [] as const,
      schema: z.object({
        name: z.string(),
      }),
      createOmitKeys: [] as const,
    });
    const bareAccessor = getAccessor(firestore, bareCollection);

    if (false as boolean) {
      // @ts-expect-error mutations は定義されていないので呼び出せないはず
      bareAccessor.mutations.anything?.({ userId: "123" });

      // @ts-expect-error mutations は定義されていないので呼び出せないはず
      bareAccessor.mutations.anything({ userId: "123" });
    }

    expectTypeOf(bareAccessor.mutations).toEqualTypeOf<Record<string, never>>();
    expectTypeOf(bareAccessor.queries).toEqualTypeOf<Record<string, never>>();

    if (false as boolean) {
      // @ts-expect-error mutations は定義されていないので呼び出せない
      bareAccessor.mutations.anything();
      // @ts-expect-error queries は定義されていないので get も存在しない
      bareAccessor.queries.anything.get();
    }
  });

  it("collectionIdentitySchema の型推論（バグ再現テスト）", () => {
    // apps/web の tasks.tsx では `{ workspaceId, projectId }` を collectionIdentityParams として渡している。
    // 従って collectionIdentitySchema の推論は、この形になるのが期待値。
    type Actual = z.infer<(typeof tasksCollection)["collectionIdentitySchema"]>;
    type Expected = { workspaceId: string; projectId: string };
    expectTypeOf<Actual>().toEqualTypeOf<Expected>();
  });

  it("正常系: 同一 db + 同一 config は accessor がキャッシュされる", () => {
    const firestore = {} as unknown as firebase.firestore.Firestore;
    const a1 = getAccessor(firestore, tasksCollection);
    const a2 = getAccessor(firestore, tasksCollection);
    expect(a1).toBe(a2);
  });
});
