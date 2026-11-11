# @zodapp/zod-dynamodb-node

`@zodapp/zod-dynamodb` のTable定義から、DynamoDBを操作するRepositoryと、サーバーの API を作ります（設計は [docs/design.md](../../docs/zod-dynamodb/design.md) の §6、§8.2）。

```ts
const repository = createRepository({
  tables: { tasks },
  overrides, // override() の一覧（サーバーだけの上書き）
  dynamodb: new DynamoDBClient({}),
  cursorSecret: process.env.CURSOR_SECRET,
  listener: { onChanges: (changes) => publish(changes) },
});

await repository.tasks.create({ workspaceId: "ws1", taskId: "t1" }, input);
await repository.tasks.mutate(
  taskOps.setStatus,
  { workspaceId: "ws1", taskId: "t1" },
  { status: "done" },
  { context: auth },
);
const { items, cursor } = await repository.tasks.query(taskOps.byStatus, {
  workspaceId: "ws1",
  status: "done",
});

// 検証と認可（authorize と上書き）を通して実行する
await repository.execute(
  taskOps.setStatus,
  { key, params: { status: "done" } },
  { context: auth },
);
```

- 更新は `UpdateItem` の差分と `ALL_OLD` で行い、正確なBefore / Afterから変更イベントを作ります
- Indexの物理キーの付け直しに足りない値があるときだけ、強い整合性で事前に読み、`_version` の一致を条件にして更新します。一致しなければ読み直して再試行します
- `runTransaction()` / `createBatch()` は書き込みをためて1回の `TransactWriteItems` で確定します。トランザクションと一括での書き込み（`bulkWrite`）は、登録簿には載せずRepositoryの機能として使います
- variantを切り替える更新も事前に読み、前のvariantにしかないフィールドとIndexの物理キーを消します
- `get(key, { withToken: true })` のトークンを `ifUnchanged` に渡すと、読んだ後に他の更新が入っていれば `StaleItemError` で拒否します
- ページネーションのトークンは、パラメーターと認証コンテキスト（`context`）から計算したキー条件に結び付けて署名します。別の利用者のトークンは使えません
- `set()` はItem全体を置き換えます。`delete()` は常に物理削除です（論理削除は通常のミューテーションで書きます）
- ベクトルの実行時の設定（スロットとフィルターの関数）は `vectors` と `resolveVectorConfig` に、検索用の embedding ベクトルは上書きの `queryVector` に書きます

## サーバーの API

```ts
import type { IncomingMessage } from "node:http";

export const serverApi = createServerApi(endpoints, {
  repository,
  context: (req: IncomingMessage) => resolveAuth(req.headers), // router と Gateway がリクエストごとに呼ぶ
});

await serverApi.tasks.setStatus(key, { status: "done" }, { context: auth });
await serverApi.tasks.purge(key); // サーバー専用の操作も呼べる

app.use(serverApi.scope()); // リクエストの間、認証コンテキストのスコープを張る
await runWithContext(auth, () => finishAll(serverApi, "ws1")); // スコープの中では context を省略できる
```

- 関数の形はブラウザの API（`@zodapp/zod-dynamodb-client`）と同じです。両方で動くコードは `SharedApi<typeof endpoints>` を引数に取ります
- 認証コンテキストは、明示した `{ context }`、スコープの順に使います。`authorize` を持つ操作で見つからなければ `MissingContextError` です
- deleteは、サーバーでは削除前のItemを返します

## テスト

テストは DynamoDB Local に対して実行します。

```bash
pnpm emulator:start   # docker で amazon/dynamodb-local を 8000 番で起動
pnpm test
```

`SearchVectors` は DynamoDB Local が対応していないため、ベクトル検索のテストではそのリクエストだけを差し替えています。
