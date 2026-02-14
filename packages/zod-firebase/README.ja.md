# @zodapp/zod-firebase

> この README は日本語版です。英語版は日本語レビュー・整合性チェック後に翻訳予定です。

## API リファレンス

- [API リファレンス](./docs/api/README.md)

## 概要

`@zodapp/zod-firebase` は、**フロントエンド/バックエンド共通で使える「Firestore の型契約（path + Zod schema）+ ユーティリティ」**です。
Firestore SDK へのアクセスは行わず、実際のアクセス実装（ブラウザ/Node）は別パッケージに分離しています。

- **path 文字列から型が自動生成**: `path: "workspaces/:workspaceId/tasks/:taskId"` のような文字列リテラルから、`:workspaceId` のようなキー（pathKeys）を抽出し、`buildDocumentPath()` / `parseDocumentPath()` の引数・戻り値の型まで推論します
- **documentIdentityKeys とデータを区別**: documentIdentityKeys（識別キー群）は **path から推測される文字列（`:...`） + fieldKeys のうち path に含まれないキー（nonPathKeys）** です。キーとデータ（`schema`）を分離して派生スキーマを自動生成することで、型の曖昧さに起因するアプリケーション上の問題（ID の誤上書き・欠落、create/update/store で必須キーがブレる等）を解消します
- **`z.infer<typeof collection.*Schema>` で用途別の型が自動生成**: 1つの `collectionConfig()`（戻り値を `collection` と呼びます）から `dataSchema` / `createSchema` / `storeSchema` / `documentIdentitySchema` などが派生し、`z.infer` で型を取り出せます（全パターンは後述の一覧に列挙）

主な提供物:

- `collectionConfig`: Firestore コレクション/ドキュメントを「パス」と「スキーマ（Zod）」で定義
- `buildDocumentPath` / `buildCollectionPath` / `parseDocumentPath`: パス組み立て・パース（`collectionConfig()` の戻り値に含まれます）
- `QueryOptions` / `WhereParams` / `OrderByParams`: Firebase SDK 非依存のクエリ表現
- `CollectionConfig` / `CollectionConfigBase`: `collectionConfig()` の戻り値型とジェネリック用途の基底型

ブラウザ/Node の実装（Firestoreへのアクセス）は別パッケージで提供します。

- ブラウザ: `@zodapp/zod-firebase-browser`（`firebase/compat` ベース）
- Node: `@zodapp/zod-firebase-node`（`firebase-admin` ベース）

## インストール

```bash
pnpm add @zodapp/zod-firebase
```

## 要件

- Zod v4

## クイックスタート（コレクション定義）

```ts
import { z } from "zod";
import { collectionConfig } from "@zodapp/zod-firebase";

const taskSchema = z.object({
  title: z.string(),
  done: z.boolean(),
});

export const tasks = collectionConfig({
  // ドキュメントパス（最後の :taskId が docKey になります）
  path: "workspaces/:workspaceId/tasks/:taskId",
  fieldKeys: [],
  schema: taskSchema,
});

// ドキュメントパスの組み立て（型安全）
const docPath = tasks.buildDocumentPath({ workspaceId: "ws1", taskId: "t1" });
// => "workspaces/ws1/tasks/t1"

// コレクションパスの組み立て
const colPath = tasks.buildCollectionPath({ workspaceId: "ws1" });
// => "workspaces/ws1/tasks"

// パース
const params = tasks.parseDocumentPath("workspaces/ws1/tasks/t1");
// => { workspaceId: "ws1", taskId: "t1" }
```

> `path` は `"/workspaces/:workspaceId"` のように先頭に `/` があってもなくても動作します。

---

## `collectionConfig` のオプション（`CollectionDefinition`）

`collectionConfig()` に渡すオプションオブジェクトの全フィールドを説明します。
詳細な型定義: [`CollectionDefinition`](./docs/api/type-aliases/CollectionDefinition.md)

### `path`（必須）

**型**: `string`（テンプレートリテラル）

Firestore のドキュメントパステンプレート。`:paramName` 形式のプレースホルダーが documentPathKeys として抽出されます。**最後の `:paramName` が `documentKey`**（docKey）、それ以外が `collectionKeys` になります。

