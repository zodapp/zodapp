import {
  type CollectionConfigBase,
  type QueryOptions,
  resolveScopedQueryOptions,
} from "@zodapp/zod-firebase";
import { subscriptionCache, stableStringify } from "@zodapp/caching-utilities";
import type { z } from "zod";
import { firestore } from "firebase-admin";

type DocumentSnapshot = firestore.DocumentSnapshot;
type DocumentReference = firestore.DocumentReference;
type Query = firestore.Query;
type QuerySnapshot<T = firestore.DocumentData> = firestore.QuerySnapshot<T>;
type Timestamp = firestore.Timestamp;
type Firestore = firestore.Firestore;
type WhereFilterOp = firestore.WhereFilterOp;
type Transaction = firestore.Transaction;
type WriteBatch = firestore.WriteBatch;

/**
 * accessor-level query options: core `QueryOptions` + cursor/pagination (node)
 */
export type AccessorLevelQueryOptions = QueryOptions & {
  startAfter?: DocumentSnapshot | unknown[];
  endBefore?: DocumentSnapshot | unknown[];
  startAt?: DocumentSnapshot | unknown[];
  endAt?: DocumentSnapshot | unknown[];
  limit?: number;
  limitToLast?: number;
};

/**
 * 読み取りを transaction に乗せるための context。
 * `withContext({ runner: transaction })` で束縛する。
 */
export type AccessorReadContext = {
  runner?: Transaction;
};

/**
 * 書き込みを transaction / batch に乗せるための context。
 * `withContext({ runner: batch })` を渡すと write メソッドだけを持つ accessor が返る。
 */
export type AccessorWriteContext = {
  runner?: Transaction | WriteBatch;
};

const isTimestampLike = (value: unknown): value is Timestamp => {
  return typeof value === "object" && value !== null && "toDate" in value;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

// Firestore の戻り値を扱う前提で、Timestamp-like を Date に変換する
// - 循環参照は想定しない（Firestoreの doc.data() は JSON-like な値）
const convertFromFirestore = (value: unknown): unknown => {
  if (isTimestampLike(value)) {
    return value.toDate();
  }

  if (Array.isArray(value)) {
    const arr = value as unknown[];
    for (let i = 0; i < arr.length; i++) {
      arr[i] = convertFromFirestore(arr[i]);
    }
    return arr;
  }

  if (isPlainObject(value)) {
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      obj[key] = convertFromFirestore(obj[key]);
    }
    return obj;
  }

  return value;
};

type FirestoreWriteMode = "create" | "merge";

// Firestore へ書き込む前の正規化
// - merge 書き込み: undefined は FieldValue.delete() に変換（フィールド削除）
// - create 書き込み: undefined はキーごと落とす（add/set without merge で delete sentinel を避ける）
// - 配列内の undefined は Firestore が受け付けないため null にする
const convertForFirestoreWrite = (
  value: unknown,
  mode: FirestoreWriteMode,
): unknown => {
  if (value === undefined) {
    return mode === "merge" ? firestore.FieldValue.delete() : undefined;
  }

  if (Array.isArray(value)) {
    return (value as unknown[]).map((v) => {
      if (v === undefined) {
        return null;
      }
      return convertForFirestoreWrite(v, mode);
    });
  }

  if (isPlainObject(value)) {
    const obj = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(obj).flatMap(([key, v]) => {
        if (v === undefined) {
          return mode === "merge" ? [[key, firestore.FieldValue.delete()]] : [];
        }
        return [[key, convertForFirestoreWrite(v, mode)]];
      }),
    );
  }

  return value;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const collectionAccessorDbCache = new WeakMap<
  Firestore,
  WeakMap<CollectionConfigBase, unknown>
>();

