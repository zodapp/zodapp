# サーバーの API と認証コンテキスト

## 使用例

```ts
import type { IncomingMessage } from "node:http";
import express from "express";
import { createRepository, createServerApi } from "@zodapp/zod-dynamodb-node";
import { router } from "@zodapp/zod-dynamodb-express";
import { endpoints } from "../shared/endpoints";

const repository = createRepository({ tables: { tasks }, overrides, dynamodb });

// サーバーの API。認証コンテキストは、ここで一度だけ取り出し方を渡す
export const serverApi = createServerApi(endpoints, {
  repository,
  context: (req: IncomingMessage) => resolveAuth(req.headers), // リクエストから認証コンテキストを作る
});

const app = express();
app.use(express.json());
app.use("/api", router(serverApi, { onError: (e) => logger.error(e) }));
```

- `router()` は、登録簿の `path` を持つ操作を、そのHTTPメソッドとパスで登録したExpressの `Router` を返す。サーバー専用の操作と、`path` のない操作は登録しない
- 各リクエストでは、`context(req)` で認証コンテキストを作り、入力の検証、`authorize`（上書きを含む。[共有の定義と、サーバーだけの上書き](../../zod-dynamodb/docs/shared-definitions.ja.md)）、Repositoryの呼び出しの順に処理する
- 認証コンテキストの型は `defineContext<Auth>()`（[共有の定義と、サーバーだけの上書き](../../zod-dynamodb/docs/shared-definitions.ja.md)）で決まり、`authorize`、`where`、`patch`、上書きで共通に使う
- `onError` を渡すと、`INTERNAL`（500）にしたエラーを受け取れる（ログ用）。既定ではログに出す
- `context` は、リクエストのヘッダー（CookieやAuthorization）から認証コンテキストを作る関数として書くことを推奨する。リアルタイムの接続でも同じ関数を使えるためである（[Realtime Gateway](../../zod-dynamodb-realtime/docs/gateway.ja.md)）。認証されていないリクエストでも投げずに、匿名を表す値を返すことを勧める。`context` で投げた `UnauthenticatedError` は 401（`UNAUTHENTICATED`）にし、それ以外のエラーは、Expressの `next(error)` に渡す

**認証の情報と、認証コンテキストの確認**

認証コンテキストは、リクエストから「認証の情報」を取り出し、それから作る、という 2 段に分けられる。リアルタイムの接続で、接続を保ったまま認証の情報を入れ替えたり、サーバーから作り直させたりするためである（[Realtime Gateway](../../zod-dynamodb-realtime/docs/gateway.ja.md)）。

```ts
export const serverApi = createServerApi(endpoints, {
  repository,
  // リクエストから認証の情報を取り出す。型はアプリが決める（トークンの文字列、セッション ID、証明書の情報など）
  credential: (req: IncomingMessage) => bearerTokenOf(req),
  // 認証の情報から認証コンテキストを作る。正しくなければ UnauthenticatedError
  context: async (token: string | undefined) => (token ? await verify(token) : anonymous),
  // 認証コンテキストの期限（ミリ秒の時刻）。操作の認可の前に毎回確かめ、Gateway は期限の前に作り直す
  expiresAt: (ctx: Auth) => ctx.expiresAt,
  // 期限のほかの確認（アカウントの停止など）。任意
  checkContext: (ctx: Auth) => {
    if (ctx.suspended) throw new UnauthenticatedError("suspended");
  },
});
```

認証は 3 段で考える。

| 段 | 作り方 | 期限 | 入れ替え・作り直し |
|---|---|---|---|
| 認証の情報（credential） | 利用者が送ったものから、同期か非同期で得る（`credential(req)`、Gateway の `credentialOf`） | あり（長い） | Gateway の `auth` メッセージで入れ替える。ブラウザから値を送れない方式（HttpOnly の Cookie）だけ、つながり直す |
| 認証コンテキスト（context） | 認証の情報から、同期か非同期で作る（`context(credential)`）。認可に要るデータ（ロールなど）はここで読む | あり（`expiresAt`）。認証の情報の期限を超えないように作る | Gateway は期限の前に、認証の情報から作り直す。`revalidate` でも作り直す |
| 認可（authorize） | `expiresAt` と `checkContext` の確認、操作の `authorize` | — | 操作のたびに同期で呼ぶ。データベースは読まない |

