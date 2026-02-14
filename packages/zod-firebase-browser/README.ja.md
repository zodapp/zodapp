# @zodapp/zod-firebase-browser

> この README は日本語版です。英語版は日本語レビュー・整合性チェック後に翻訳予定です。

## 概要

`@zodapp/zod-firebase-browser` は、`@zodapp/zod-firebase` の `collectionConfig` を使って **ブラウザ（firebase/compat）で Firestore を扱うための実装**を提供します。

- `getAccessor(firestore, collection)`: コレクション定義にバインドされた CRUD / 購読 API
- `queryBuilder(queryParams)`: `SerializableQueryParams` + pagination/cursor から Firestore Query を構築
- `subscriptionCache` による購読共有（同一クエリの subscription を共有）
- GrowingList / React Hooks（`createUseList`, `createUseGrowingList`）

## インストール

```bash
pnpm add @zodapp/zod-firebase-browser
```

## 要件

- `firebase/compat/*`（Firestore）
- Zod v4（型/スキーマは `@zodapp/zod-firebase` 側）

## クイックスタート（アクセサ）

```ts
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import { z } from "zod";
import { collectionConfig } from "@zodapp/zod-firebase";
import { getAccessor } from "@zodapp/zod-firebase-browser";

// firebase.initializeApp(firebaseConfig) 後を想定
const firestore = firebase.firestore();

const taskSchema = z.object({
  title: z.string(),
  done: z.boolean(),
});

const tasks = collectionConfig({
  path: "workspaces/:workspaceId/tasks/:taskId",
  extraIdentityKeys: [],
  schema: taskSchema,
});

const accessor = getAccessor(firestore, tasks);

// リスト購読（queryParams は SDK 非依存の JSON 形式）
const unsubscribe = accessor.querySync(
  { workspaceId: "ws1" },
  { where: [{ field: "done", operator: "==", value: false }] },
  (docs) => {
    console.log("docs", docs);
  },
);

unsubscribe();
```

## `getAccessor()` の戻り値（メソッド一覧）

`getAccessor(firestore, collectionConfig)` は、概ね次のメソッドを返します（型は `collectionConfig` から推論されます）。

- **ドキュメント**
  - **`getDoc(docIdentityParams)`**: `Promise<Data | null>`
  - **`getDocSnapshot(docIdentityParams)`**: `Promise<DocumentSnapshot | null>`
  - **`docSync(docIdentityParams, callback)`**: realtime 購読（`unsubscribe` を返す）
  - **`createDoc(collectionIdentityParams, createData)`**: `Promise<string>`（docId を返す）
  - **`updateDoc(docIdentityParams, partialOrUpdateData)`**: `Promise<void>`（内部では `set({ merge: true })`）
  - **`deleteDoc(docIdentityParams)`**: `Promise<void>`（削除通知用の `set({ merge: true })` 後に `delete()`）
- **クエリ**
  - **`query(collectionIdentityParams, queryFn?)`**: `Promise<Data[]>`
  - **`querySnapshot(collectionIdentityParams, queryFn?)`**: `Promise<DocumentSnapshot[]>`
  - **`querySync(collectionIdentityParams, queryParams, callback)`**: realtime 購読（`unsubscribe`）
  - **`querySnapshotSync(collectionIdentityParams, queryParams, callback)`**: snapshot realtime 購読（`unsubscribe`）
- **変換**
  - **`docToData(doc, identityParams)`**: `Data | null`（Timestamp-like を `Date` に変換）
  - **`docToDataSafe(doc, identityParams)`**: `Data`（存在しない場合は例外）
- **自動バインド**
  - **`mutations`**: `collectionConfig.mutations` を `accessor.mutations.xxx(docIdentityParams, ...args)` として実行可能にしたもの
  - **`queries`**: `collectionConfig.queries` を `accessor.queries.xxx.*` として利用可能にしたもの（詳細は後述）