```ts
export const tasks = collectionConfig({
  path: "workspaces/:workspaceId/projects/:projectId/tasks/:taskId",
  //     collectionKeys: workspaceId, projectId
  //     documentKey: taskId
  //     documentPathKeys: workspaceId, projectId, taskId（全部）
  schema: taskSchema,
});
```

### `schema`（必須）

**型**: `z.ZodObject<any>`

ドキュメント本体のスキーマ（intrinsicSchema）。これを起点に `dataSchema` / `createSchema` / `updateSchema` / `storeSchema` が自動生成されます。

documentIdentityKeys（pathKeys + nonPathKeys）と同名のフィールドを含めることもできます。派生スキーマの生成時には documentIdentityKeys が自動的にマージ・除外されるため、衝突の心配はありません。

```ts
const taskSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(["todo", "doing", "done"]).default("todo"),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const tasks = collectionConfig({
  path: "workspaces/:workspaceId/tasks/:taskId",
  schema: taskSchema,
});
```

### `fieldKeys`（任意）

**型**: `readonly string[]`

Firestore ドキュメントのフィールドとして保存するキー群の統一入力。以下の2種類が含まれます:

- **nonPathKeys**: path に含まれないキー。追加の識別キーとして扱われ、`documentIdentityKeys = documentPathKeys + nonPathKeys` となります。
- **pathFieldKeys**: path に含まれるキー。path から復元できるため通常はドキュメントには保存しませんが、collectionGroup クエリ等で直接フィールドとして参照したい場合に指定します。

fieldKeys に含まれるキーは `storeSchema` / `updateSchema` で必須フィールドとして残り、`beforeGenerate` / `beforeWrite` 実行時に identityParams から自動注入されます。

典型的な用途: collectionGroup クエリで必要な親ドキュメント ID や、論理的なパーティションキーなど。

```ts
// groupId は path に含まれないが、データ取得時に必ず指定される
// teamId は path に含まれるが、collectionGroup 検索で使用するためフィールドにも保存
export const users = collectionConfig({
  path: "teams/:teamId/users/:userId",
  fieldKeys: ["groupId", "teamId"] as const,
  schema: z.object({ name: z.string(), email: z.email() }),
});

// documentIdentitySchema: { teamId: string; userId: string; groupId: string }
// collectionIdentitySchema: { teamId: string; groupId: string }
// storeSchema: { groupId: string; teamId: string; name: string; email: string }
//   ↑ documentPathKeys (teamId, userId) のうち teamId は pathFieldKeys として必須で残る
//   ↑ groupId は nonPathKeys として必須で残る
```

> fieldKeys のうち nonPathKeys が空の場合、`nonPathKeySchema` は `z.unknown()` になります。

### `externalKeyConfig`（任意）

**型**: `{ labelField: string; valueField: string }`

外部キー参照時の表示用フィールドと値用フィールドを指定します。他のコレクションからこのコレクションを外部キーとして参照する際に使用されます。

- `labelField`: セレクトボックス等で表示するフィールド名
- `valueField`: 値として保持するフィールド名（通常は docKey に対応するフィールド）

```ts
export const members = collectionConfig({
  path: "workspaces/:workspaceId/members/:memberId",
  schema: memberSchema,
  externalKeyConfig: {
    labelField: "displayName", // セレクトボックスに表示される名前
    valueField: "memberId", // 選択時に保存される値（= documentKey）
  },
});
```

### `createOmitKeys`（任意）

**型**: `readonly string[]`

`createSchema` から除外するフィールド名の配列。`onCreate` / `onWrite` で自動生成されるフィールド（タイムスタンプ等）を指定します。

`createSchema` は documentIdentityKeys と `createOmitKeys` の両方を除外したスキーマになります。これにより、フォームの新規作成画面でユーザーが入力する必要のないフィールドが自動的に除外されます。

```ts
export const projects = collectionConfig({
  path: "workspaces/:workspaceId/projects/:projectId",
  schema: z.object({
    name: z.string(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
  }),
  // createdAt, updatedAt は onCreate/onWrite で自動設定するので createSchema から除外
  createOmitKeys: ["createdAt", "updatedAt"] as const,
  onCreate: () => ({ createdAt: new Date() }),
  onWrite: () => ({ updatedAt: new Date() }),
});

// createSchema: { name: string }
//   ↑ workspaceId, projectId（documentIdentityKeys）と createdAt, updatedAt（createOmitKeys）が除外される
```

