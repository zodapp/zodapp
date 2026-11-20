# リアルタイムの同期

[English](live-sync.md)

## SnapshotとSubscription

リアルタイム同期には、現在の状態を取得するSnapshotと、その後の変更を受け取るSubscriptionの両方が必要となる。

単純に次の順序で処理すると、取りこぼしが発生する可能性がある。

```text
1. Snapshot取得
2. Subscription開始
```

Snapshot取得後、Subscription開始前に発生した変更を受け取れないためである。

逆にSubscriptionを先に開始しても、それだけで正確な初期状態が保証されるわけではない。

## 初期同期の手順

次の手順を標準とする。

```text
1. Subscriptionを開始し、届いたイベントはキーごとに「最新のversionと値（削除ならTombstone）」として覚える
2. Subscriptionの準備完了（ready。配送基盤が購読を受け付けた）を待つ
3. Snapshotをページ単位で取得する（各Itemのversionを含む）
4. ページのItemと覚えていた値をversionで突き合わせ、新しい方を残す
5. 以降はイベントを継続的に適用する
```

この手順はクライアントで行う。サーバー（Gateway）は購読とページの部品を提供するだけである（[Realtime Gateway](../../zod-dynamodb-realtime/docs/gateway.ja.md)）。

**全体と progressive**

|                | 全体の購読                                                             | progressive（`pageSize` を指定）                   |
| -------------- | ---------------------------------------------------------------------- | -------------------------------------------------- |
| 次のページ     | `cursor` がなくなるまで自動で頼む。`maxSnapshotItems` を超えたらエラー | `fetchMore` のときだけ頼む                         |
| 一覧に出すもの | 条件に合うものすべて                                                   | ウィンドウ（最後に読んだページの境界まで）の中だけ |
| 再接続         | 1 からやり直す（Tombstone は残す）                                     | 1 からやり直し、読み込んでいた件数まで読み直す     |

- 一覧の並び順は、名前付きクエリの Sort Key と方向に合わせる（同じ Sort Key の Item はベーステーブルのキーの順）
- ウィンドウは件数ではなく Sort Key の境界で決まるので、「上位 N 件」から押し出される問題（[Subscription定義](../../zod-dynamodb/docs/realtime.ja.md)）は起きない。新しい Item が来れば、一覧はそのまま伸びる
- ウィンドウの外の変更は 60 秒だけ覚えて捨てる。GSI は結果整合性なので、変更の直後に遡って読んだページが古いことがあり、それを `version` で直すためである
- 読み直しの途中は、前の一覧を出したままにする
- 一括での書き込み（[一括での書き込みとイベント](../../zod-dynamodb/docs/realtime.ja.md)）は、既定では個々のイベントを適用する。`onBatch: "reload"` を指定すると、開始から終了までのそのイベントを適用せずに待ち、終了で読み直す

この手順を成立させるために、次の条件を設ける。

- SnapshotにはItemの `version` を含める。`ALL` のスロットではGSIから `_version` が得られる。`KEYS_ONLY` / `INCLUDE` のスロットでは、BatchGetItemで本体を強い整合性で読むときに得る（[名前付きクエリ](../../zod-dynamodb-node/docs/queries.ja.md)）。このため `INCLUDE` に `_version` を含める必要はない
- 削除や購読対象からの除外（`REMOVED`）にも `version` を持たせる
- クライアントは、`REMOVED` を受け取ったItemを、その `version` とともにTombstoneとしてメモリ上に保持する。保持するのは購読している間ずっととし（progressive ではウィンドウの中のもの。外のものは 60 秒）、購読をやめれば捨てる。取り直したSnapshotも古いことがあるため、Snapshotを取り直しても捨てない。Tombstoneはキーと `version` だけなので、メモリへの影響は小さい

Tombstoneがないと、GSIの結果整合性によって遅れて取得されたSnapshotが、すでに削除されたItemを復活させてしまう。

GSIからの読み取りは常に結果整合性であり、強い整合性で読めない。上記の手順は、この遅れを `version` の比較で吸収するためのものである。

この手順により、**イベントが欠落しない限り**、クライアントの状態はサーバーの状態に収束する。

## Item Version

Item単位のVersionを導入する。

```ts
{
  workspaceId: "ws1",
  taskId: "task1",
  version: 12,
  ...
}
```

`version` は作成時に1とし、更新のたびに `UpdateItem` の `ADD` で1ずつ増やす（[書き込み](../../zod-dynamodb-node/docs/writes.ja.md)）。変更イベントにもVersionを含める。

`version` は同期プロトコルのメタ情報であり、Snapshotや変更イベントの中でItem本体とは別に運ぶ。Repositoryの読み取り結果（[各Schemaと型の役割](../../zod-dynamodb/docs/table-definition.ja.md)）や、クライアントがアプリケーションに渡すデータには含めない。上の例は概念を示すもので、Item本体のフィールドとして `version` を持つ意味ではない。

これにより、フロントエンドでは以下を判断できる。

- 重複したイベント
- 既に適用済みのイベント
- 古いイベント
- 明らかなVersionの飛び

ただし、Item単位のVersionでは、イベントの欠落そのものは検出できない。検出するには、トピック単位の連番が必要になる。

## 再接続と再同期

**再接続時にSnapshotを取り直す**ことを基本の復旧方法とし、保証する範囲を次のように明示する。

- 接続中は、イベントが欠落しない限り状態は収束する
- 接続が切れた場合は、再接続後のSnapshot再取得によって回復する
- 接続中のイベント欠落（配送基盤の取りこぼし、Publish失敗）は、検出を保証しない。必要に応じて定期的なSnapshot再取得で回復する

変更履歴のReplayや、トピック単位の連番による欠落検出は行わない。

クライアントは接続を 1 本だけ持ち、切れたら間隔を広げながら（既定 0.5 秒から 2 倍ずつ、上限 30 秒）再接続して、すべての購読を 1 からやり直す。購読がなくなったら接続を閉じる。