type CollectionAccessorInternal<TConfig extends CollectionConfigBase> = {
  getDoc: (
    docIdentityParams: z.infer<TConfig["documentIdentitySchema"]>,
    context?: AccessorReadContext,
  ) => Promise<z.infer<TConfig["dataSchema"]> | null>;
  getDocSnapshot: (
    docIdentityParams: z.infer<TConfig["documentIdentitySchema"]>,
    context?: AccessorReadContext,
  ) => Promise<DocumentSnapshot | null>;
  docSync: (
    docIdentityParams: z.infer<TConfig["documentIdentitySchema"]>,
    callback: (doc: z.infer<TConfig["dataSchema"]>) => void,
  ) => () => void;
  updateDoc: (
    docIdentityParams: z.infer<TConfig["documentIdentitySchema"]>,
    data: Partial<z.infer<TConfig["dataSchema"]>>,
    context?: AccessorWriteContext,
  ) => Promise<void>;
  createDoc: (
    collectionIdentityParams: z.infer<TConfig["collectionIdentitySchema"]>,
    data: z.infer<TConfig["createSchema"]>,
    context?: AccessorWriteContext,
  ) => Promise<string>;
  createDocWithId: (
    docIdentityParams: z.infer<TConfig["documentIdentitySchema"]>,
    data: z.infer<TConfig["createSchema"]>,
    context?: AccessorWriteContext,
  ) => Promise<string>;
  query: (
    collectionIdentityParams: z.infer<TConfig["collectionIdentitySchema"]>,
    queryOptions?: AccessorLevelQueryOptions,
    context?: AccessorReadContext,
  ) => Promise<z.infer<TConfig["dataSchema"]>[]>;
  querySnapshot: (
    collectionIdentityParams: z.infer<TConfig["collectionIdentitySchema"]>,
    queryOptions?: AccessorLevelQueryOptions,
    context?: AccessorReadContext,
  ) => Promise<DocumentSnapshot[]>;
  querySync: (
    collectionIdentityParams: z.infer<TConfig["collectionIdentitySchema"]>,
    queryParams: QueryOptions,
    callback: (docs: z.infer<TConfig["dataSchema"]>[]) => void,
  ) => () => void;
  querySnapshotSync: (
    collectionIdentityParams: z.infer<TConfig["collectionIdentitySchema"]>,
    queryParams: QueryOptions,
    callback: (snapshot: QuerySnapshot<z.infer<TConfig["dataSchema"]>>) => void,
  ) => () => void;
  deleteDoc: (
    docIdentityParams: z.infer<TConfig["documentIdentitySchema"]>,
    context?: AccessorWriteContext,
  ) => Promise<void>;
  docToData: (
    doc: DocumentSnapshot,
    docIdentityParams:
      | z.infer<TConfig["documentIdentitySchema"]>
      | z.infer<TConfig["collectionIdentitySchema"]>,
  ) => z.infer<TConfig["dataSchema"]> | null;
  docToDataSafe: (
    doc: DocumentSnapshot,
    docIdentityParams:
      | z.infer<TConfig["documentIdentitySchema"]>
      | z.infer<TConfig["collectionIdentitySchema"]>,
  ) => z.infer<TConfig["dataSchema"]>;
};

type CollectionAccessorReadMethods<TConfig extends CollectionConfigBase> = {
  getDoc: (
    docIdentityParams: z.infer<TConfig["documentIdentitySchema"]>,
  ) => Promise<z.infer<TConfig["dataSchema"]> | null>;
  getDocSnapshot: (
    docIdentityParams: z.infer<TConfig["documentIdentitySchema"]>,
  ) => Promise<DocumentSnapshot | null>;
  query: (
    collectionIdentityParams: z.infer<TConfig["collectionIdentitySchema"]>,
    queryOptions?: AccessorLevelQueryOptions,
  ) => Promise<z.infer<TConfig["dataSchema"]>[]>;
  querySnapshot: (
    collectionIdentityParams: z.infer<TConfig["collectionIdentitySchema"]>,
    queryOptions?: AccessorLevelQueryOptions,
  ) => Promise<DocumentSnapshot[]>;
};