> `docIdentityParams` / `collectionIdentityParams` は、path の `:param` と `extraIdentityKeys` を合成したものです。

### `mutations` / `queries` 自動バインド（apps/web での例）

`apps/web` では、次のように **作成**や **ドメイン mutation**、**クエリ定義の再利用**をしています:

```ts
const taskAccessor = getAccessor(firestore, tasksCollection);

// create
await taskAccessor.createDoc({ workspaceId, projectId }, data);

// mutation（collectionConfig.mutations から自動生成）
await taskAccessor.mutations.softDelete({ workspaceId, projectId, taskId });

// query params を合成したい場合（GrowingList / 独自where構築用）
const baseWhere = taskAccessor.queries.active.params().where ?? [];
const statusWhere =
  taskAccessor.queries.byStatus.params("todo").where ?? [];
```

`accessor.queries.xxx` は次の形で利用できます:

- **`get(collectionIdentityParams, ...args)`**: `Promise<Data[]>`
- **`getSnapshot(collectionIdentityParams, ...args)`**: `Promise<DocumentSnapshot[]>`
- **`sync(collectionIdentityParams, ...args, callback)`**: realtime 購読（`unsubscribe`）
- **`syncSnapshot(collectionIdentityParams, ...args, callback)`**: snapshot realtime 購読（`unsubscribe`）
- **`params(...args)`**: `SerializableQueryParams`（クエリ条件を「値」として取り出す）

## `queryBuilder()` の詳細

`queryBuilder()` は `SerializableQueryParams` に加えて、cursor/pagination 用のオプションを受け取れます。

```ts
queryBuilder({
  where?: WhereParams[];
  orderBy?: OrderByParams[];
  startAfter?: DocumentSnapshot | unknown[];
  endBefore?: DocumentSnapshot | unknown[];
  startAt?: DocumentSnapshot | unknown[];
  endAt?: DocumentSnapshot | unknown[];
  limit?: number;
  limitToLast?: number;
})
```

- **`startAfter` / `startAt` / `endBefore` / `endAt`**:
  - `DocumentSnapshot` か、`orderBy` と同じ順序の **キー配列**を渡せます
  - キー配列内の `Date` は内部で `Timestamp` に正規化されます
- **`limit` / `limitToLast`**: Firestore の pagination 用

## GrowingList（無限スクロール + realtime 更新のためのユーティリティ）

GrowingList は、Firestore の `limit` + cursor を使った **ページング取得**と、`updatedAt` 等を使った **realtime 更新ストリーム**を組み合わせて、
「増えていくリスト」を扱うための状態管理ユーティリティです。

- **`createGrowingList(db, collection, collectionIdentityParams, query, streamField, streamQuery?)`**
  - `query.orderBy` で安定ソートしつつ、`fetchMore()` でページを追加取得
  - `streamField`（例: `"updatedAt"`）を監視して追加/更新/削除を反映
  - listener が 0 になると一定時間後にストリームを pause して負荷を下げます

React では `createUseGrowingList` / `createUseList` を使ってフックとして利用できます。

## React Hooks（`createUseList` など）

```ts
import { createUseList } from "@zodapp/zod-firebase-browser";

const useList = createUseList(firestore);

// useList({ collection, pathParams, query }) の形で利用
```

## API（抜粋）

- `getAccessor(firestore, collectionConfig)`
- `queryBuilder(queryParams)`
- GrowingList: `createGrowingList`, `createFilteredGrowingList`, `createCachedGrowingList`
- Hooks: `createUseList`, `createUseGrowingList`

## 関連

- `@zodapp/zod-firebase`: コレクション定義（path + Zod schema）
- `@zodapp/caching-utilities`: `subscriptionCache` / `stableStringify`
- `@zodapp/zod-form-firebase`: フォーム向け Firestore resolver

## ライセンス

MIT（[`LICENSE`](../../LICENSE)）