### `onInit`（任意）

**型**: `() => Partial<z.infer<schema>>`

フォーム初期化時のデフォルト値を返す関数。**フォーム用途でのみ適用され、Firestore アクセサ（accessor）では使用されません。**

```ts
export const tasks = collectionConfig({
  path: "workspaces/:workspaceId/tasks/:taskId",
  schema: z.object({
    title: z.string(),
    status: z.enum(["todo", "doing", "done"]),
    priority: z.enum(["low", "medium", "high"]),
    deletedAt: z.date().nullable(),
  }),
  // 新規作成フォームの初期値
  onInit: () => ({
    status: "todo" as const,
    priority: "medium" as const,
    deletedAt: null,
  }),
});
```

### `onCreateId`（任意）

**型**: `(collectionIdentity, inputData) => string | undefined`

新規ドキュメント作成時の docId を決定する関数。戻り値が `string` の場合、その値を docId として使用します。`undefined` を返すか未設定の場合はランダム ID が発行されます。

- 第1引数 `collectionIdentity`: collectionKeys + nonPathKeys のパラメータ
- 第2引数 `inputData`: 入力データ（`z.infer<schema>` 型）

```ts
export const members = collectionConfig({
  path: "workspaces/:workspaceId/members/:memberId",
  schema: z.object({
    email: z.string().email(),
    displayName: z.string(),
  }),
  // email を docId として使用（同一ワークスペース内でメール一意）
  onCreateId: (_collectionIdentity, inputData) => inputData.email,
});

// 使用時: doc("workspaces/ws1/members/user@example.com").set(...)
```

### `onCreate`（任意）

**型**: `(documentIdentity, inputData) => Partial<z.infer<schema>> | void`

**create 時のみ**自動的にマージされる値を返す関数。タイムスタンプやデフォルト値の設定に使用します。

- 第1引数 `documentIdentity`: documentPathKeys + nonPathKeys のパラメータ（ドキュメントを一意に識別するキー群）
- 第2引数 `inputData`: 入力データ（`z.infer<schema>` 型）

`beforeGenerate` 内で `onCreate` → `onWrite` の順に適用されます。

```ts
export const tasks = collectionConfig({
  path: "workspaces/:workspaceId/tasks/:taskId",
  schema: z.object({
    title: z.string(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
  }),
  createOmitKeys: ["createdAt", "updatedAt"] as const,
  // create 時のみ createdAt を設定
  onCreate: (documentIdentity, data) => ({ createdAt: new Date() }),
  onWrite: (documentIdentity, data) => ({ updatedAt: new Date() }),
});
```

`documentIdentity` を利用する例:

```ts
export const items = collectionConfig({
  path: "users/:userId/items/:itemId",
  schema: z.object({
    name: z.string(),
    ownerId: z.string().optional(),
  }),
  // documentIdentity から userId を取得して ownerId に設定
  onCreate: (documentIdentity) => ({
    ownerId: documentIdentity.userId,
  }),
});
```

### `onWrite`（任意）

**型**: `(documentIdentity, data) => Partial<z.infer<schema>> | void`

**create / update 両方**で自動的にマージされる値を返す関数。

- 第1引数 `documentIdentity`: documentPathKeys + nonPathKeys のパラメータ
- 第2引数 `data`: 書き込みデータ（create 時は `onCreate` 適用後のデータ）

`beforeGenerate`（create 時）では `onCreate` の後に適用され、`beforeWrite`（update 時）では単独で適用されます。

```ts
export const projects = collectionConfig({
  path: "workspaces/:workspaceId/projects/:projectId",
  schema: z.object({
    name: z.string(),
    updatedAt: z.date().optional(),
  }),
  createOmitKeys: ["updatedAt"] as const,
  // create/update 両方で updatedAt を更新
  onWrite: () => ({ updatedAt: new Date() }),
});
```

### `mutations`（任意）

**型**: `Record<string, (...args: any[]) => Partial<z.infer<schema>>>`

実行環境に依存しないドメインミューテーション（状態変更操作）の定義。各関数は任意の引数を受け取り、スキーマの部分更新値を返します。

