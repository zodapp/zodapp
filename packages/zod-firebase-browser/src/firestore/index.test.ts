import { describe, it, expect, expectTypeOf } from "vitest";
import { z } from "zod";
import firebase from "firebase/compat/app";
import {
  collectionConfig,
  createCollectionMutations,
  createCollectionQueries,
  type QueryOptions,
} from "@zodapp/zod-firebase";
import {
  getAccessor,
  getMutationsAccessor,
  getQueriesAccessor,
  type AccessorLevelQueryOptions,
} from "./index";

describe("firestore accessors（@zodapp/zod-firebase-browser）", () => {
  type Tail<T extends unknown[]> = T extends [unknown, ...infer R] ? R : never;

  const taskStatusSchema = z.enum(["todo", "doing", "done"]);
  type TaskStatus = z.infer<typeof taskStatusSchema>;

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
  });

  const taskMutations = createCollectionMutations(tasksCollection, {
    setDueDate: (dueAt: Date) => ({ dueAt }),
  });

  const taskQueries = createCollectionQueries(tasksCollection, {
    active: () => ({
      where: [{ field: "deletedAt", operator: "==" as const, value: null }],
    }),
    byStatus: (status: TaskStatus) => ({
      where: [{ field: "status", operator: "==" as const, value: status }],
    }),
  });

  type DocParams = z.infer<typeof tasksCollection.documentIdentitySchema>;
  type Task = z.infer<typeof tasksCollection.dataSchema>;

  it("正常系: CRUD accessor と query/mutation accessor がそれぞれ型推論される", () => {
    const firestore = {} as unknown as firebase.firestore.Firestore;
    const storeKey = {};
    const taskAccessor = getAccessor(firestore, tasksCollection, storeKey);
    const taskQueriesAccessor = getQueriesAccessor(
      firestore,
      taskQueries,
      storeKey,
    );
    const taskMutationsAccessor = getMutationsAccessor(
      firestore,
      taskMutations,
      storeKey,
    );

    expectTypeOf(taskQueriesAccessor).toHaveProperty("active");
    expectTypeOf(taskQueriesAccessor.active).toHaveProperty("get");
    expectTypeOf(taskQueriesAccessor.active).toHaveProperty("params");
    expectTypeOf(taskMutationsAccessor).toHaveProperty("setDueDate");
    expectTypeOf(taskAccessor.collectionGroupQuery).returns.toEqualTypeOf<
      Promise<Task[]>
    >();
    expectTypeOf(taskAccessor.collectionGroupQuerySnapshot).returns.toEqualTypeOf<
      Promise<firebase.firestore.DocumentSnapshot[]>
    >();

    type ActiveGetTail = Tail<Parameters<typeof taskQueriesAccessor.active.get>>;
    type ByStatusGetTail = Tail<
      Parameters<typeof taskQueriesAccessor.byStatus.get>
    >;
    type SetDueDateTail = Tail<
      Parameters<typeof taskMutationsAccessor.setDueDate>
    >;

    expectTypeOf<ActiveGetTail>().toEqualTypeOf<[]>();
    expectTypeOf<ByStatusGetTail>().toEqualTypeOf<[TaskStatus]>();
    expectTypeOf<SetDueDateTail>().toEqualTypeOf<[Date]>();

    expectTypeOf(taskQueriesAccessor.active.get).returns.toEqualTypeOf<
      Promise<Task[]>
    >();
    expectTypeOf(taskQueriesAccessor.byStatus.get).returns.toEqualTypeOf<
      Promise<Task[]>
    >();
    expectTypeOf(taskQueriesAccessor.active.params).returns.toEqualTypeOf<
      QueryOptions
    >();
    expectTypeOf(taskQueriesAccessor.byStatus.params).returns.toEqualTypeOf<
      QueryOptions
    >();
  });

  it("異常系: bound mutation の引数が違うと型エラーになる（@ts-expect-error）", () => {
    const firestore = {} as unknown as firebase.firestore.Firestore;
    const storeKey = {};
    const taskMutationsAccessor = getMutationsAccessor(
      firestore,
      taskMutations,
      storeKey,
    );
    const docIdentityParams: DocParams = {
      workspaceId: "w1",
      projectId: "p1",
      taskId: "t1",
    };

    if (false as boolean) {
      // @ts-expect-error dueAt が必須
      taskMutationsAccessor.setDueDate(docIdentityParams);

      // @ts-expect-error dueAt は Date
      taskMutationsAccessor.setDueDate(docIdentityParams, "2020-01-01");

      // @ts-expect-error mutations は定義されていないので呼び出せないはず
      taskMutationsAccessor.anything?.({ userId: "123" });
    }

    expect(true).toBe(true);
  });

  it("異常系: empty queries / mutations は accessor から触れない", () => {
    const firestore = {} as unknown as firebase.firestore.Firestore;
    const storeKey = {};
    const bareCollection = collectionConfig({
      path: "/users/:userId" as const,
      fieldKeys: [] as const,
      schema: z.object({
        name: z.string(),
      }),
      createOmitKeys: [] as const,
    });
    const bareQueries = createCollectionQueries(bareCollection, {});
    const bareMutations = createCollectionMutations(bareCollection, {});
    const bareQueriesAccessor = getQueriesAccessor(
      firestore,
      bareQueries,
      storeKey,
    );
    const bareMutationsAccessor = getMutationsAccessor(
      firestore,
      bareMutations,
      storeKey,
    );

    expectTypeOf(bareQueriesAccessor).toEqualTypeOf<Record<string, never>>();
    expectTypeOf(bareMutationsAccessor).toEqualTypeOf<Record<string, never>>();

    if (false as boolean) {
      // @ts-expect-error mutations は定義されていないので呼び出せない
      bareMutationsAccessor.anything();
      // @ts-expect-error queries は定義されていないので get も存在しない
      bareQueriesAccessor.anything.get();
    }
  });

  it("collectionIdentitySchema の型推論（バグ再現テスト）", () => {
    type Actual = z.infer<(typeof tasksCollection)["collectionIdentitySchema"]>;
    type Expected = { workspaceId: string; projectId: string };
    expectTypeOf<Actual>().toEqualTypeOf<Expected>();
  });

  it("正常系: 同一 db + 同一 config + 同一 storeKey は accessor がキャッシュされる", () => {
    const firestore = {} as unknown as firebase.firestore.Firestore;
    const storeKey = {};
    const collectionA1 = getAccessor(firestore, tasksCollection, storeKey);
    const collectionA2 = getAccessor(firestore, tasksCollection, storeKey);
    const queriesA1 = getQueriesAccessor(firestore, taskQueries, storeKey);
    const queriesA2 = getQueriesAccessor(firestore, taskQueries, storeKey);
    const mutationsA1 = getMutationsAccessor(
      firestore,
      taskMutations,
      storeKey,
    );
    const mutationsA2 = getMutationsAccessor(
      firestore,
      taskMutations,
      storeKey,
    );

    expect(collectionA1).toBe(collectionA2);
    expect(queriesA1).toBe(queriesA2);
    expect(mutationsA1).toBe(mutationsA2);
  });

  it("正常系: 同一 db + 同一 config でも storeKey が違えば別 accessor になる", () => {
    const firestore = {} as unknown as firebase.firestore.Firestore;
    const a1 = getQueriesAccessor(firestore, taskQueries, {});
    const a2 = getQueriesAccessor(firestore, taskQueries, {});
    expect(a1).not.toBe(a2);
  });

  it("型テスト: query / querySnapshot は AccessorLevelQueryOptions を受け付ける", () => {
    const firestore = {} as unknown as firebase.firestore.Firestore;
    const storeKey = {};
    const taskAccessor = getAccessor(firestore, tasksCollection, storeKey);

    type QuerySecondArg = Parameters<typeof taskAccessor.query>[1];
    type QuerySnapshotSecondArg = Parameters<typeof taskAccessor.querySnapshot>[1];

    expectTypeOf<QuerySecondArg>().toEqualTypeOf<
      AccessorLevelQueryOptions | undefined
    >();
    expectTypeOf<QuerySnapshotSecondArg>().toEqualTypeOf<
      AccessorLevelQueryOptions | undefined
    >();
  });

  it("型テスト: collectionGroupQuery / collectionGroupQuerySnapshot は AccessorLevelQueryOptions を受け付ける", () => {
    const firestore = {} as unknown as firebase.firestore.Firestore;
    const storeKey = {};
    const taskAccessor = getAccessor(firestore, tasksCollection, storeKey);

    type CGQArg = Parameters<typeof taskAccessor.collectionGroupQuery>[0];
    type CGQSArg = Parameters<typeof taskAccessor.collectionGroupQuerySnapshot>[0];

    expectTypeOf<CGQArg>().toEqualTypeOf<
      AccessorLevelQueryOptions | undefined
    >();
    expectTypeOf<CGQSArg>().toEqualTypeOf<
      AccessorLevelQueryOptions | undefined
    >();
  });

  it("型テスト: querySync / querySnapshotSync は QueryOptions を受け付ける", () => {
    const firestore = {} as unknown as firebase.firestore.Firestore;
    const storeKey = {};
    const taskAccessor = getAccessor(firestore, tasksCollection, storeKey);

    type QuerySyncSecondArg = Parameters<typeof taskAccessor.querySync>[1];
    type QuerySnapshotSyncSecondArg = Parameters<typeof taskAccessor.querySnapshotSync>[1];

    expectTypeOf<QuerySyncSecondArg>().toEqualTypeOf<QueryOptions>();
    expectTypeOf<QuerySnapshotSyncSecondArg>().toEqualTypeOf<QueryOptions>();
  });
});