type CollectionAccessorWriteMethods<TConfig extends CollectionConfigBase> = {
  updateDoc: (
    docIdentityParams: z.infer<TConfig["documentIdentitySchema"]>,
    data: Partial<z.infer<TConfig["dataSchema"]>>,
  ) => Promise<void>;
  createDoc: (
    collectionIdentityParams: z.infer<TConfig["collectionIdentitySchema"]>,
    data: z.infer<TConfig["createSchema"]>,
  ) => Promise<string>;
  /**
   * document id を呼び出し側で指定して作成する。事前採番した id や、
   * 固定 id (dynamicTable の "live" など) で作りたい場合に使う。
   */
  createDocWithId: (
    docIdentityParams: z.infer<TConfig["documentIdentitySchema"]>,
    data: z.infer<TConfig["createSchema"]>,
  ) => Promise<string>;
  deleteDoc: (
    docIdentityParams: z.infer<TConfig["documentIdentitySchema"]>,
  ) => Promise<void>;
};

type CollectionAccessorSharedMethods<TConfig extends CollectionConfigBase> = {
  docSync: (
    docIdentityParams: z.infer<TConfig["documentIdentitySchema"]>,
    callback: (doc: z.infer<TConfig["dataSchema"]>) => void,
  ) => () => void;
  querySync: (
    collectionIdentityParams: z.infer<TConfig["collectionIdentitySchema"]>,
    queryParams: QueryOptions,
    callback: (docs: z.infer<TConfig["dataSchema"]>[]) => void,
  ) => () => void;
  querySnapshotSync: (
    collectionIdentityParams: z.infer<TConfig["collectionIdentitySchema"]>,
    queryParams: QueryOptions,
    callback: (snapshot: QuerySnapshot<z.infer<TConfig["dataSchema"]>>) => void,
  ) => () => void;
  docToData: (
    doc: DocumentSnapshot,
    docIdentityParams:
      | z.infer<TConfig["documentIdentitySchema"]>
      | z.infer<TConfig["collectionIdentitySchema"]>,
  ) => z.infer<TConfig["dataSchema"]> | null;
  docToDataSafe: (
    doc: DocumentSnapshot,
    docIdentityParams:
      | z.infer<TConfig["documentIdentitySchema"]>
      | z.infer<TConfig["collectionIdentitySchema"]>,
  ) => z.infer<TConfig["dataSchema"]>;
};

type CollectionAccessorWithContext<TConfig extends CollectionConfigBase> = {
  withContext: {
    (): CollectionAccessorResult<TConfig>;
    (context: undefined): CollectionAccessorResult<TConfig>;
    (context: AccessorReadContext): CollectionAccessorResult<TConfig>;
    (context: { runner: Transaction }): CollectionAccessorResult<TConfig>;
    (context: { runner: WriteBatch }): CollectionBatchAccessorResult<TConfig>;
    (
      context: AccessorWriteContext,
    ):
      | CollectionAccessorResult<TConfig>
      | CollectionBatchAccessorResult<TConfig>;
  };
};

/**
 * getAccessor の戻り値型
 * TConfig から各型を抽出してアクセサのメソッド型を定義
 */
export type CollectionAccessorResult<TConfig extends CollectionConfigBase> =
  CollectionAccessorReadMethods<TConfig> &
    CollectionAccessorWriteMethods<TConfig> &
    CollectionAccessorSharedMethods<TConfig> &
    CollectionAccessorWithContext<TConfig>;

/**
 * `withContext({ runner: batch })` が返す accessor。batch は読み取りを持たないため
 * write メソッドのみ。
 */
export type CollectionBatchAccessorResult<
  TConfig extends CollectionConfigBase,
> = CollectionAccessorWriteMethods<TConfig> &
  CollectionAccessorWithContext<TConfig>;

const getAccessorCached = <TConfig extends CollectionConfigBase>(
  db: Firestore,
  config: TConfig,
): CollectionAccessorResult<TConfig> => {
  const cacheForDB =
    collectionAccessorDbCache.get(db) ??
    (() => {
      const accessorCache = new WeakMap<CollectionConfigBase, unknown>();
      collectionAccessorDbCache.set(db, accessorCache);
      return accessorCache;
    })();
  const accessor =
    cacheForDB.get(config) ??
    (() => {
      const newAccessor = createExternalAccessor(
        getAccessorInternal(db, config),
      );
      cacheForDB.set(config, newAccessor);
      return newAccessor;
    })();
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return accessor as CollectionAccessorResult<TConfig>;
};