このパッケージでは単に型チェックだけを行い、そのままcollectionConfigの戻り値に含まれるqueriesオブジェクトとして利用できます。zod-firebase-browser / zod-firebase-nodeでは identityを引数として追加し、`collection.mutations.xxx(identity, ...args)` のように呼び出し、返された部分オブジェクトを Firestore に書き込みます。

```ts
export const tasks = collectionConfig({
  path: "workspaces/:workspaceId/tasks/:taskId",
  schema: z.object({
    title: z.string(),
    status: z.enum(["todo", "doing", "done"]),
    priority: z.enum(["low", "medium", "high"]),
    assigneeId: z.string().optional(),
    dueAt: z.date().optional(),
    deletedAt: z.date().nullable().optional(),
    archivedAt: z.date().optional(),
  }),
  mutations: {
    // 引数なしの mutation
    softDelete: () => ({ deletedAt: new Date() }),
    archive: () => ({ archivedAt: new Date() }),
    restore: () => ({ deletedAt: null }),

    // 引数ありの mutation
    setDueDate: (dueAt: Date) => ({ dueAt }),
    changeStatus: (status: "todo" | "doing" | "done") => ({ status }),
    assignTo: (assigneeId: string, priority?: "low" | "medium" | "high") => ({
      assigneeId,
      ...(priority && { priority }),
    }),
  },
});

// 使用例:
// tasks.mutations.softDelete()         => { deletedAt: Date }
// tasks.mutations.changeStatus("done") => { status: "done" }
// tasks.mutations.assignTo("user1", "high") => { assigneeId: "user1", priority: "high" }
```

### `queries`（任意）

**型**: `Record<string, (...args: any[]) => QueryOptions>`

実行環境に依存しないクエリ定義。各関数は任意の引数を受け取り、`QueryOptions`（`where` / `orderBy`）を返します。

このパッケージでは単に型チェックだけを行い、そのままcollectionConfigの戻り値に含まれるqueriesオブジェクトとして利用できます。zod-firebase-browser / zod-firebase-nodeで identityは引数に追加し、実際の Firestore クエリに変換されます。

```ts
export const tasks = collectionConfig({
  path: "workspaces/:workspaceId/tasks/:taskId",
  schema: z.object({
    title: z.string(),
    status: z.enum(["todo", "doing", "done"]),
    deletedAt: z.date().nullable().optional(),
  }),
  queries: {
    // 引数なしのクエリ
    active: () => ({
      where: [{ field: "deletedAt", operator: "==" as const, value: null }],
    }),

    // 引数ありのクエリ
    byStatus: (status: "todo" | "doing" | "done") => ({
      where: [{ field: "status", operator: "==" as const, value: status }],
    }),
  },
});

// 使用例:
// tasks.queries.active()          => { where: [{ field: "deletedAt", operator: "==", value: null }] }
// tasks.queries.byStatus("doing") => { where: [{ field: "status", operator: "==", value: "doing" }] }
```

`QueryOptions` の型定義:

```ts
type WhereFilterOp =
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "array-contains"
  | "in"
  | "array-contains-any"
  | "not-in";

type WhereParams = {
  field: string;
  operator: WhereFilterOp;
  value: unknown;
};

type OrderByParams = {
  field: string;
  direction: "asc" | "desc";
};

type QueryOptions = {
  where?: WhereParams[];
  orderBy?: OrderByParams[];
};
```

---

## 生成されるスキーマと型（`z.infer`）

`collectionConfig()` は、`path` と `schema` を起点に用途別の `***Schema` を多数生成します。これらは **フロント/バック両方で同じ型として共有**でき、`z.infer<typeof collection.***Schema>`（`collection` は `collectionConfig()` の戻り値。例: `tasks`）で型を取り出せます。

以下の説明では、次の定義を例として使用します:

```ts
const testCollection = collectionConfig({
  path: "teams/:teamId/users/:userId",
  fieldKeys: ["groupId", "teamId"] as const,
  schema: z.object({
    name: z.string(),
    email: z.email(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
  }),
  createOmitKeys: ["createdAt", "updatedAt"] as const,
});

// documentPathKeys: ["teamId", "userId"]
// collectionKeys: ["teamId"]
// documentKey: "userId"
// fieldKeys: ["groupId", "teamId"]
// nonPathKeys: ["groupId"]
// pathFieldKeys: ["teamId"]
// documentIdentityKeys: ["teamId", "userId", "groupId"]
```

### Identity（識別キー）系スキーマ

