# リアルタイムの配信

## 目的

DynamoDBのItem変更を、購読中のフロントエンドへ配信する。

対象となる変更は、概念的に以下の3種類とする。

- `ADDED`：購読対象に新しく含まれる
- `MODIFIED`：購読対象に含まれるItemが変更された
- `REMOVED`：購読対象から外れた

`REMOVED` はItemの削除だけを意味しない。更新によって購読条件に一致しなくなった場合（論理削除のミューテーションを含む）も含む。

## Subscription定義

Subscriptionは、**名前付きクエリをリアルタイムで購読するもの**として定義する。購読対象の範囲と所属判定は、名前付きクエリの宣言（[名前付きクエリ](../../zod-dynamodb-node/docs/queries.ja.md)）から得る。インデックスに対応しない購読は定義できない。購読を始めるときにSnapshot（[リアルタイムの同期](../../zod-dynamodb-client/docs/live-sync.ja.md)）をQueryで取る必要があり、インデックスに対応しない購読ではSnapshotを取れないためである。

Subscriptionは、登録簿（[登録簿](shared-definitions.ja.md)）でクエリに `live` を付けて公開する。購読の名前は「グループ名.操作の名前」（`tasks.byStatus`）になる。

```ts
export const endpoints = defineEndpoints({
  tasks: [
    // イベントとSnapshotに含めるフィールド（[読み取るフィールドの指定](../../zod-dynamodb-node/docs/queries.ja.md)、「配送基盤」）。絞らないなら live: true
    { op: taskOps.byStatus, path: "/tasks/by-status", live: { fields: { omit: ["description"] } } },
  ],
});
```

`fields` で絞っても、キーのフィールド、判別子のある union の判別子、クエリの Index のキーのフィールドは常に含める。Index のキーのフィールドは、クライアントが一覧の並べ替えと progressive のウィンドウの判定（[初期同期の手順](../../zod-dynamodb-client/docs/live-sync.ja.md)）に使う。

必要な性質は次のとおり。

- Subscription ParameterがZodで検証される（名前付きクエリの `params`）
- フロントエンドが購読先を型安全に指定できる
- バックエンドがItemから配信先（トピック。「トピックと配信先の判定」）を導出できる
- 更新前後のItemに対して所属判定を行い、購読対象への出入りを検出できる

配信先はライブラリがクエリの定義から作る。アプリケーションが配信先の文字列や、Itemから配信先を求める関数を書くことはない。

キー以外の条件（FilterExpression）は、名前付きクエリで許可しないため（[名前付きクエリ](../../zod-dynamodb-node/docs/queries.ja.md)）、購読にもない。

`limit` 付きの購読（上位N件など）は扱わない。他のItemの変更によって上位から押し出されるケースは、1件の更新前後を比べるだけでは判定できないためである。

## トピックと配信先の判定

変更イベントは、MQTTの**トピック**を単位に配る。トピックは次の組から作る。

```text
トピック = {prefix}/{エンティティ}/{Index 名}/{ハッシュ}
ハッシュ = base64url(SHA-256(Partition Key の値 + Sort Key の等値の部分の値))
```

