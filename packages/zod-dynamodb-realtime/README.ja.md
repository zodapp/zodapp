# @zodapp/zod-dynamodb-realtime

Realtime Gateway です。WebSocket で Client の購読を受け、配送基盤（MQTT など）のトピックを購読して、範囲の条件に合う変更だけを Client に送ります（設計は [docs/design.md](../../docs/zod-dynamodb/design.md) の §9.6、§10）。

公開する購読は、登録簿でクエリに `live` を付けたものです。購読の名前は「グループ名.操作の名前」（`tasks.byStatus`）になります。

```ts
// shared/endpoints.ts（ブラウザからも import できる）
export const endpoints = defineEndpoints({
  tasks: [
    {
      op: taskOps.byStatus,
      path: "/tasks/by-status",
      live: { fields: { omit: ["description"] } },
    },
  ],
});
```

```ts
// server.ts
import type { IncomingMessage } from "node:http";
import { createRealtimeGateway } from "@zodapp/zod-dynamodb-realtime";
import { mqttPublisher, mqttTransport } from "@zodapp/zod-dynamodb-mqtt";

// 書き込み側：Repository の変更をトピックに発行する
const publisher = mqttPublisher({ url: process.env.MQTT_URL!, endpoints });
const repository = createRepository({ ..., listener: publisher });
const serverApi = createServerApi(endpoints, {
  repository,
  context: (req: IncomingMessage) => resolveAuth(req.headers), // HTTP と同じ関数
});

const realtime = createRealtimeGateway({
  api: serverApi,
  transport: mqttTransport({ url: process.env.MQTT_URL! }),
  maxPageSize: 1_000, // 1 ページの件数の上限（既定）
  origin: ["https://app.example.com"], // upgrade の Origin ヘッダーを確かめる（省略すれば確かめない）
  maxSubscriptionsPerConnection: 100, // 1 本の接続の購読の数の上限（既定）
});

const server = app.listen(3000);
realtime.attach(server, { path: "/api/realtime" });
// または server.on("upgrade", (req, socket, head) => realtime.handleUpgrade(req, socket, head))

// 終了時
await realtime.close(); // 接続を閉じ、配送の購読をやめ、配送を閉じる
```

- `origin` を指定すると、認証コンテキストを作る前に upgrade の Origin ヘッダーを確かめ、許可しなければ 403 で拒否します。配列は完全一致、関数なら `(origin, req) => boolean` です。Origin ヘッダーのないリクエスト（ブラウザ以外のクライアント）は通します。Cookie で認証するアプリでは、Cross-Site WebSocket Hijacking を防ぐために指定してください
- 1 本の接続で同時に持てる購読は `maxSubscriptionsPerConnection`（既定 100）までです。超えた購読は `INVALID_INPUT` で拒否します
- 認証コンテキストは、サーバーの API の `credential` と `context` で upgrade のリクエストから作ります。投げたら upgrade を 401 で拒否します。Express の認証ミドルウェアは upgrade では動かないので、ヘッダー（Cookie や Authorization）から作る関数にしてください
- 購読の開始、ページ、変更の配信の前に、そのたびにサーバーの API の `expiresAt`（認証コンテキストの期限）と `checkContext`、`authorize` を同期で確かめます。認証の失敗なら `UNAUTHENTICATED` を送って接続を閉じ（コード 4401。Client はつながり直します）、認可の拒否ならその購読だけを `FORBIDDEN` で止めます

### 認証の情報の入れ替えと、作り直し

```ts
const realtime = createRealtimeGateway({
  api: serverApi,
  transport,
  // auth メッセージの payload を、認証の情報（serverApi の credential と同じ型）に直す
  credentialOf: (payload) =>
    z.object({ token: z.string() }).parse(payload).token,
});

// メンバーから外したときなど：その利用者の接続だけ、認証コンテキストを作り直す
await realtime.revalidate((ctx: Auth) => ctx.email === email);
```

- ブラウザでは、トークンを更新したら `client.realtime.authenticate({ token })` を呼びます。接続を保ったまま、認証コンテキストが入れ替わります
- `credentialOf` を渡さなければ、`auth` メッセージは受け付けません。Cookie や証明書のように、ブラウザから値を送れない方式では、期限が来たらつながり直します
- `revalidate` は、最後に受け取った認証の情報から作り直します。作れない接続は閉じ、認可の通らない購読は `FORBIDDEN` で止めます

### 期限の前の作り直し

```ts
const serverApi = createServerApi(endpoints, {
  repository,
  credential: (req) => tokenOf(req),
  context: async (token) => loadAuth(token), // ロールなど、認可に要るデータをここで読む
  // 認証コンテキストの期限。認証の情報の期限を超えないようにする
  expiresAt: (ctx: Auth) =>
    Math.min(ctx.tokenExpiresAt, ctx.builtAt + 5 * 60_000),
});

const realtime = createRealtimeGateway({
  api: serverApi,
  transport,
  rebuildAt: 0.8, // 寿命の何割で作り直すか（既定）
  maxConcurrentRebuilds: 10, // 同時に作り直す数の上限（既定）
});
```

- `expiresAt` を返す認証コンテキストは、寿命の `rebuildAt` の時点で、最後に受け取った認証の情報から作り直します。ロールの変更などは、`revalidate` を呼ばなくても、遅くともこの時点で反映されます
- 作れなければ（認証を取り消したなど）、接続を閉じます。同じ認証の情報から作り直して期限が延びなければ、もう作り直さず、期限が来たら次の操作で接続を閉じます
- 作り直しの間に届いた変更は、まだ期限の切れていない前の認証コンテキストで配信します
- 作り直しと `revalidate` は、同時に `maxConcurrentRebuilds` 本までに抑えます
- 購読の認可は、クエリの `authorize`（上書きを含む）で行います。HTTP のクエリと同じ判定です。拒否なら、その購読に `FORBIDDEN` を返して終えます
- Gateway は「購読」と「ページ」の 2 つの部品だけを持ちます。progressive か全体か、どこまで読み込んだかは Client（`@zodapp/zod-dynamodb-client`）が管理します
- 同じトピックは接続をまたいで 1 回だけ配送基盤で購読し、参照を数えます
- 生存確認の ping を 30 秒ごとに送り、応答のない接続を切ります（`pingInterval`）
- メッセージの形式は design.md の §10.5 にあります

テストや 1 プロセスでの開発には、`@zodapp/zod-dynamodb` の `memoryTransport()` を書き込み側と Gateway で共有できます。
