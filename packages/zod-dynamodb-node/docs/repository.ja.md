# Repository

[English](repository.md)

## 役割

バックエンド用のRepository（`@zodapp/zod-dynamodb-node`）は、ExpressミドルウェアやRealtime Gatewayの有無にかかわらず、DynamoDBに対する型安全な操作の中核となる。次の機能を担う。

- Itemの取得
- Itemの作成
- Itemの部分更新
- 名前付きミューテーションの実行
- Itemの削除
- 名前付きクエリの実行
- 名前付きの検索（ベクトル検索）の実行
- データの変換（キーの注入、マージ、物理キーの組み立てと逆算、DynamoDB属性値との相互変換）
- 入出力のZod検証
- DynamoDB固有の操作制約の適用
- 変更イベントの生成（[変更イベントの生成](../../zod-dynamodb/docs/realtime.ja.md)）

## 使用例

```ts
import { createRepository } from
  "@zodapp/zod-dynamodb-node";

// Table定義と、サーバーだけの上書き（[共有の定義と、サーバーだけの上書き](../../zod-dynamodb/docs/shared-definitions.ja.md)）を受け取って作る
const repository = createRepository({
  tables: { tasks, rows },
  overrides, // override() の一覧
  vectors: { rows: { content: { slot: ..., filters: ... } } }, // ベクトルの実行時の設定（[ベクトル検索](vector-search.ja.md)）
  dynamodb,
});
```

ほかのオプションは次のとおり。

| オプション                     | 内容                                                                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `tableNames`                   | 物理レイアウトの名前を実際のテーブル名に読み替える（環境ごとの接頭辞など）                                             |
| `cursorSecret`                 | ページのトークンの署名に使う秘密の値                                                                                   |
| `listener` / `onListenerError` | 変更の受け取り手（[変更イベントの生成](../../zod-dynamodb/docs/realtime.ja.md)）と、そこでのエラー（既定はログに出す） |
| `resolveVectorConfig`          | ベクトル検索の実行時の設定を引く関数（[ベクトル検索](vector-search.ja.md)）                                            |
| `maxRetries`                   | `version` の不一致による再試行の上限（既定 5。[書き込み](writes.ja.md)）                                               |
| `invalidItems`                 | 保存データがitemのSchemaでparseできないときの扱い（[名前付きクエリ](queries.ja.md)）                                   |

操作の例：

```ts
const task = await repository.tasks.get({
  workspaceId: "ws1",
  taskId: "task1",
});
// task: { workspaceId, taskId, kind, title, status, ..., createdAt, updatedAt } | null

await repository.tasks.create(
  { workspaceId: "ws1", taskId: "task1" },
  { kind: "todo", title: "設計", status: "todo", assignee: null, priority: 3 },
);

await repository.tasks.update(
  { workspaceId: "ws1", taskId: "task1" },
  { status: "done" },
);
```

名前付きの操作（[名前付きクエリ](queries.ja.md)、[書き込み](writes.ja.md)、[ベクトル検索](vector-search.ja.md)）は、アクセサに操作を渡して実行する（`repository.tasks.mutate(taskOps.setStatus, key, params)`）。登録簿の操作を、検証と認可（`authorize`。上書きを含む）を通して実行するときは `repository.execute(op, request, { context })` を使う。`authorize` を持つ操作では `context` が必須で、渡さなければ `MissingContextError` にする。ブラウザと同じ形で呼ぶサーバーの API（`createServerApi`）は [サーバーの API](server-api.ja.md) で述べる。

トランザクションと一括での書き込み（[書き込み](writes.ja.md)、[ベクトル検索](vector-search.ja.md)）は、登録簿には載せず、Repositoryの機能として使う。

読み書きするのはitemのオブジェクトだけで、物理キー、エンティティ名、`version` は現れない。

作成時のキーは、第1引数として渡す。itemのSchemaからはキーを取り除かず、ライブラリが引数のキーを注入する。

キーをライブラリやアプリケーションで生成する場合（ランダムIDなど）は、フック（`generateKey`）で生成する。`generateKey` は、`onCreate` と同じくTable定義に書く。生成されるキーを除いた型を導出するのではなく、生成に必要な値（Partition Keyなど）を、Schema（`args`）を付けて引数として受け取る。Schemaがあるので、ブラウザから呼ぶときも送る前に検証できる。フックは検証済みのcreateの入力も受け取る。作成は `create(key, input)` とは別の `createWithGeneratedKey(args, input)` で行う。公開するときは `o.createWithGeneratedKey()` で操作にする。

```ts
generateKey: {
  args: z.object({ workspaceId: z.string() }),
  key: ({ workspaceId }) => ({ workspaceId, taskId: crypto.randomUUID() }),
},
```
