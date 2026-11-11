# @zodapp/zod-dynamodb-express

`@zodapp/zod-dynamodb` の登録簿（`defineEndpoints`）に書いた操作を、Express 5 のルートとして公開します（設計は [docs/design.md](../../docs/zod-dynamodb/design.md) の §7、§8）。

```ts
import type { IncomingMessage } from "node:http";
import express from "express";
import { createRepository, createServerApi } from "@zodapp/zod-dynamodb-node";
import { router } from "@zodapp/zod-dynamodb-express";

const repository = createRepository({
  tables: { tasks },
  overrides,
  dynamodb: new DynamoDBClient({}),
  cursorSecret: process.env.CURSOR_SECRET,
});

const serverApi = createServerApi(endpoints, {
  repository,
  // リクエストから認証コンテキストを作る。ここで投げたエラーは next(error) に渡す
  context: (req: IncomingMessage) => resolveAuth(req.headers),
});

const app = express();
app.use(express.json());
app.use("/api", router(serverApi, { onError: (e) => logger.error(e) }));
```

- `router()` は、登録簿の `path` を持つ操作を、その HTTP メソッドとパスで登録した `Router` を返します。サーバー専用の操作（`authorize` のないもの）と、`path` のない操作は登録しません
- `GET` の操作は、クエリ文字列の `input`（入力全体の JSON）から入力を読みます。それ以外はリクエストの body から読みます
- 前段のミドルウェア（レート制限など）は、`app.use` でパスに先に置いてください

登録簿と違うパスや読み出し方で公開したいときは、`handle()` で 1 つずつ登録します。

```ts
import { handle } from "@zodapp/zod-dynamodb-express";

app.get(
  "/legacy/tasks/:workspaceId/:taskId",
  rateLimit,
  handle(serverApi.tasks.get, {
    input: (req) => ({
      workspaceId: req.params.workspaceId,
      taskId: req.params.taskId,
    }),
  }),
);
```

## 処理の流れ

1. 入力を読む（`GET` はクエリ文字列の `input`、それ以外は `req.body`。`handle()` の `input` を渡せばその戻り値）
2. JSON から値に戻し（`Date`・`bigint`・`Set`・`Map`）、操作の Schema で検証する
3. `context(req)` で認証コンテキストを作り、リクエストの間スコープを張る
4. `authorize`（共有の定義と、サーバーの上書き）を呼ぶ。拒否なら `FORBIDDEN`（403）
5. Repository を呼ぶ
6. 出力を JSON に変換して返す（200）。Get は常にトークンも返し、delete は `{}` を返す

## エラー

エラーは、HTTPステータスと `{ code, message, issues? }` で返します。

| code             | HTTP | 元のエラー                                                                  |
| ---------------- | ---- | --------------------------------------------------------------------------- |
| `INVALID_INPUT`  | 400  | 入力の検証の失敗。`issues` にZodのissueを入れる                             |
| `INVALID_CURSOR` | 400  | ページネーションのトークンが正しくない                                      |
| `FORBIDDEN`      | 403  | `authorize` が `false` を返した（上書きが `ForbiddenError` を投げた場合も） |
| `NOT_FOUND`      | 404  | Itemがないか、`where` の条件が成り立たない（区別しない）                    |
| `ALREADY_EXISTS` | 409  | 作成済み                                                                    |
| `CONFLICT`       | 409  | `ifUnchanged` の不一致、再試行の上限                                        |
| `INTERNAL`       | 500  | それ以外。メッセージは返さず、`onError` に渡す                              |

`context` の中でアプリケーションが投げたエラーは、変換せずに `next(error)` でExpressのエラーハンドラーに渡します。

## テスト

テストは、実際のExpressのアプリを空きポートで起動し、`fetch` で呼んで DynamoDB Local まで往復します。

```bash
pnpm emulator:start
pnpm test
```