- 取り消しは、認可だけなら `revalidate`（[Realtime Gateway](../../zod-dynamodb-realtime/docs/gateway.ja.md)）で認証コンテキストを作り直す。認証の取り消し（サインアウトさせる、アカウントを止める）は、アプリの `context(credential)` が失敗するようにする。JWT は署名で検証するだけなので、取り消しの状態（セッションの保存先、取り消しの一覧）を見るのはアプリの責任である
- 認証コンテキストの寿命を短くしておく（たとえば 5 分）と、`revalidate` を呼び忘れても、権限の古さはその時間までに収まる
- `revalidate` が効くのはその Gateway の接続だけである。Gateway が複数の台にあるとき、ライブラリは取り消しを配る専用の仕組みを持たない。アプリが「誰の権限が変わったか」を普通のデータとして書き（サーバー専用のクエリに `live` を付ける）、各台が `subscribeOnServer` で購読して `revalidate` を呼ぶ

- `credential` を省くと、リクエストそのものを `context` に渡す（`context: (req) => ctx` の書き方）
- ライブラリは認証の情報の中身を見ない。文字列のトークンを介さない方式（HttpOnly の Cookie、クライアント証明書）でも、その方式に合わせた型にすればよい
- `expiresAt` と `checkContext` は、HTTP でも Gateway でも、操作の認可の前に毎回確かめる。期限を過ぎていたら、または `checkContext` が `UnauthenticatedError` を投げたら `UNAUTHENTICATED` になる。どちらもデータベースは読まず、認証コンテキストの値だけで判定する。`can` は判定だけなので確かめない

**サーバーの API**

サーバーの API は、ブラウザの API（[ブラウザの API](../../zod-dynamodb-client/docs/client-api.ja.md)）と同じ形の関数を持ち、サーバー専用の操作も含む。HTTPを通らず、同じプロセスでRepositoryを呼ぶ。

```ts
await serverApi.tasks.setStatus(key, { status: "done" }, { context: auth });
await serverApi.tasks.purge(key); // サーバー専用の操作（authorize がないので context は要らない）

// リクエストの間、認証コンテキストのスコープを張る。中では context を省略できる
app.use(serverApi.scope());
app.post("/api/tasks/finish-all", async (req, res) => {
  await finishAll(serverApi, req.body.workspaceId); // 両側で動くコード（[ブラウザの API](../../zod-dynamodb-client/docs/client-api.ja.md)）
  res.json({});
});
```

- 認証コンテキストは、明示した `{ context }`、スコープ（`serverApi.scope()` か `runWithContext(ctx, fn)`。AsyncLocalStorage）の順に使う。`authorize` を持つ操作で見つからなければ `MissingContextError` にする
- `context` キーを書いたら（`"context" in options`）、値が `null` / `undefined` でもスコープには戻らず、「認証コンテキストなし」として扱う。値を探して見つからなかった（`{ context: bobAuth }` の `bobAuth` が `undefined`）ときに、処理中のリクエストの利用者の権限で動くのを防ぐためである。ログインしていない利用者を通したいときは、アプリがそれを表す値（ロールのない認証コンテキストなど）を渡す
- deleteは、サーバーでは削除前のItemを返す
- router と Gateway の中では、リクエストごとにスコープを張るので、そこから呼ぶ処理でも `context` を省略できる
- `serverApi.contextOf(req)` は、同じリクエスト（オブジェクト）には最初の結果を返す。`app.use(serverApi.scope())` と router を両方使っても、`credential` と `context` は 1 リクエストで 1 回だけ呼ばれる。期限（`expiresAt`・`checkContext`）は操作のたびに確かめるので、覚えた値でも期限切れは見逃さない
- `context` を渡さないサーバーの API は、サーバーの中だけで使う（明示の `context` か `runWithContext` で値を渡す）ためのものとする。これで `router()`・`handle()`・`createRealtimeGateway()` を作ると、`authorize` を持つ操作を公開する場合は作成時に `DefinitionError` にする（設定の漏れを最初のリクエストまで持ち越さないため）
- サーバーの API は `endpoints`、`contextOf(req)`、`credentialFromRequest(req)`、`contextFromCredential(credential)`、`checkContext(ctx)`、`expiresAt(ctx)`、`scope()`、`execute(entry, request)`、`authorize(entry, request)`、`repository` も持つ。これらの名前はグループ名に使えない