| スキーマ名                     | 含まれるキー                             | 説明                                           |
| ------------------------------ | ---------------------------------------- | ---------------------------------------------- |
| **`documentPathSchema`**       | pathKeys（collectionKeys + docKey）      | パスを構成する全キー                           |
| **`collectionPathSchema`**     | collectionKeys                           | docKey を除いた documentPathKeys              |
| **`documentKeySchema`**        | docKey のみ                              | 最後の `:paramName`                           |
| **`nonPathKeySchema`**         | nonPathKeys のみ                         | path 外の追加キー（空なら `z.unknown()`）      |
| **`documentIdentitySchema`**   | documentPathKeys + nonPathKeys           | ドキュメントを一意に識別する全キー             |
| **`collectionIdentitySchema`** | collectionKeys + nonPathKeys             | コレクションを一意に識別するキー               |
| **`collectionKeySchema`**      | collectionKeys                           | `collectionPathSchema` のエイリアス            |

上記の例での各スキーマの `z.infer` 結果:

```ts
type DocumentPath = z.infer<typeof testCollection.documentPathSchema>;
// => { teamId: string; userId: string }

type CollectionPath = z.infer<typeof testCollection.collectionPathSchema>;
// => { teamId: string }

type DocumentKey = z.infer<typeof testCollection.documentKeySchema>;
// => { userId: string }

type NonPathKey = z.infer<typeof testCollection.nonPathKeySchema>;
// => { groupId: string }

type DocumentIdentity = z.infer<typeof testCollection.documentIdentitySchema>;
// => { teamId: string; userId: string; groupId: string }

type CollectionIdentity = z.infer<
  typeof testCollection.collectionIdentitySchema
>;
// => { teamId: string; groupId: string }

type CollectionKey = z.infer<typeof testCollection.collectionKeySchema>;
// => { teamId: string }
```

> fieldKeys のうち nonPathKeys が空の場合、`nonPathKeySchema` は `z.unknown()` になり、`z.infer` は `unknown` になります。

### データ（ドキュメント本体）系スキーマ

| スキーマ名         | 構成ルール                                                              | 説明                         |
| ------------------ | ----------------------------------------------------------------------- | ---------------------------- |
| **`schema`**       | 入力そのまま                                                            | ユーザ指定の intrinsicSchema |
| **`dataSchema`**   | `schema` + documentIdentityKeys（必須）                                 | 読み取り時の完全なデータ型   |
| **`updateSchema`** | `schema` + documentIdentityKeys（fieldKeys は必須、その他 optional）     | 更新用フォーム向け           |
| **`storeSchema`**  | `schema` − documentPathKeys + fieldKeys（必須）                          | Firestore に保存する形       |
| **`createSchema`** | `schema` − documentIdentityKeys − createOmitKeys                         | 新規作成フォーム向け         |

上記の例での各スキーマの `z.infer` 結果:

```ts
type Data = z.infer<typeof testCollection.dataSchema>;
// => {
//   teamId: string;       // pathKey（必須）
//   userId: string;       // pathKey（必須）
//   groupId: string;      // nonPathKey（必須）
//   name: string;
//   email: string;
//   createdAt?: Date;
//   updatedAt?: Date;
// }

type Update = z.infer<typeof testCollection.updateSchema>;
// => {
//   teamId: string;       // fieldKeys に含まれるので必須
//   userId?: string;     // pathKey だが fieldKeys ではないので optional
//   groupId: string;     // nonPathKey は常に必須（fieldKeys）
//   name: string;
//   email: string;
//   createdAt?: Date;
//   updatedAt?: Date;
// }

type Store = z.infer<typeof testCollection.storeSchema>;
// => {
//   teamId: string;       // pathFieldKeys で必須化
//   groupId: string;      // nonPathKey で必須化
//   name: string;
//   email: string;
//   createdAt?: Date;
//   updatedAt?: Date;
// }
// ※ documentPathKeys (teamId, userId) は通常除外されるが、
//   teamId は pathFieldKeys に指定されているので必須で残る

type Create = z.infer<typeof testCollection.createSchema>;
// => {
//   name: string;
//   email: string;
// }
// ※ documentIdentityKeys (teamId, userId, groupId) と createOmitKeys (createdAt, updatedAt) が除外される
```

---