- ベーステーブルのキーで検索するクエリは、Index 名の代わりに予約の名前 `_primary` を使う。値は[キーのエンコーディング](physical-layout.ja.md)の方式でエンコードした物理キーの文字列で、ハッシュはWebCryptoで求める（ブラウザでも同じ関数を使える）
- クエリ名ではなく Index 名を使うので、同じ Index の上の複数のクエリでトピックを共有する。どの購読の変更かは Gateway が知っていて、`matches` は購読ごとに判定するので、正しさは変わらない
- 長さと文字が一定になるので、配送基盤の制約（AWS IoT Core の 256 バイト、`/` は 7 個まで）を気にせずに済む。ハッシュの衝突は実質的に起きず、起きても Gateway がエンティティと `matches` で判定するので誤配信にはならない
- 例：[名前付きクエリ](../../zod-dynamodb-node/docs/queries.ja.md)の `byStatus`（Partition Keyは `workspaceId` と `status`、Sort Keyの `priority` に範囲条件）を `{ workspaceId: "ws1", status: "todo", minPriority: 3 }` で購読すると、ハッシュの入力は `Task#ws1#todo` と `Task`（等値の部分はない）になる
- 購読者のトピックは `topicForSubscriber(subscription, params, ctx)`（`subscription` は登録簿のエントリーの `subscription`）、Itemのトピックは `topicsForItem(table, index, item)` で求める。両者が一致することをプロパティテストで確かめている
- 名前付きクエリでは、Partition Keyは常に等値の条件である。Sort Keyも、先頭から k 個は等値で指定する（[名前付きクエリ](../../zod-dynamodb-node/docs/queries.ja.md)）。等値の部分の値は、購読のパラメーターからも、Itemのフィールドからも1つに決まるので、両者がずれることはない
- **範囲の条件（Sort Keyの最後の範囲の部分）は、トピックに入れない。** 購読者ごとに範囲が違うためである。範囲の条件は、Gateway（[Realtime Gateway](../../zod-dynamodb-realtime/docs/gateway.ja.md)）が購読ごとに `matches` で判定する。上の例では、`priority` が3未満のItemの変更は、Gatewayがその購読者には流さない
- 書き込み側は、Subscriptionとして公開した名前付きクエリごとに、BeforeとAfterのそれぞれから、等値の部分の長さ（0からSort Keyのフィールド数まで）ごとのトピックを求めて発行する。Sort Keyのフィールドは通常少数なので、発行の数は限られる
- 範囲の購読で1つのトピックに届く変更が多すぎる場合は、アプリケーションが月などの区切りのフィールドをSort Keyの等値の部分に加え、トピックを細かくする
- MQTTのWildcard Subscriptionには依存せず、完全一致のトピックを使う

**配送基盤に流すメッセージ**は、変更（`ChangeRecord`）をトピックに合わせて絞ったものとする。

- トピックは Index ごとに共有するので、書き込み側は、変更ごとに Index ごとに 1 回だけ発行する（Before と After のトピックの和に、重複なく）
- Before と After は、その Index を使う Subscription の `fields` の和に、キーと Index のキーのフィールドを足したものに絞る。どれかがすべてのフィールドを使うなら、絞らない
- Gatewayは、購読ごとに `matches(Before)` / `matches(After)` を判定し、`ADDED` / `MODIFIED` / `REMOVED`（「Before / Afterの判定」）を決め、その購読の `fields` に絞ってから、クライアントに送る
- 一括での書き込みの開始・終了（「一括での書き込みとイベント」）は、範囲（`scope`）から Partition Key が決まる Index について、範囲が含む Sort Key の先頭のフィールドの数までのトピックに発行する

**認可**

- フロントエンドは配送基盤に直接接続しない（[フロントエンドの接続経路](../../zod-dynamodb-realtime/docs/gateway.ja.md)）。トピックはサーバーの内部の名前で、認可の境界ではない
- 認可は、購読を始めるときに、購読するクエリの `authorize`（上書きを含む）をパラメーターに対して行う（[認証と認可](shared-definitions.ja.md)）。HTTPのクエリと同じ判定になる
- Item単位の読み取り認可は、名前付きクエリと同じく扱わない。必要な場合は、`fields` でフィールドをすべて外して本体を含めない通知にし、本体はItem単位で認可するHTTPのGetで取得させる
- 接続中に権限が外れた場合は、Gatewayの操作のたびの確認、`revalidate`、期限の前の作り直しで止める（[Realtime Gateway](../../zod-dynamodb-realtime/docs/gateway.ja.md)）

## 配送基盤

配送は `RealtimeTransport`（`publish` と `subscribe`）のインターフェースで分離する。用意している実装は次のとおり。

- **MQTT**（`@zodapp/zod-dynamodb-mqtt` の `mqttTransport`）：ローカルではMosquittoやaedes、AWSではAWS IoT Core。標準的なPublish/Subscribeで、ローカル開発環境を作りやすい
- **プロセス内**（`memoryTransport`）：テストと、1 プロセスで動かす開発用。発行は同じインスタンスの購読者に届く

書き込み側の発行は、`createChangePublisher({ transport, endpoints })`（MQTTでは `mqttPublisher({ url, endpoints })`）が作る `ChangeListener` で行う。

AppSync Eventsは、ローカルのエミュレーターがなく開発の負担が大きいため、作らない。