const extractCursorOptions = (
  options: AccessorLevelQueryOptions | undefined,
): Omit<AccessorLevelQueryOptions, "where" | "orderBy"> | undefined => {
  if (!options) return undefined;
  const { where: _w, orderBy: _o, ...cursor } = options;
  return cursor;
};

const getDocWithContext = async (
  context: AccessorReadContext | undefined,
  ref: DocumentReference,
): Promise<DocumentSnapshot> => {
  if (!context?.runner) {
    return await ref.get();
  }
  return await context.runner.get(ref);
};

const getQueryWithContext = async (
  context: AccessorReadContext | undefined,
  query: Query,
): Promise<QuerySnapshot> => {
  if (!context?.runner) {
    return await query.get();
  }
  return await context.runner.get(query);
};

const isTransactionRunner = (
  runner: AccessorWriteContext["runner"],
): runner is Transaction => {
  return typeof runner === "object" && runner !== null && "get" in runner;
};

const setWithContext = async (
  context: AccessorWriteContext | undefined,
  ref: DocumentReference,
  data: unknown,
  options?: firestore.SetOptions,
) => {
  const writeData = data as firestore.DocumentData;
  if (!context?.runner) {
    if (options) {
      await ref.set(writeData, options);
      return;
    }
    await ref.set(writeData);
    return;
  }
  // Transaction / WriteBatch の union のままでは `set` の overload が呼べないため、narrowing してから呼ぶ。
  if (isTransactionRunner(context.runner)) {
    if (options) {
      context.runner.set(ref, writeData, options);
      return;
    }
    context.runner.set(ref, writeData);
    return;
  }
  if (options) {
    context.runner.set(ref, writeData, options);
    return;
  }
  context.runner.set(ref, writeData);
};

const deleteWithContext = async (
  context: AccessorWriteContext | undefined,
  ref: DocumentReference,
) => {
  if (!context?.runner) {
    await ref.delete();
    return;
  }
  context.runner.delete(ref);
};

