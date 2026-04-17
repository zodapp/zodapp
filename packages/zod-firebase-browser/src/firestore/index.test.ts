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
  type AccessorLevelQueryOptions,
  type AccessorWriteContext,
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
    }),
    createExcludedSchema: z.object({
      createdAt: z.date().optional(),
      updatedAt: z.date().optional(),
    }),
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

  it("正常系: CRUD accessor と query 定義 / mutation accessor がそれぞれ型推論される", () => {
    const firestore = {} as unknown as firebase.firestore.Firestore;
    const storeKey = {};
    const taskAccessor = getAccessor(firestore, tasksCollection, storeKey);
    const taskMutationsAccessor = getMutationsAccessor(
      firestore,
      taskMutations,
      storeKey,
    );
    const activeQuery = taskQueries.queries.active();
    const doneQuery = taskQueries.queries.byStatus("done");

    expect(taskQueries.collection).toBe(tasksCollection);
    expect(activeQuery).toEqual({
      where: [{ field: "deletedAt", operator: "==", value: null }],
    });
    expect(doneQuery).toEqual({
      where: [{ field: "status", operator: "==", value: "done" }],
    });

    expectTypeOf(taskQueries).toHaveProperty("queries");
    expectTypeOf(taskQueries.queries).toHaveProperty("active");
    expectTypeOf(taskQueries.queries).toHaveProperty("byStatus");
    expectTypeOf(taskMutationsAccessor).toHaveProperty("setDueDate");
    expectTypeOf(taskAccessor.collectionGroupQuery).returns.toEqualTypeOf<
      Promise<Task[]>
    >();
    expectTypeOf(
      taskAccessor.collectionGroupQuerySnapshot,
    ).returns.toEqualTypeOf<Promise<firebase.firestore.DocumentSnapshot[]>>();

    type ActiveQueryArgs = Parameters<(typeof taskQueries.queries)["active"]>;
    type ByStatusQueryArgs = Parameters<
      (typeof taskQueries.queries)["byStatus"]
    >;
    type SetDueDateTail = Tail<
      Parameters<typeof taskMutationsAccessor.setDueDate>
    >;

    expectTypeOf<ActiveQueryArgs>().toEqualTypeOf<[]>();
    expectTypeOf<ByStatusQueryArgs>().toEqualTypeOf<[TaskStatus]>();
    expectTypeOf<SetDueDateTail>().toEqualTypeOf<[Date]>();

    expectTypeOf<
      ReturnType<(typeof taskQueries.queries)["active"]>
    >().toMatchTypeOf<QueryOptions>();
    expectTypeOf<
      ReturnType<(typeof taskQueries.queries)["byStatus"]>
    >().toMatchTypeOf<QueryOptions>();
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

  it("異常系: empty queries / mutations は定義から触れない", () => {
    const firestore = {} as unknown as firebase.firestore.Firestore;
    const storeKey = {};
    const bareCollection = collectionConfig({
      path: "/users/:userId" as const,
      fieldKeys: [] as const,
      schema: z.object({
        name: z.string(),
      }),
    });
    const bareQueries = createCollectionQueries(bareCollection, {});
    const bareMutations = createCollectionMutations(bareCollection, {});
    const bareMutationsAccessor = getMutationsAccessor(
      firestore,
      bareMutations,
      storeKey,
    );

    expect(Object.keys(bareQueries.queries)).toEqual([]);
    expectTypeOf(bareMutationsAccessor).toEqualTypeOf<Record<string, never>>();

    if (false as boolean) {
      // @ts-expect-error mutations は定義されていないので呼び出せない
      bareMutationsAccessor.anything();
      // @ts-expect-error queries は定義されていないので呼び出せない
      bareQueries.queries.anything();
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
    expect(mutationsA1).toBe(mutationsA2);
  });

  it("正常系: 同一 db + 同一 config でも storeKey が違えば別 accessor になる", () => {
    const firestore = {} as unknown as firebase.firestore.Firestore;
    const collectionA1 = getAccessor(firestore, tasksCollection, {});
    const collectionA2 = getAccessor(firestore, tasksCollection, {});
    const mutationsA1 = getMutationsAccessor(firestore, taskMutations, {});
    const mutationsA2 = getMutationsAccessor(firestore, taskMutations, {});

    expect(collectionA1).not.toBe(collectionA2);
    expect(mutationsA1).not.toBe(mutationsA2);
  });

  it("型テスト: query / querySnapshot は AccessorLevelQueryOptions を受け付ける", () => {
    const firestore = {} as unknown as firebase.firestore.Firestore;
    const storeKey = {};
    const _taskAccessor = getAccessor(firestore, tasksCollection, storeKey);

    type QueryTail = Tail<Parameters<typeof _taskAccessor.query>>;
    type QuerySnapshotSecondArg = Parameters<
      typeof _taskAccessor.querySnapshot
    >[1];
    type QuerySnapshotTail = Tail<Parameters<typeof _taskAccessor.querySnapshot>>;

    expectTypeOf<QueryTail>().toEqualTypeOf<
      [queryOptions?: AccessorLevelQueryOptions | undefined]
    >();
    expectTypeOf<QuerySnapshotSecondArg>().toEqualTypeOf<
      AccessorLevelQueryOptions | undefined
    >();
    expectTypeOf<QuerySnapshotTail>().toEqualTypeOf<
      [queryOptions?: AccessorLevelQueryOptions | undefined]
    >();
  });

  it("型テスト: collectionGroupQuery / collectionGroupQuerySnapshot は AccessorLevelQueryOptions を受け付ける", () => {
    const firestore = {} as unknown as firebase.firestore.Firestore;
    const storeKey = {};
    const _taskAccessor = getAccessor(firestore, tasksCollection, storeKey);

    type CGQArgs = Parameters<typeof _taskAccessor.collectionGroupQuery>;
    type CGQArg = Parameters<typeof _taskAccessor.collectionGroupQuery>[0];
    type CGQSArgs = Parameters<typeof _taskAccessor.collectionGroupQuerySnapshot>;
    type CGQSArg = Parameters<
      typeof _taskAccessor.collectionGroupQuerySnapshot
    >[0];

    expectTypeOf<CGQArg>().toEqualTypeOf<
      AccessorLevelQueryOptions | undefined
    >();
    expectTypeOf<CGQSArg>().toEqualTypeOf<
      AccessorLevelQueryOptions | undefined
    >();
    expectTypeOf<CGQArgs>().toEqualTypeOf<
      [queryOptions?: AccessorLevelQueryOptions | undefined]
    >();
    expectTypeOf<CGQSArgs>().toEqualTypeOf<
      [queryOptions?: AccessorLevelQueryOptions | undefined]
    >();
  });

  it("型テスト: querySync / querySnapshotSync は QueryOptions を受け付ける", () => {
    const firestore = {} as unknown as firebase.firestore.Firestore;
    const storeKey = {};
    const _taskAccessor = getAccessor(firestore, tasksCollection, storeKey);

    type QuerySyncSecondArg = Parameters<typeof _taskAccessor.querySync>[1];
    type QuerySnapshotSyncSecondArg = Parameters<
      typeof _taskAccessor.querySnapshotSync
    >[1];

    expectTypeOf<QuerySyncSecondArg>().toEqualTypeOf<QueryOptions>();
    expectTypeOf<QuerySnapshotSyncSecondArg>().toEqualTypeOf<QueryOptions>();
  });

  it("型テスト: withContext で transaction は full accessor、batch は write-only accessor になる", () => {
    const firestore = {} as unknown as firebase.firestore.Firestore;
    const storeKey = {};
    const taskAccessor = getAccessor(firestore, tasksCollection, storeKey);
    const transaction = {} as unknown as firebase.firestore.Transaction;
    const batch = {} as unknown as firebase.firestore.WriteBatch;
    const transactionAccessor = taskAccessor.withContext({ runner: transaction });
    const batchAccessor = taskAccessor.withContext({ runner: batch });
    const docIdentityParams: DocParams = {
      workspaceId: "w1",
      projectId: "p1",
      taskId: "t1",
    };

    type WithContextArg = Parameters<typeof taskAccessor.withContext>[0];
    type GetDocTail = Tail<Parameters<typeof taskAccessor.getDoc>>;
    type UpdateDocTail = Tail<Parameters<typeof taskAccessor.updateDoc>>;
    type CreateDocTail = Tail<Parameters<typeof taskAccessor.createDoc>>;
    type DeleteDocTail = Tail<Parameters<typeof taskAccessor.deleteDoc>>;
    type TransactionGetDocTail = Tail<Parameters<typeof transactionAccessor.getDoc>>;
    type BatchCreateDocTail = Tail<Parameters<typeof batchAccessor.createDoc>>;

    expectTypeOf<WithContextArg>().toEqualTypeOf<AccessorWriteContext>();
    expectTypeOf<GetDocTail>().toEqualTypeOf<[]>();
    expectTypeOf<UpdateDocTail>().toEqualTypeOf<[data: Partial<Task>]>();
    expectTypeOf<CreateDocTail>().toEqualTypeOf<
      [data: z.infer<typeof tasksCollection.createSchema>]
    >();
    expectTypeOf<DeleteDocTail>().toEqualTypeOf<[]>();
    expectTypeOf<TransactionGetDocTail>().toEqualTypeOf<[]>();
    expectTypeOf<BatchCreateDocTail>().toEqualTypeOf<
      [data: z.infer<typeof tasksCollection.createSchema>]
    >();

    if (false as boolean) {
      taskAccessor.withContext({ runner: transaction }).getDoc(docIdentityParams);
      taskAccessor
        .withContext({ runner: transaction })
        .getDocSnapshot(docIdentityParams);
      taskAccessor.withContext({ runner: transaction }).query(
        { workspaceId: "w1", projectId: "p1" },
        undefined,
      );
      taskAccessor.withContext({ runner: transaction }).collectionGroupQuery(
        undefined,
      );

      taskAccessor.withContext({ runner: transaction }).createDoc(
        { workspaceId: "w1", projectId: "p1" },
        { title: "task", status: "todo" },
      );
      taskAccessor.withContext({ runner: batch }).createDoc(
        { workspaceId: "w1", projectId: "p1" },
        { title: "task", status: "todo" },
      );
      taskAccessor
        .withContext({ runner: transaction })
        .updateDoc(docIdentityParams, { title: "updated" });
      taskAccessor
        .withContext({ runner: batch })
        .updateDoc(docIdentityParams, { title: "updated" });
      taskAccessor.withContext({ runner: transaction }).deleteDoc(docIdentityParams);
      taskAccessor.withContext({ runner: batch }).deleteDoc(docIdentityParams);
      taskAccessor.withContext({ runner: batch }).withContext({
        runner: transaction,
      }).getDoc(docIdentityParams);

      // @ts-expect-error unbound accessor は context を直接受け取らない
      taskAccessor.getDoc(docIdentityParams, { runner: transaction });
      // @ts-expect-error unbound accessor は context を直接受け取らない
      taskAccessor.createDoc({ workspaceId: "w1", projectId: "p1" }, { title: "task", status: "todo" }, { runner: batch });
      // @ts-expect-error batch accessor に read API はない
      batchAccessor.getDoc(docIdentityParams);
      // @ts-expect-error batch accessor に read API はない
      batchAccessor.query({ workspaceId: "w1", projectId: "p1" }, undefined);
    }

    expect(true).toBe(true);
  });
});
