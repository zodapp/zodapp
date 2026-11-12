# サーバー側の購読 API と、taskmanager の revocations

- ステータス: 実装済み
- 対象ブランチ: `claude/project-thread-bf3pyv`（main から分岐）

## 1. 背景と方針

- サーバーのアプリのコードが live のクエリを購読するには、いまは `topicForSubscriber`、
  `topicMessageCodec`、`RealtimeTransport.subscribe` を自分で組み合わせるしかない。
  これを 1 つの関数にまとめた汎用の補助を、ライブラリに足す。
- ライブラリには revoke 専用の仕組みを作らない。アプリが「誰の権限が無効になったか」を普通のデータとして
  配り、受け取った各台が、今ある `realtime.revalidate` を呼ぶ。
- taskmanager のサンプルで、この形を標準の形として示す（サンプルなので判断は軽い）。
- 何もしなければ、認証の期限（最長 5 分）までは使える、という既定の動きは変えない。

## 2. ライブラリ

### 2.1 サーバー専用の live（`defineEndpoints`）

いまは `authorize` のない操作（サーバー専用）に `live` を付けると `DefinitionError` になる。
これを許す。

- サーバー専用の live のエントリーは、`subscription` を持つ（Publisher がこれを見て発行する）。
- Realtime Gateway は、サーバー専用のエントリーを公開しない（ブラウザから名前を指定しても
  `unknown subscription` で `INVALID_INPUT`）。
- `path` は引き続き付けられない（HTTP では公開しない）。

こうすると、revocations のようなサーバー専用の購読も、ほかの live のクエリと同じく登録簿の 1 行で
宣言でき、Publisher（`mqttPublisher({ endpoints })`）がそのまま発行する。

> 代わりの案：`defineEndpoints` は変えず、`subscription(query)` で作った定義を、Publisher の
> `subscriptions` と購読の補助の両方に渡す。宣言が 2 か所に分かれ、発行し忘れが起きやすいので採らない。

### 2.2 購読の補助 `subscribeOnServer`（`@zodapp/zod-dynamodb`）

```ts
const subscription = await subscribeOnServer({
  endpoints,                 // 登録簿
  transport,                 // RealtimeTransport（Gateway とは別の接続を推奨）
  prefix: "taskmanager",     // 書き込み側と揃える
  op: revocationOps.recent,  // live を付けたクエリ（サーバー専用でも、そうでなくてもよい）
  params: {},
  context: undefined,        // 範囲が認証コンテキストで決まるクエリのときだけ
  onChange: (event) => { ... },
  onError: (error) => { ... }, // 既定は console.error
});
await subscription.close();  // 配送の購読をやめる
```

- 置き場所は `@zodapp/zod-dynamodb`（配送のインターフェースとトピックの導出と同じところ。Node に依存しない）。
- `op` から登録簿のエントリーを引き、`live` がなければ `DefinitionError`。
- トピックは `topicForSubscriber` で求め、届いたメッセージは `topicMessageCodec` で戻し、
  `classifyChange`（クエリの `matches`）で範囲に入る変更だけを渡す。
- `onChange` に渡すもの：`{ type: "ADDED" | "MODIFIED" | "REMOVED", key, item, before, after, origin }`。
  `item` は ADDED / MODIFIED なら `after`、REMOVED なら `before`。フィールドは live の `fields` に絞る。
  一括の書き込みの印（`batch`）は渡さない。
- 最初のページは読まない（購読を始めたあとの変更だけ）。今の状態が要るなら、アプリが Repository で読む。
- 配送基盤が購読を受け付けた（SUBACK）ところで解決する。
- 配送は 1 つのトピックにハンドラーを 1 つしか持てないので、同じトピックを 2 回購読すると例外にする。
  Gateway と同じ配送を使うと、同じトピックで衝突しうるので、別の接続を推奨とドキュメントに書く。
- 認可は行わない（サーバーのコードが自分で使うもの）。

### 2.3 テスト