## 戻り値のメタ情報・ユーティリティ

`collectionConfig()` の戻り値には、スキーマ以外にも以下のプロパティが含まれます。
詳細な型定義: [`CollectionConfig`](./docs/api/type-aliases/CollectionConfig.md) / [`CollectionConfigMethods`](./docs/api/type-aliases/CollectionConfigMethods.md)

### パスユーティリティ

| プロパティ                    | 型                         | 説明                                  |
| ----------------------------- | -------------------------- | ------------------------------------- |
| `path`                        | `string`                   | 入力したパステンプレート              |
| `documentPathKeys`            | `readonly string[]`        | パスから抽出した全キー                |
| `collectionKeys`              | `readonly string[]`        | documentKey を除いた documentPathKeys |
| `documentKey`                 | `string`                   | 最後のキー（docKey）                  |
| `buildDocumentPath(params)`   | `(params) => string`       | ドキュメントパスの組み立て            |
| `buildCollectionPath(params)` | `(params) => string`       | コレクションパスの組み立て            |
| `parseDocumentPath(path)`     | `(path) => params \| null` | パス文字列からパラメータを抽出        |

```ts
const tasks = collectionConfig({
  path: "workspaces/:workspaceId/tasks/:taskId",
  schema: taskSchema,
});

tasks.documentPathKeys; // ["workspaceId", "taskId"]
tasks.collectionKeys; // ["workspaceId"]
tasks.documentKey; // "taskId"

tasks.buildDocumentPath({ workspaceId: "ws1", taskId: "t1" });
// => "workspaces/ws1/tasks/t1"

tasks.buildCollectionPath({ workspaceId: "ws1" });
// => "workspaces/ws1/tasks"

tasks.parseDocumentPath("workspaces/ws1/tasks/t1");
// => { workspaceId: "ws1", taskId: "t1" }

tasks.parseDocumentPath("/invalid/path");
// => null
```

### キー情報

| プロパティ                  | 型                  | 説明                               |
| --------------------------- | ------------------- | ---------------------------------- |
| `documentIdentityKeys`       | `readonly string[]` | `documentPathKeys + nonPathKeys`    |
| `collectionIdentityKeys`    | `readonly string[]` | `collectionPathKeys + nonPathKeys` |
| `fieldKeys`                 | `readonly string[]` | 入力した fieldKeys                 |

### ライフサイクル系ユーティリティ

| プロパティ                                    | 型                                  | 説明                                                             |
| --------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------- |
| `onInit`                                      | `(() => Partial<...>) \| undefined` | 入力した onInit                                                  |
| `beforeGenerate(documentIdentity, inputData)` | `(identity, data) => data`          | create 時の前処理（`onCreate` → `onWrite` → fieldKeys 注入）     |
| `beforeWrite(documentIdentity, data)`         | `(identity, data) => data`          | update 時の前処理（`onWrite` → fieldKeys 注入）                  |
| `checkNonPathKeys(data, identityParams)`       | `(data, params) => boolean`         | data 内の nonPathKeys が identityParams と一致するか検証          |

### その他

| プロパティ  | 型                           | 説明                                  |
| ----------- | ---------------------------- | ------------------------------------- |
| `mutations` | `Record<string, MutationFn>` | 入力した mutations（未設定時は `{}`） |
| `queries`   | `Record<string, QueryFn>`    | 入力した queries（未設定時は `{}`）   |

---

## 実践的な使用例

### 基本的なコレクション定義

```ts
import { z } from "zod";
import { collectionConfig } from "@zodapp/zod-firebase";

// ワークスペースコレクション（トップレベル）
export const workspaces = collectionConfig({
  path: "/workspaces/:workspaceId" as const,
  fieldKeys: [] as const,
  schema: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    ownerId: z.string(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
  }),
  createOmitKeys: ["createdAt", "updatedAt"] as const,
  onCreate: () => ({ createdAt: new Date() }),
  onWrite: () => ({ updatedAt: new Date() }),
});
```

### 外部キー参照を含むコレクション

