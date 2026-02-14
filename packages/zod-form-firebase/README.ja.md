# @zodapp/zod-form-firebase

> この README は日本語版です。英語版は日本語レビュー・整合性チェック後に翻訳予定です。

## 概要

`@zodapp/zod-form-firebase` は、`@zodapp/zod-form` の外部キー/ファイル機能を **Firebase（Firestore / Storage）で解決するための resolver** を提供します。

- `createFirestoreResolver`: 外部キー選択肢を Firestore から購読して取得
- `createFirebaseStorageResolver`: Firebase Storage へのアップロード/ダウンロードURL取得/削除

UI 側（`Dynamic`）から resolver を呼べるようにするには、`ZodFormContextProvider` に resolver 配列を渡します。

## インストール

```bash
pnpm add @zodapp/zod-form-firebase
```

## 要件

- ブラウザ実装は `firebase/compat/*` を利用（Firestore / Storage のインスタンスが必要）

## クイックスタート

### 1) resolver を用意して Context に渡す

```tsx
import { createFirestoreResolver, createFirebaseStorageResolver } from "@zodapp/zod-form-firebase";
import type { ExternalKeyResolvers, FileResolvers } from "@zodapp/zod-form";
import { ZodFormContextProvider } from "@zodapp/zod-form-react";

// 例: firebase/compat で初期化済みのインスタンス（プロジェクトに合わせて用意）
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/storage";

// firebase.initializeApp(firebaseConfig) 後を想定
const firestore = firebase.firestore();
const storage = firebase.storage();

const externalKeyResolvers: ExternalKeyResolvers = [
  createFirestoreResolver({
    db: firestore,
    conditions: {
      usersInWorkspace: {
        identityParams: { workspaceId: "ws1" },
        where: [{ field: "deleted", operator: "==", value: false }],
      },
    },
  }),
];

const fileResolvers: FileResolvers = [
  createFirebaseStorageResolver({
    storage,
    locations: {
      public: { parentPath: "uploads" },
    },
  }),
];

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <ZodFormContextProvider
      merge
      externalKeyResolvers={externalKeyResolvers}
      fileResolvers={fileResolvers}
    >
      {children}
    </ZodFormContextProvider>
  );
};
```

### 2) スキーマ側で externalKey / file を設定する

```ts
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { collectionConfig } from "@zodapp/zod-firebase";

// 外部キーで参照したいコレクション（label/value に使うフィールドを指定）
const userSchema = z
  .object({
    userId: z.string(),
    name: z.string(),
    deleted: z.boolean().optional(),
  })
  .register(zf.object.registry, {});

const usersConfig = collectionConfig({
  path: "workspaces/:workspaceId/users/:userId",
  extraIdentityKeys: [],
  schema: userSchema,
  externalKeyConfig: { labelField: "name", valueField: "userId" },
});

export const formSchema = z
  .object({
    // Firestore 外部キー
    assigneeId: zf.externalKey().register(zf.externalKey.registry, {
      label: "担当者",
      externalKeyConfig: {
        type: "firestore",
        conditionId: "usersInWorkspace",
        collectionConfig: usersConfig,
      },
    }),

    // Firebase Storage ファイル
    avatarUrl: zf.file().register(zf.file.registry, {
      label: "アバター",
      fileConfig: {
        type: "firebaseStorage",
        storageLocationId: "public",
        mimeTypes: ["image/*"],
        maxSize: 5 * 1024 ** 2,
      },
    }),
  })
  .register(zf.object.registry, {});
```

## オプション / 型（補足）

### `FirestoreCondition`

`createFirestoreResolver({ conditions })` に渡す `conditions[conditionId]` は次の形です:

- `identityParams`: `querySync` の第1引数（collectionIdentityParams）に渡す値
- `where?`: Firestore の `where` 条件（`WhereParams[]`）
- `filter?`: **クライアントサイド追加フィルタ**（購読結果に対して `Array.prototype.filter` で適用）

`filter` は Firestore のクエリで表現できない条件を補う用途や、条件を増やしすぎずに UI 側で絞りたい場合に使えます。

### `FirebaseStorageLocation`

`createFirebaseStorageResolver({ locations })` の各ロケーションは次の形です:

- `parentPath`: 保存先ディレクトリ
- `bucket?`: 保存先バケット（省略時は `storage.app.options.storageBucket` を使用）

## apps/web 使用例

`apps/web/src/pages/taskManager-project/tasks.tsx` / `apps/web/src/pages/taskManager-project/task/detail.tsx` では、外部キー（担当者選択）のために次のように resolver を用意しています:

```ts
createFirestoreResolver({
  db: firestore,
  conditions: {
    membersCondition: {
      identityParams: { workspaceId },
      where: [],
    },
  },
})
```

## API（抜粋）

- `createFirestoreResolver({ db, conditions, type? })`
- `createFirebaseStorageResolver({ storage, locations, type? })`
- 型: `FirestoreExternalKeyConfig`, `FirestoreCondition`, `FirebaseStorageLocation`, ...

## 関連

- `@zodapp/zod-form`: スキーマ側の `zf.externalKey` / `zf.file`
- `@zodapp/zod-firebase` / `@zodapp/zod-firebase-browser`: Firestore の型/アクセサ
- `@zodapp/zod-form-mantine`: すぐ使える UI（resolver を Context に渡して利用）

## ライセンス

MIT（[`LICENSE`](../../LICENSE)）