const getAccessorInternal = <TConfig extends CollectionConfigBase>(
  db: Firestore,
  config: TConfig,
): CollectionAccessorInternal<TConfig> => {
  // TConfig から型を抽出
  type _DataType = z.infer<TConfig["dataSchema"]>;
  type DocIdentityParams = z.infer<TConfig["documentIdentitySchema"]>;
  type CollIdentityParams = z.infer<TConfig["collectionIdentitySchema"]>;

  type EffectiveQuerySubscriptionParams = {
    collectionIdentityParams: CollIdentityParams;
    effectiveQuery: QueryOptions;
  };
  const querySubscriptionCache = subscriptionCache({
    generator: ({
      collectionIdentityParams,
      effectiveQuery,
    }: EffectiveQuerySubscriptionParams) => ({
      subscribe: (callback: (docs: _DataType[]) => void) => {
        const collectionPath = config.buildCollectionPath(
          collectionIdentityParams,
        );
        const collectionRef = db.collection(collectionPath);
        const query = queryBuilder(effectiveQuery)(collectionRef);
        const unsubscribe = query.onSnapshot((snapshot: QuerySnapshot) => {
          const docs = snapshot.docs.map((doc) =>
            docToDataSafe(doc, collectionIdentityParams),
          );
          callback(docs);
        });
        return () => {
          unsubscribe();
        };
      },
    }),
    retentionTime: 10 * 1000, // 10 seconds
    serializer: (params: EffectiveQuerySubscriptionParams) =>
      stableStringify(params),
  });
  const querySnapshotSubscriptionCache = subscriptionCache({
    generator: ({
      collectionIdentityParams,
      effectiveQuery,
    }: EffectiveQuerySubscriptionParams) => ({
      subscribe: (callback: (snapshot: QuerySnapshot<_DataType>) => void) => {
        const collectionPath = config.buildCollectionPath(
          collectionIdentityParams,
        );
        const collectionRef = db.collection(collectionPath);
        const query = queryBuilder(effectiveQuery)(collectionRef);
        const unsubscribe = query.onSnapshot((snapshot: QuerySnapshot) => {
          callback(snapshot as QuerySnapshot<_DataType>);
        });
        return () => {
          unsubscribe();
        };
      },
    }),
    retentionTime: 10 * 1000, // 10 seconds
    serializer: (params: EffectiveQuerySubscriptionParams) =>
      stableStringify(params),
  });
  const docSubscriptionCache = subscriptionCache({
    generator: (docIdentityParams: DocIdentityParams) => ({
      subscribe: (callback: (doc: _DataType) => void) => {
        const doc = db.doc(config.buildDocumentPath(docIdentityParams));
        const unsubscribe = doc.onSnapshot((snapshot: DocumentSnapshot) => {
          callback(docToDataSafe(snapshot, docIdentityParams));
        });
        return unsubscribe;
      },
    }),
    retentionTime: 10 * 1000, // 10 seconds
    serializer: (docIdentityParams: DocIdentityParams) =>
      stableStringify(docIdentityParams),
  });

  const docToData = (
    doc: DocumentSnapshot,
    docIdentityParams: DocIdentityParams | CollIdentityParams,
  ) => {
    const params = config.parseDocumentPath(doc.ref.path);
    const data = doc.data();
    if (!data) {
      return null;
    }
    if (
      !config.checkNonPathKeys(
        data as Record<string, unknown>,
        docIdentityParams,
      )
    ) {
      throw new Error("Non-path identity keys do not match");
    }
    convertFromFirestore(data);
    return {
      ...params,
      ...data,
    } as _DataType;
  };
  const docToDataSafe = (
    doc: DocumentSnapshot,
    docIdentityParams: DocIdentityParams | CollIdentityParams,
  ) => {
    const data = docToData(doc, docIdentityParams);
    if (!data) {
      throw new Error("Document not found");
    }
    return data;
  };
  return {
    getDoc: async (
      docIdentityParams: DocIdentityParams,
      context?: AccessorReadContext,
    ) => {
      const path = config.buildDocumentPath(docIdentityParams);
      const doc = await getDocWithContext(context, db.doc(path));
      if (!doc) {
        return null;
      }
      return docToData(doc, docIdentityParams);
    },
    getDocSnapshot: async (
      docIdentityParams: DocIdentityParams,
      context?: AccessorReadContext,
    ) => {
      const path = config.buildDocumentPath(docIdentityParams);
      const doc = await getDocWithContext(context, db.doc(path));
      if (!doc) {
        return null;
      }
      return doc;
    },
    docSync: (
      docIdentityParams: DocIdentityParams,
      callback: (doc: _DataType) => void,
    ) => {
      return docSubscriptionCache.subscribe(docIdentityParams, callback);
    },
    updateDoc: async (
      docIdentityParams: DocIdentityParams,
      data: Partial<_DataType>,
      context?: AccessorWriteContext,
    ) => {
      const docPath = config.buildDocumentPath(docIdentityParams);
      let _data = config.beforeWrite(docIdentityParams, data);
      _data = convertForFirestoreWrite(_data, "merge") as typeof _data;
      await setWithContext(context, db.doc(docPath), _data, { merge: true });
    },
    createDoc: async (
      collectionIdentityParams: CollIdentityParams,
      data: z.infer<TConfig["createSchema"]>,
      context?: AccessorWriteContext,
    ) => {
      const collectionPath = config.buildCollectionPath(
        collectionIdentityParams,
      );
      // docId を事前確定（onCreateId またはランダムID）
      const docId =
        config.onCreateId?.(collectionIdentityParams, data) ??
        db.collection(collectionPath).doc().id;
      const documentIdentity = {
        ...collectionIdentityParams,
        [config.documentKey]: docId,
      } as DocIdentityParams;
      // beforeGenerate(documentIdentity, inputData) で onCreate -> onWrite を適用
      let _data = config.beforeGenerate(documentIdentity, data);
      _data = convertForFirestoreWrite(_data, "create") as typeof _data;
      await setWithContext(
        context,
        db.collection(collectionPath).doc(docId),
        _data,
      );
      return docId;
    },
    createDocWithId: async (
      docIdentityParams: DocIdentityParams,
      data: z.infer<TConfig["createSchema"]>,
      context?: AccessorWriteContext,
    ) => {
      const docPath = config.buildDocumentPath(docIdentityParams);
      const docId = String(
        (docIdentityParams as Record<string, unknown>)[config.documentKey],
      );
      // beforeGenerate(documentIdentity, inputData) で onCreate -> onWrite を適用
      let _data = config.beforeGenerate(docIdentityParams, data);
      _data = convertForFirestoreWrite(_data, "create") as typeof _data;
      await setWithContext(context, db.doc(docPath), _data);
      return docId;
    },
    query: async (
      collectionIdentityParams: CollIdentityParams,
      queryOptions?: AccessorLevelQueryOptions,
      context?: AccessorReadContext,
    ) => {
      const effectiveQuery = resolveScopedQueryOptions(
        config,
        collectionIdentityParams as Record<string, unknown>,
        queryOptions,
      );
      const collectionPath = config.buildCollectionPath(
        collectionIdentityParams,
      );
      const collectionRef = db.collection(collectionPath);
      const query = queryBuilder({
        ...effectiveQuery,
        ...extractCursorOptions(queryOptions),
      })(collectionRef);
      const docs = await getQueryWithContext(context, query);
      return docs.docs.map((doc) =>
        docToDataSafe(doc, collectionIdentityParams),
      );
    },
    querySnapshot: async (
      collectionIdentityParams: CollIdentityParams,
      queryOptions?: AccessorLevelQueryOptions,
      context?: AccessorReadContext,
    ) => {
      const effectiveQuery = resolveScopedQueryOptions(
        config,
        collectionIdentityParams as Record<string, unknown>,
        queryOptions,
      );
      const collectionPath = config.buildCollectionPath(
        collectionIdentityParams,
      );
      const collectionRef = db.collection(collectionPath);
      const query = queryBuilder({
        ...effectiveQuery,
        ...extractCursorOptions(queryOptions),
      })(collectionRef);
      const docs = await getQueryWithContext(context, query);
      return docs.docs;
    },
    querySync: (
      collectionIdentityParams: CollIdentityParams,
      queryParams: QueryOptions,
      callback: (docs: _DataType[]) => void,
    ) => {
      const effectiveQuery = resolveScopedQueryOptions(
        config,
        collectionIdentityParams as Record<string, unknown>,
        queryParams,
      );
      return querySubscriptionCache.subscribe(
        {
          collectionIdentityParams,
          effectiveQuery,
        },
        callback,
      );
    },
    querySnapshotSync: (
      collectionIdentityParams: CollIdentityParams,
      queryParams: QueryOptions,
      callback: (snapshot: QuerySnapshot<_DataType>) => void,
    ) => {
      const effectiveQuery = resolveScopedQueryOptions(
        config,
        collectionIdentityParams as Record<string, unknown>,
        queryParams,
      );
      return querySnapshotSubscriptionCache.subscribe(
        {
          collectionIdentityParams,
          effectiveQuery,
        },
        callback,
      );
    },
    deleteDoc: async (
      docIdentityParams: DocIdentityParams,
      context?: AccessorWriteContext,
    ) => {
      const docPath = config.buildDocumentPath(docIdentityParams);
      const docRef = db.doc(docPath);
      if (config.onNotifyDelete) {
        let _data = config.beforeWrite(
          docIdentityParams,
          config.onNotifyDelete(docIdentityParams) ?? {},
        );
        _data = convertForFirestoreWrite(_data, "merge") as typeof _data;
        await setWithContext(context, docRef, _data, { merge: true });
      }
      if (config.onDelete) {
        let _data = config.beforeWrite(
          docIdentityParams,
          config.onDelete(docIdentityParams) ?? {},
        );
        _data = convertForFirestoreWrite(_data, "merge") as typeof _data;
        await setWithContext(context, docRef, _data, { merge: true });
        return;
      }
      await deleteWithContext(context, docRef);
    },
    docToData,
    docToDataSafe,
  };
};

