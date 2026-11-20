# Realtime Gateway

[English](gateway.md)

## フロントエンドの接続経路

データアクセスについては、WAFを経由したバックエンドAPIを標準経路とする。

リアルタイム通信も、WAFとバックエンドのGatewayを経由する。フロントエンドは配送基盤に直接つながない。

**A. バックエンド経由（標準）**

```text
Frontend
   │
   ▼
WAF
   │
   ▼
Realtime Gateway
   │
   ▼
配送基盤（MQTT）
```

**B. 配送基盤へ直接接続（サポートしない）**

```text
Frontend ── WAF ── Backend API
    │
    └──────── 配送基盤（MQTT）
```

WebSocketでは、WAFが検査するのは主に接続確立時のリクエストだが、未認証の接続や特定ユーザーからの接続を入口で遮断できることに十分な意味がある。また、公開入口をWAFに集約するという設計目的とも一致する。

Bは技術的に可能だが、公開入口が分かれるため、サポートしない。

## Gatewayの提供形態

リアルタイム接続も、Expressのアプリケーションに統合して提供する。ただし、Expressのミドルウェアの形にはせず、**フレームワークに依存しないGatewayを中核とし、Node.jsの `http.Server` に取り付ける補助を用意する**。

```ts
import { createRealtimeGateway } from "@zodapp/zod-dynamodb-realtime";
import { mqttTransport } from "@zodapp/zod-dynamodb-mqtt";

const realtime = createRealtimeGateway({
  api: serverApi, // createServerApi(endpoints, { repository, context })。[サーバーの API](../../zod-dynamodb-node/docs/server-api.ja.md)
  transport: mqttTransport({ url: process.env.MQTT_URL }),
  maxPageSize: 1_000, // 1 ページの件数の上限（既定）
  origin: ["https://app.example.com"], // upgrade の Origin ヘッダーを確かめる。省略すれば確かめない
  maxSubscriptionsPerConnection: 100, // 1 本の接続の購読の数の上限（既定）
});

const server = app.listen(3000);
realtime.attach(server, { path: "/api/realtime" });
```