配送基盤は変更を運ぶだけで、Snapshot、認可、再同期、Item Versionの管理はこのライブラリが受け持つ。

### メッセージサイズ

配送基盤ごとにメッセージサイズの上限が異なる（例：AWS IoT Coreは128KB）。DynamoDBのItemはこれより大きくなりうる。

イベントに含めるフィールドは、Subscriptionの定義で絞り込めるようにする（例：大きな `payload` フィールドは含めない）。サイズの上限を超えたかどうかで本体の有無を切り替えることはしない。Itemごとに形が変わる分岐はテストの条件を増やし、不具合の原因になりやすいためである。

- 既定は本体（全フィールド）を含める
- Subscriptionごとに、含めないフィールドを指定できる（[読み取るフィールドの指定](../../zod-dynamodb-node/docs/queries.ja.md)の `fields`）。フィールドをすべて外せば、本体を含めない通知になる（Item単位の読み取り認可が必要な場合など。「トピックと配信先の判定」）。キーのフィールドは常に含める（[読み取るフィールドの指定](../../zod-dynamodb-node/docs/queries.ja.md)）
- 絞り込んだ後も上限を超えるイベントは、配信の失敗として記録する。クライアントは [再接続と再同期](../../zod-dynamodb-client/docs/live-sync.ja.md) の再同期で回復する

## Gatewayとクライアントの間のメッセージ

すべて JSON で、Item・キー・パラメーターの値は [値の変換](protocol.ja.md) の transport で変換する。`id` はクライアントがつける購読の番号で、1本の接続の上の複数の購読を区別する。形式は `zod-dynamodb` の `realtime-protocol` に、Zod の Schema とともに置く。

```ts
// Client → Gateway
{ type: "subscribe", id: 1, name: "tasks.byStatus", params: { workspaceId: "ws1", status: "todo" } }
{ type: "page", id: 1, cursor?: "…", limit: 100 }
{ type: "unsubscribe", id: 1 }
{ type: "auth", payload: { token: "…" } } // 認証の情報の入れ替え（[Realtime Gateway](../../zod-dynamodb-realtime/docs/gateway.ja.md)）。payload の形はアプリが決める

// Gateway → Client
{ type: "ready", id: 1 }
{ type: "page", id: 1, items: [{ item, version }], cursor?: "…" }
{ type: "change", id: 1, change: "ADDED" | "MODIFIED" | "REMOVED", key, item?, version, origin }
{ type: "batch", id: 1, marker: { type: "BATCH_STARTED" | "BATCH_FINISHED", origin, count?, status? } }
{ type: "error", id?: 1, code, message }
```

- `REMOVED` では `item` を省き、`key` と `version` だけを送る
- `error` に `id` があれば、その購読は終わっている（`authorize` の失敗は `FORBIDDEN`、ページのトークンの誤りは `INVALID_CURSOR` など）。`id` がなければ接続全体のエラー。接続全体の `UNAUTHENTICATED` の後は、Gateway が接続を閉じる（コード 4401）
- `auth` には成功の応答を返さない。失敗したときだけ、上のエラーで知らせる
- `change` の種類は、Gateway が `matches(Before)` / `matches(After)` で決めたもの（範囲の条件による出入り）。progressive のウィンドウによる出入りは、クライアントが決める

## 基本方式

**バックエンドRepositoryによる書き込みから変更イベントを生成する（ラッパー方式）**。

[書き込み](../../zod-dynamodb-node/docs/writes.ja.md)の方式で得た正確なBeforeとAfterを、トピック（「トピックと配信先の判定」）に発行する。所属判定は、配送基盤から受け取ったGateway（[Realtime Gateway](../../zod-dynamodb-realtime/docs/gateway.ja.md)）が購読ごとに行う。

```text
UpdateItem（差分、where、ReturnValues: ALL_OLD）
       │
       ▼
Before（ALL_OLD）
       │
       ▼
After = Before に変更をJSで適用
       │
       ▼
Before / After からトピックを求めて発行（MQTT）
       │
       ▼
Gateway：購読ごとに matches(Before) / matches(After)
       │
       ▼
ADDED / MODIFIED / REMOVED をクライアントに送る
```