/**
 * core accessor に context (transaction / batch) を束縛した public accessor を作る。
 *
 * - context なし: 通常の accessor (read / write / subscribe すべて)
 * - `runner` が Transaction: read も write も transaction 経由
 * - `runner` が WriteBatch: write メソッドのみ (batch は読み取りを持たない)
 *
 * `withContext` は core を共有したまま context だけ差し替えた accessor を返す。
 */
const createExternalAccessor = <TConfig extends CollectionConfigBase>(
  core: CollectionAccessorInternal<TConfig>,
  context?: AccessorWriteContext,
):
  | CollectionAccessorResult<TConfig>
  | CollectionBatchAccessorResult<TConfig> => {
  const withContext = ((nextContext?: AccessorWriteContext) => {
    return createExternalAccessor(core, nextContext);
  }) as CollectionAccessorResult<TConfig>["withContext"];

  const writeAccessor: CollectionBatchAccessorResult<TConfig> = {
    updateDoc: (docIdentityParams, data) =>
      core.updateDoc(docIdentityParams, data, context),
    createDoc: (collectionIdentityParams, data) =>
      core.createDoc(collectionIdentityParams, data, context),
    createDocWithId: (docIdentityParams, data) =>
      core.createDocWithId(docIdentityParams, data, context),
    deleteDoc: (docIdentityParams) =>
      core.deleteDoc(docIdentityParams, context),
    withContext,
  };

  if (context?.runner && !isTransactionRunner(context.runner)) {
    return writeAccessor;
  }

  const readContext: AccessorReadContext | undefined =
    context?.runner && isTransactionRunner(context.runner)
      ? { runner: context.runner }
      : undefined;

  return {
    getDoc: (docIdentityParams) => core.getDoc(docIdentityParams, readContext),
    getDocSnapshot: (docIdentityParams) =>
      core.getDocSnapshot(docIdentityParams, readContext),
    docSync: core.docSync,
    updateDoc: writeAccessor.updateDoc,
    createDoc: writeAccessor.createDoc,
    createDocWithId: writeAccessor.createDocWithId,
    query: (collectionIdentityParams, queryOptions) =>
      core.query(collectionIdentityParams, queryOptions, readContext),
    querySnapshot: (collectionIdentityParams, queryOptions) =>
      core.querySnapshot(collectionIdentityParams, queryOptions, readContext),
    querySync: core.querySync,
    querySnapshotSync: core.querySnapshotSync,
    deleteDoc: writeAccessor.deleteDoc,
    docToData: core.docToData,
    docToDataSafe: core.docToDataSafe,
    withContext,
  };
};