- **接続の粒度**：WebSocketの口は1つとし、1本の接続の上で複数のSubscriptionの購読と解除を行う。画面で複数の一覧を購読しても、接続は増えない
- **公開と認可**：公開するSubscriptionは、登録簿で `live` を付けたクエリだけである。認可はクエリの `authorize`（上書きを含む）で行い、HTTPと同じ判定になる
- **中核**：Gatewayの中核は、`handleUpgrade(req, socket, head)` を持つフレームワーク非依存の部品とする。`attach` はその上の薄い補助で、Express以外（Fastify、素のNode.jsなど）でも、アプリケーションが `upgrade` イベントに自分でつなげられる
- **ミドルウェアにしない理由**：WebSocketの接続はHTTPのupgradeで始まり、`http.Server` の `upgrade` イベントに届く。Expressのルートやミドルウェアの連鎖は通らないため、既存の認証ミドルウェアも実行されない。また、Gatewayは接続の一覧、配送基盤との接続、購読中のトピックという状態を持ち、サーバーの起動と停止に合わせて開始・終了する必要がある
- **認証**：upgradeのリクエストでは認証ミドルウェアが動かないので、Gatewayはサーバーの API の `context`（[サーバーの API](../../zod-dynamodb-node/docs/server-api.ja.md)）でupgradeのリクエストから認証コンテキストを作る。リクエストのヘッダー（CookieやAuthorization）から作る関数にしておけば、HTTPと同じ関数を共有できる。購読とページの読み取りは、その認証コンテキストのスコープの中で行う
- **Snapshot**：Gatewayは「購読」と「ページ」の 2 つの部品だけを持つ（[初期同期の手順](../../zod-dynamodb-client/docs/live-sync.ja.md)）。ページは、購読した名前付きクエリを、購読のパラメーターと認証コンテキストで 1 ページだけ読み、`version` 付きで返す。progressive か全体か、どこまで読み込んだかは知らず、バッファも持たない。サーバーの負担は、1 ページの大きさ（`maxPageSize`）で上限が決まる
- **Origin の確認**：`origin`（オリジンの配列か、`(origin, req) => boolean`）を指定すると、upgrade の最初、認証コンテキストを作る前に Origin ヘッダーを確かめ、許可しなければ 403 で拒否する。配列は完全一致で比べる（末尾の `/` や大文字小文字の違いは許さない）。Origin ヘッダーのないリクエストは通す（関数も呼ばない）。Origin を送るのはブラウザだけで、Cross-Site WebSocket Hijacking はブラウザでしか起きないためである。省略すれば確かめない。Cookie で認証するアプリでは指定する
- **認証の失敗**：upgrade のときに `context` か `checkContext` が投げたら、upgrade を 401 で拒否する
- **操作のたびの確認**：購読の開始、ページの読み込み、変更の配信の前に、そのたびに期限（`expiresAt`）と `checkContext`、購読したクエリの `authorize` を同期で確かめる。認証の失敗（`UNAUTHENTICATED`）なら、`id` のない `error` を送って接続を閉じる（コード 4401）。クライアントはつながり直し、upgrade のリクエストで新しい認証の情報を渡す。認可の拒否（`FORBIDDEN`）なら、その購読だけを止め、接続とほかの購読は続ける。認証が切れた状態でメッセージを溜めるような中間の状態は持たない
- **認証の情報の入れ替え**：トークンの期限が短い（5 分など）と、期限のたびにつながり直すのは多すぎる。そこで、期限が来る前にクライアントが `auth` メッセージ（[Gatewayとクライアントの間のメッセージ](../../zod-dynamodb/docs/realtime.ja.md)）で新しい認証の情報を送り、接続を保ったまま認証コンテキストを入れ替えられる。Gateway の `credentialOf(payload)` で `payload` を認証の情報に直し、`context` で作り直して、開いている購読をすべて認可し直す。作れなければ接続を閉じ、認可の通らない購読と、範囲が認証コンテキストで決まり範囲の変わった購読は `FORBIDDEN` で止める。`credentialOf` を渡さなければ `auth` メッセージは受け付けない（Cookie や証明書のように、ブラウザから値を送れない方式では、期限が来たらつながり直す）
- **作り直し（`revalidate`）**：メンバーから外した、アカウントを止めたなどの緊急のときに、`realtime.revalidate(filter?)` で、`filter` に合う接続（省けばすべて）の認証コンテキストを、最後に受け取った認証の情報から作り直す。その後は `auth` メッセージと同じに扱う
- **サーバーでの購読（`subscribeOnServer`）**：サーバーのコードが `live` を付けたクエリを、配送のトピックで購読する（`@zodapp/zod-dynamodb`。Node に依存しない）。クエリの範囲に入る変更だけを `ADDED` / `MODIFIED` / `REMOVED` として渡し、最初のページは読まず、認可もしない。複数の台の Gateway に `revalidate` を届けるのに使う
- **期限の前の作り直し**：`expiresAt` を返す認証コンテキストは、寿命の `rebuildAt`（既定 0.8）の時点で、最後に受け取った認証の情報から作り直す。ロールの変更などは、`revalidate` を呼ばなくても遅くともこの時点で反映される。作れなければ接続を閉じる。同じ認証の情報から作り直して期限が延びなければ（認証の情報そのものの期限が来た）、もう作り直さない。作り直しの間に届いた変更は、まだ期限の切れていない前の認証コンテキストで配信する。作り直しと `revalidate` は、同時に `maxConcurrentRebuilds`（既定 10）本までに抑える
- **生存確認**：`pingInterval`（既定 30 秒）ごとにWebSocketのpingを送り、前回のpingに応答のなかった接続を切る。0 で送らない
- **購読の数の上限**：1 本の接続で同時に持てる購読（認可の途中のものも含む）は `maxSubscriptionsPerConnection`（既定 100）までとする。超えた `subscribe` には、その `id` で `INVALID_INPUT`（`too many subscriptions on this connection`）を返す。解除すれば減る
- **トピックの参照**：同じトピックは接続をまたいで 1 回だけ配送基盤で購読し、参照を数える。解除と切断で減らし、0 になったら購読をやめる
- **配信**：Gatewayは、購読中のSubscriptionのトピック（[トピックと配信先の判定](../../zod-dynamodb/docs/realtime.ja.md)）を配送基盤で購読し、届いたメッセージを購読ごとに判定して、該当する接続に流す
- 書き込み側の発行（RepositoryのChangeListener。[変更イベントの生成](../../zod-dynamodb/docs/realtime.ja.md)）は、配送基盤のパッケージ（`zod-dynamodb-mqtt`）が提供する。発行するトピックは、登録簿で `live` を付けたクエリから決める（`mqttPublisher({ url, endpoints })`）