- `defineEndpoints`：サーバー専用の live を受け付ける。サーバー専用に `path` を付けたら、引き続き例外。
- Gateway：サーバー専用の live の名前で購読すると `INVALID_INPUT`。
- `subscribeOnServer`：`memoryTransport` と `createChangePublisher` で、ADDED / MODIFIED / REMOVED が届く。
  範囲外の変更は届かない。`close` のあとは届かない。live のない操作は例外。

### 2.4 ドキュメント

- パッケージの README と CHANGELOG（日英）に、サーバー専用の live と `subscribeOnServer` を書く。

## 3. taskmanager のサンプル

### 3.1 revocations の Table定義

```ts
export const revocations = tableConfig({
  table: appTable,
  entity: "Revocation",
  item: z.object({
    scope: z.literal("all"),   // 全員が 1 つのトピックを購読するための固定の値
    email: z.string(),         // 対象のメールアドレス（小文字）
    revokedAt: z.number(),     // ミリ秒
    ttl: z.number(),           // DynamoDB の TTL（秒）。数分後に消える
  }),
  key: { partition: ["scope"], sort: ["email"] },
});

export const revocationOps = createOps(revocations, (o) => ({
  /** 全員の revoke。サーバー専用（authorize なし） */
  recent: o.query({ params: z.object({}), where: () => ({ partition: { scope: "all" } }) }),
}));
```

- キーは対象のメールアドレス。ただしパーティションは固定の値にする。トピックはパーティション（と Sort Key の
  等値の部分）で決まるので、メールアドレスをパーティションにすると、各台が全員分を 1 つのトピックで
  受け取れないため。
- 同じ人がまた変われば、同じ Item を上書きする（上書きでも変更として配られる）。
- 期限は 5 分（認証の期限の最長と同じ。それより古い revoke は、期限の作り直しで反映済み）。
- TTL の有効化は、ローカルのテーブル作成（`src/server/dynamo.ts`）と AWS の CDK（`infra/cdk/stack.ts` の
  `timeToLiveAttribute`）に入れる。属性の名前（`TTL_ATTRIBUTE`）は `src/shared/table.ts` に置く。
- 登録簿に `revocations: [{ op: revocationOps.recent, live: true }]` を足す（サーバー専用。パスなし）。

### 3.2 書く側

- Repository の `listener` で Member の変更（追加・ロールの変更・削除）を見つけたら、その人のメールアドレスで
  revocations に 1 件書く。今の `realtime.revalidate()` の直接の呼び出しは消す。

### 3.3 受ける側

- 起動時に、Gateway とは別の配送の接続で `subscribeOnServer` を使って `revocations.recent` を購読する。
- ADDED / MODIFIED が届いたら、`realtime.revalidate((ctx) => ctx.email === item.email)`。
  外された人の一覧は `FORBIDDEN` で止まり、ロールが変わった人は新しいロールで続く。
- 書いた台も自分の購読で受け取るので、台の数によらず同じ経路になる。Realtime Gateway を 2 台以上にしても、
  revoke がすべての台に届く。
- 終了時に購読を閉じる。

### 3.4 README

- 「メンバーが変わったら…」の段落を、revocations の流れに書き換える。
- 名前は revocations だが、権限が増えた場合（追加・ロールを上げた）にもすぐ効くことを一言書く。
- 何もしなければ認証の期限（最長 5 分）まで使える、既定の動きであることを書く。

### 3.5 確かめること

- `pnpm -w turbo run lint typecheck test`（変えたパッケージ）。
- taskmanager の E2E の `07-revoke`（ローカル）が通る。

## 4. 他のブランチとの関係

- taskmanager の AWS の作業（`src/server/main.ts` の `connection(name)` で IoT Core につなぐ）の上に載せ替えた。
  revocations の購読も `connection("revocations")` でつなぐので、IoT Core でも動く（クライアント ID は
  `taskmanager-revocations-…` で、IAM のポリシーの `client/taskmanager-*` に収まる）。