所属判定には、名前付きクエリの宣言から得た `matches` を使う（[名前付きクエリ](../../zod-dynamodb-node/docs/queries.ja.md)）。

## Before / Afterの判定

| 更新前 | 更新後 | イベント |
|---|---|---|
| 対象外 | 対象内 | ADDED |
| 対象内 | 対象内 | MODIFIED |
| 対象内 | 対象外 | REMOVED |
| 対象外 | 対象外 | 配信不要 |

この判定は、Itemの物理的なCreate/Update/Deleteとは分けて考える。

判定は購読ごとに行う。例えば `status` が `todo` から `done` に変わった場合、変更はBeforeから求めた `…/todo` のトピックと、Afterから求めた `…/done` のトピックの両方に発行される。`todo` の購読者には `REMOVED`、`done` の購読者には `ADDED` が届く。範囲の条件だけが変わった場合（`priority` の変更など）は、同じトピックの上で、購読ごとの範囲に応じて `ADDED` / `MODIFIED` / `REMOVED` が決まる。

## DynamoDB書き込みと配信の非原子性

DynamoDBへの書き込みと配送基盤へのPublishは、一つの原子的なトランザクションにはならない。

```text
DynamoDB書き込み成功
        │
        ▼
Event Publish失敗
```

この欠落は [再接続と再同期](../../zod-dynamodb-client/docs/live-sync.ja.md) の範囲（Versionと再同期による回復）で扱う。Publishの失敗は `onPublishError`（既定は `console.error`）に渡し、再試行はしない。大きさの上限（`maxMessageBytes`、既定 128KB）を超えたメッセージも、発行せずに同じく渡す。

## ラッパー方式の限界とDynamoDB Streams

ラッパー方式では、ライブラリを経由しない書き込み（マイグレーション、管理スクリプト、コンソールからの操作など）はイベントにならない。

これが問題になる場合の代替として、DynamoDB Streamsを起点にイベントを生成する方式がある。Streamsは変更前後のItemを提供するため、その場合は [書き込み](../../zod-dynamodb-node/docs/writes.ja.md) のAfterの組み立てはイベント生成のためには不要になる。書き込みの方式（差分更新と `where` 条件）は変わらない。

ラッパー方式とStreams方式は二者択一である。Streams方式は作らず、イベントの発行を `ChangeListener` のインターフェースとして分離しておく。

## 一括での書き込みとイベント

一括での書き込み（[ベクトル検索](../../zod-dynamodb-node/docs/vector-search.ja.md)）も、リアルタイムの変更イベントの対象とする。

- 一括での書き込みごとにIDを発行し、開始イベントと終了イベントを配信する
- 個々のItemの変更イベントにも、そのIDを含める
- 開始・終了イベントは、書き込みの範囲（`HASH` の範囲など）から決まるトピック（「トピックと配信先の判定」）に配信する。そのため、一括での書き込みは開始時に範囲を宣言する
- 終了イベントには、書き込んだ件数と、成功したか中断したかを含める

これにより、クライアントは次のように使い分けられる。

- 通常どおり個々のイベントを適用する
- 開始から終了までの個々のイベントを適用せずに待ち、終了イベントを受け取ったらSnapshotを取り直す（大量のイベントを個別に処理しないで済む）

書き込み元のIDは、一括での書き込みに限らず、すべての変更イベントに持たせる。

```ts
{
  type: "ADDED" | "MODIFIED" | "REMOVED",
  key, item, version,
  origin: { kind: "single" | "transaction" | "batch", id: string },
}
```

`kind: "batch"` は一括での書き込み（[ベクトル検索](../../zod-dynamodb-node/docs/vector-search.ja.md)）を指す。runnerの `createBatch`（[書き込み](../../zod-dynamodb-node/docs/writes.ja.md)）による書き込みは `"transaction"` とする。同じトランザクションで発生したイベントにも共通のIDが付くので、監査や、関連する変更をまとめて扱う用途に使える。

一括での書き込みは、更新前のItemを読まない（[ベクトル検索](../../zod-dynamodb-node/docs/vector-search.ja.md)）。そのため、新しいItemの書き込み（`ADDED`）を前提とする。既存のItemを上書きする場合は、通常の書き込みの経路（[書き込み](../../zod-dynamodb-node/docs/writes.ja.md)）を使う。