export const getAccessor = getAccessorCached;

const normalizeKeys = (keys: unknown[] | DocumentSnapshot) => {
  if (Array.isArray(keys)) {
    return keys.map((key) => {
      if (key instanceof Date) {
        return firestore.Timestamp.fromDate(key);
      }
      return key;
    });
  }
  return keys;
};

export const queryBuilder =
  (
    options?: QueryOptions & {
      startAfter?: DocumentSnapshot | unknown[];
      endBefore?: DocumentSnapshot | unknown[];
      startAt?: DocumentSnapshot | unknown[];
      endAt?: DocumentSnapshot | unknown[];
      limit?: number;
      limitToLast?: number;
    },
  ) =>
  (query: Query) => {
    let _query = query;
    for (const where of options?.where ?? []) {
      _query = _query.where(
        where.field,
        where.operator as WhereFilterOp,
        where.value,
      );
    }
    for (const orderBy of options?.orderBy ?? []) {
      _query = _query.orderBy(orderBy.field, orderBy.direction);
    }
    if (options?.startAfter) {
      _query = _query.startAfter(normalizeKeys(options.startAfter));
    }
    if (options?.endBefore) {
      _query = _query.endBefore(normalizeKeys(options.endBefore));
    }
    if (options?.startAt) {
      _query = _query.startAt(normalizeKeys(options.startAt));
    }
    if (options?.endAt) {
      _query = _query.endAt(normalizeKeys(options.endAt));
    }
    if (options?.limit) {
      _query = _query.limit(options.limit);
    }
    if (options?.limitToLast) {
      _query = _query.limitToLast(options.limitToLast);
    }
    return _query;
  };
