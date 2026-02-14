# @zodapp/zod-firebase-node

> この README は日本語版です。英語版は日本語レビュー・整合性チェック後に翻訳予定です。

## 概要

`@zodapp/zod-firebase-node` は、`@zodapp/zod-firebase` の `collectionConfig` を使って **Node.js（firebase-admin）で Firestore を扱うための実装**を提供します。

- `getAccessor(db, collection)`: コレクション定義にバインドされた CRUD / 購読 API
- `queryBuilder(options)`: クエリ組み立て

## インストール

```bash
pnpm add @zodapp/zod-firebase-node
```

## 要件

- `firebase-admin`（Firestore）
- Zod v4（型/スキーマは `@zodapp/zod-firebase` 側）

## クイックスタート

```ts
import { z } from "zod";
import { collectionConfig } from "@zodapp/zod-firebase";
import { getAccessor } from "@zodapp/zod-firebase-node";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp({
  // 例: サービスアカウント認証（実運用は環境に合わせて設定）
  credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!)),
});

const db = getFirestore();

const taskSchema = z.object({
  title: z.string(),
  done: z.boolean(),
});

const tasks = collectionConfig({
  path: "workspaces/:workspaceId/tasks/:taskId",
  extraIdentityKeys: [],
  schema: taskSchema,
});

const accessor = getAccessor(db, tasks);

await accessor.createDoc({ workspaceId: "ws1" }, { title: "hello", done: false });
```

## `getAccessor()` の戻り値（メソッド一覧）

`getAccessor(db, collectionConfig)` は、概ね次のメソッドを返します（型は `collectionConfig` から推論されます）。

- **ドキュメント**
  - **`getDoc(docIdentityParams)`**: `Promise<Data | null>`
  - **`createDoc(collectionIdentityParams, createData)`**: `Promise<string>`（docId を返す）
  - **`updateDoc(docIdentityParams, partialOrUpdateData)`**: `Promise<void>`（内部では `set({ merge: true })`）
  - **`deleteDoc(docIdentityParams)`**: `Promise<void>`（`delete()`）
- **クエリ**
  - **`query(collectionIdentityParams, queryFn?)`**: `Promise<Data[]>`
  - **`querySync(collectionIdentityParams, queryFn, callback)`**: realtime 購読（`unsubscribe`）
  - **`querySnapshotSync(collectionIdentityParams, queryFn?, callback)`**: snapshot realtime 購読（`unsubscribe`）
- **変換**
  - **`docToData(doc, identityParams)`**: `Data | null`（Timestamp-like を `Date` に変換）
  - **`docToDataSafe(doc, identityParams)`**: `Data`（存在しない場合は例外）

> `docIdentityParams` / `collectionIdentityParams` は、path の `:param` と `extraIdentityKeys` を合成したものです。

## `queryBuilder()` の詳細

`queryBuilder()` は `where`/`orderBy` と cursor/pagination 用のオプションから `firebase-admin` の `Query` を組み立てます。

```ts
queryBuilder({
  where?: { field: string; operator: WhereFilterOp; value: unknown }[];
  orderBy?: { field: string; direction: "asc" | "desc" }[];
  startAfter?: DocumentSnapshot | unknown[];
  endBefore?: DocumentSnapshot | unknown[];
  startAt?: DocumentSnapshot | unknown[];
  endAt?: DocumentSnapshot | unknown[];
  limit?: number;
  limitToLast?: number;
})
```

## API（抜粋）

- `getAccessor(db, collectionConfig)`
- `queryBuilder(options)`

## 関連

- `@zodapp/zod-firebase`: コレクション定義（path + Zod schema）
- `@zodapp/zod-firebase-browser`: ブラウザ実装（firebase/compat）

## ライセンス

MIT（[`LICENSE`](../../LICENSE)）

