import type {
  CollectionConfigBase,
  QueryOptions,
  WhereParams
} from '@zodapp/zod-firebase';
import type {
  CollectionReference,
  DocumentData,
  DocumentSnapshot,
  Firestore,
  Query
} from 'firebase-admin/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { z } from 'zod';

export type AccessorLevelQueryOptions = QueryOptions & {
  startAfter?: DocumentSnapshot<DocumentData> | unknown[];
  endBefore?: DocumentSnapshot<DocumentData> | unknown[];
  startAt?: DocumentSnapshot<DocumentData> | unknown[];
  endAt?: DocumentSnapshot<DocumentData> | unknown[];
  limit?: number;
  limitToLast?: number;
};

type IdentityParams = Record<string, unknown>;
type WriteData = Record<string, unknown>;
type CollectionMutationsLike = {
  mutations: Record<string, (...args: unknown[]) => unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function timestampToDate(value: unknown): unknown {
  if (value instanceof Timestamp) {
    return value.toDate();
  }

  if (Array.isArray(value)) {
    return value.map(timestampToDate);
  }

  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, timestampToDate(item)]));
  }

  return value;
}

function toFirestoreValue(value: unknown, options: { deleteUndefined: boolean }): unknown {
  if (value === undefined) {
    return options.deleteUndefined ? FieldValue.delete() : undefined;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toFirestoreValue(item, { deleteUndefined: false }));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, toFirestoreValue(item, options)])
        .filter(([, item]) => item !== undefined)
    );
  }

  return value;
}

function toFirestoreWriteData(data: WriteData, options: { deleteUndefined: boolean }): WriteData {
  return toFirestoreValue(data, options) as WriteData;
}

function applyWhere(query: Query<DocumentData>, where: WhereParams): Query<DocumentData> {
  return query.where(where.field, where.operator, where.value);
}

function applyQueryOptions(
  baseQuery: CollectionReference<DocumentData> | Query<DocumentData>,
  options?: AccessorLevelQueryOptions
): Query<DocumentData> {
  let query: Query<DocumentData> = baseQuery;

  for (const where of options?.where ?? []) {
    query = applyWhere(query, where);
  }

  for (const orderBy of options?.orderBy ?? []) {
    query = query.orderBy(orderBy.field, orderBy.direction);
  }

  if (options?.startAfter !== undefined) {
    query = Array.isArray(options.startAfter)
      ? query.startAfter(...options.startAfter)
      : query.startAfter(options.startAfter);
  }
  if (options?.startAt !== undefined) {
    query = Array.isArray(options.startAt) ? query.startAt(...options.startAt) : query.startAt(options.startAt);
  }
  if (options?.endBefore !== undefined) {
    query = Array.isArray(options.endBefore)
      ? query.endBefore(...options.endBefore)
      : query.endBefore(options.endBefore);
  }
  if (options?.endAt !== undefined) {
    query = Array.isArray(options.endAt) ? query.endAt(...options.endAt) : query.endAt(options.endAt);
  }
  if (options?.limit !== undefined) {
    query = query.limit(options.limit);
  }
  if (options?.limitToLast !== undefined) {
    query = query.limitToLast(options.limitToLast);
  }

  return query;
}

function getIdentityWithDocumentId<TConfig extends CollectionConfigBase>(
  collection: TConfig,
  collectionIdentity: IdentityParams,
  documentId: string
): IdentityParams {
  return {
    ...collectionIdentity,
    [collection.documentKey]: documentId
  };
}

export function queryBuilder(
  baseQuery: CollectionReference<DocumentData> | Query<DocumentData>,
  options?: AccessorLevelQueryOptions
): Query<DocumentData> {
  return applyQueryOptions(baseQuery, options);
}