```ts
// メンバーコレクション（外部キー参照元として設定）
export const members = collectionConfig({
  path: "/workspaces/:workspaceId/members/:memberId" as const,
  fieldKeys: [] as const,
  schema: z.object({
    displayName: z.string().min(1),
    email: z.string().email(),
    role: z.enum(["owner", "admin", "member", "viewer"]),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
  }),
  createOmitKeys: ["createdAt", "updatedAt"] as const,
  // docId に email を使用
  onCreateId: (_collectionIdentity, inputData) => inputData.email,
  onCreate: () => ({ createdAt: new Date() }),
  onWrite: () => ({ updatedAt: new Date() }),
  // 他のコレクションから外部キーとして参照する際の設定
  externalKeyConfig: {
    labelField: "displayName",
    valueField: "memberId",
  },
});
```

### mutation / query / ライフサイクルを活用した定義

```ts
export const tasks = collectionConfig({
  path: "/workspaces/:workspaceId/projects/:projectId/tasks/:taskId" as const,
  fieldKeys: [] as const,
  schema: z.object({
    title: z.string(),
    status: z.enum(["todo", "doing", "done"]).default("todo"),
    priority: z.enum(["low", "medium", "high"]).default("medium"),
    assigneeId: z.string().optional(),
    labels: z.array(z.string()).default([]),
    dueAt: z.date().optional(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
    deletedAt: z.date().nullable().optional(),
    archivedAt: z.date().optional(),
  }),
  createOmitKeys: ["createdAt", "updatedAt"] as const,
  onCreate: () => ({ createdAt: new Date() }),
  onWrite: () => ({ updatedAt: new Date() }),
  onInit: () => ({
    deletedAt: null,
    status: "todo" as const,
    priority: "medium" as const,
    labels: [],
  }),
  mutations: {
    softDelete: () => ({ deletedAt: new Date() }),
    archive: () => ({ archivedAt: new Date() }),
    restore: () => ({ deletedAt: null }),
    setDueDate: (dueAt: Date) => ({ dueAt }),
    changeStatus: (status: "todo" | "doing" | "done") => ({ status }),
    assignTo: (assigneeId: string, priority?: "low" | "medium" | "high") => ({
      assigneeId,
      ...(priority && { priority }),
    }),
  },
  queries: {
    active: () => ({
      where: [{ field: "deletedAt", operator: "==" as const, value: null }],
    }),
    byStatus: (status: "todo" | "doing" | "done") => ({
      where: [{ field: "status", operator: "==" as const, value: status }],
    }),
  },
});
```

### fieldKeys の活用

```ts
const users = collectionConfig({
  path: "teams/:teamId/users/:userId",
  schema: z.object({ name: z.string() }),
  fieldKeys: ["groupId", "teamId"] as const,
  // nonPathKeys: groupId（path に含まれない identity キー/永続化キー）
  // pathFieldKeys: teamId（path に含まれるが collectionGroup クエリのためフィールドにも保存）
});

// documentIdentityKeys: ["teamId", "userId", "groupId"]

// beforeGenerate（create 時）:
const result = users.beforeGenerate(
  { teamId: "t1", userId: "u1", groupId: "g1" },
  { name: "Alice" },
);
// => { name: "Alice", groupId: "g1", teamId: "t1" }

// beforeWrite（update 時）も同様に fieldKeys を注入
const updated = users.beforeWrite(
  { teamId: "t1", userId: "u1", groupId: "g1" },
  { name: "Bob" },
);
// => { name: "Bob", groupId: "g1", teamId: "t1" }
```

---

## API（型エクスポート）

- `collectionConfig({ path, schema, fieldKeys, ... })` — コレクション定義関数
- 設定関連型: `CollectionConfig`, `CollectionConfigBase`, `LooseCollectionConfigBase`, `BrandedCollectionConfig`, `CollectionDefinition`, `ExternalKeyConfig`
- Identity 関連型: `IdentityKeys`, `IdentityParams`, `DocumentIdentityParams`, `CollectionIdentityParams`, `CollectionIdentityKeys`
- クエリ関連型: `QueryOptions`, `WhereParams`, `OrderByParams`, `WhereFilterOp`, `QueryFn`
- ミューテーション関連型: `MutationFn`

## 関連

- `@zodapp/zod-firebase-browser`: Firestore アクセサ（購読共有・キャッシュ含む）
- `@zodapp/zod-firebase-node`: firebase-admin 用アクセサ
- `@zodapp/zod-form-firebase`: フォーム用の Firestore/Storage resolver

## ライセンス

MIT（[`LICENSE`](../../LICENSE)）
