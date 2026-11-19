# サーバー側の購読 API と、taskmanager の revocations

今の仕様は、`subscribeOnServer` とサーバー専用の `live` が [zod-dynamodb の README](../../packages/zod-dynamodb/README.ja.md) と [共有の定義](../../packages/zod-dynamodb/docs/shared-definitions.ja.md)、Gateway の `revalidate` が [Realtime Gateway](../../packages/zod-dynamodb-realtime/docs/gateway.ja.md)、taskmanager の流れが [taskmanager の README](../../apps/taskmanager/README.md) にあります。

## 目的

メンバーを外す、ロールを変えるなどで権限が変わったとき、リアルタイムの接続にすぐ反映させる。Realtime Gateway が複数の台にあっても、すべての台に届くようにする。

## 決めたこと

- **ライブラリには取り消し専用の仕組みを作らない。** アプリが「誰の権限が変わったか」を普通のデータとして書き、受け取った各台が `realtime.revalidate` を呼ぶ。取り消しの形（何を単位に、どれだけ残すか）はアプリごとに違うため
- **サーバーのコードが live のクエリを購読する補助（`subscribeOnServer`）を足す。** それまでは、トピックの導出・メッセージの復元・配送の購読を自分で組み合わせるしかなかった。Node に依存しないので `@zodapp/zod-dynamodb` に置く。最初のページは読まず、認可もしない（サーバーのコードが自分で使うもの）
- **`authorize` のない（サーバー専用の）操作にも `live` を付けられるようにする。** 取り消しのようなサーバー専用の購読も、ほかの live のクエリと同じく登録簿の 1 行で宣言でき、書き込み側の発行がそのまま働く。Gateway はサーバー専用のエントリーを公開しない
- **何もしなければ、認証コンテキストの期限（taskmanager では最長 5 分）までは使える**という既定の動きは変えない。取り消しはそれを早めるもの
- **taskmanager では、取り消しを固定のパーティションに書く。** トピックはパーティションで決まるので、メールアドレスをパーティションにすると、各台が全員分を 1 つのトピックで受け取れない。Item は数分の TTL で消す（期限の作り直しで反映済みになるため）。書いた台も自分の購読で受け取るので、台の数によらず同じ経路になる

## 採らなかった案

- **`defineEndpoints` は変えず、`subscription(query)` で作った定義を、発行と購読の補助の両方に渡す。** 宣言が 2 か所に分かれ、発行し忘れが起きやすいので採らなかった