export function getAccessor<TConfig extends CollectionConfigBase>(
  db: Firestore,
  collection: TConfig
) {
  type Data = z.infer<TConfig['dataSchema']>;
  type CreateData = z.infer<TConfig['createSchema']>;
  type UpdateData = z.infer<TConfig['updateSchema']>;
  type CollectionIdentity = z.infer<TConfig['collectionIdentitySchema']>;
  type DocumentIdentity = z.infer<TConfig['documentIdentitySchema']>;

  const docToData = (
    doc: DocumentSnapshot<DocumentData>,
    identityParams: DocumentIdentity
  ): Data | null => {
    const data = doc.data();
    if (!data) return null;

    return collection.dataSchema.parse({
      ...(timestampToDate(data) as Record<string, unknown>),
      ...(identityParams as Record<string, unknown>),
      [collection.documentKey]: doc.id
    });
  };

  const docToDataSafe = (doc: DocumentSnapshot<DocumentData>, identityParams: DocumentIdentity): Data => {
    const data = docToData(doc, identityParams);
    if (!data) {
      throw new Error(`Document not found: ${doc.ref.path}`);
    }
    return data;
  };

  return {
    docToData,
    docToDataSafe,
    async getDoc(documentIdentity: DocumentIdentity): Promise<Data | null> {
      const path = collection.buildDocumentPath(documentIdentity);
      const doc = await db.doc(path).get();
      return docToData(doc, documentIdentity);
    },
    async createDoc(collectionIdentity: CollectionIdentity, createData: CreateData): Promise<string> {
      const collectionPath = collection.buildCollectionPath(collectionIdentity);
      const collectionRef = db.collection(collectionPath);
      const createdId = collection.onCreateId?.(collectionIdentity, createData) ?? collectionRef.doc().id;
      const documentIdentity = getIdentityWithDocumentId(
        collection,
        collectionIdentity as Record<string, unknown>,
        createdId
      ) as DocumentIdentity;
      const data = collection.beforeGenerate(documentIdentity, createData);
      await collectionRef
        .doc(createdId)
        .set(toFirestoreWriteData(data, { deleteUndefined: false }));
      return createdId;
    },
    async updateDoc(documentIdentity: DocumentIdentity, updateData: UpdateData): Promise<void> {
      const path = collection.buildDocumentPath(documentIdentity);
      const data = collection.beforeWrite(documentIdentity, updateData);
      await db.doc(path).set(toFirestoreWriteData(data, { deleteUndefined: true }), { merge: true });
    },
    async deleteDoc(documentIdentity: DocumentIdentity): Promise<void> {
      await db.doc(collection.buildDocumentPath(documentIdentity)).delete();
    },
    async query(
      collectionIdentity: CollectionIdentity,
      queryOptions?: AccessorLevelQueryOptions
    ): Promise<Data[]> {
      const collectionPath = collection.buildCollectionPath(collectionIdentity);
      const snapshot = await applyQueryOptions(db.collection(collectionPath), queryOptions).get();
      return snapshot.docs
        .map((doc) =>
          docToData(
            doc,
            getIdentityWithDocumentId(
              collection,
              collectionIdentity as Record<string, unknown>,
              doc.id
            ) as DocumentIdentity
          )
        )
        .filter((data): data is Data => data !== null);
    },
    querySnapshotSync(
      collectionIdentity: CollectionIdentity,
      queryOptions: AccessorLevelQueryOptions | undefined,
      callback: (items: Data[]) => void
    ): () => void {
      const collectionPath = collection.buildCollectionPath(collectionIdentity);
      return applyQueryOptions(db.collection(collectionPath), queryOptions).onSnapshot((snapshot) => {
        callback(
          snapshot.docs
            .map((doc) =>
              docToData(
                doc,
                getIdentityWithDocumentId(
                  collection,
                  collectionIdentity as Record<string, unknown>,
                  doc.id
                ) as DocumentIdentity
              )
            )
            .filter((data): data is Data => data !== null)
        );
      });
    },
    querySync(
      collectionIdentity: CollectionIdentity,
      queryOptions: AccessorLevelQueryOptions | undefined,
      callback: (items: Data[]) => void
    ): () => void {
      return this.querySnapshotSync(collectionIdentity, queryOptions, callback);
    }
  };
}

export function getMutationsAccessor<TConfig extends CollectionConfigBase>(
  accessor: ReturnType<typeof getAccessor<TConfig>>,
  mutations: CollectionMutationsLike
) {
  return Object.fromEntries(
    Object.entries(mutations.mutations).map(([key, mutation]) => [
      key,
      async (documentIdentity: z.infer<TConfig['documentIdentitySchema']>, ...args: unknown[]) => {
        const data = mutation(...args);
        await accessor.updateDoc(documentIdentity, data as z.infer<TConfig['updateSchema']>);
      }
    ])
  );
}
