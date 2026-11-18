# サンプルで、まだ使っていないライブラリの機能を使う

## 目的

`@zodapp/*` の公開 API のうち、サンプル（form-demo・taskmanager・survey）が直接も間接も使っていないものを、既存のサンプルで使う。利用者が写すサンプルに使い方を示し、実際のアプリの中で動くことを確かめるため。ライブラリの内部で使われていて、サンプルが別の API を通して動かしているもの（`labelOf`・`onceItemStore`・`handleEntry` など）と、ベクトル検索は対象にしない。

## 決めたこと

機能ごとに、使い方が自然に見えるアプリと場面を選んだ。

| 機能 | アプリ | 使い方 |
|---|---|---|
| `override()` | taskmanager | タスクの完全削除に、「ゴミ箱にあるものだけ」という `where` をサーバーだけで足す |
| `immutable` | taskmanager | タスクの作成日時を変更不可にする |
| `fields` の pick | taskmanager | 「ゴミ箱を空にする」で、ゴミ箱のタスクをキーだけ読む |
| `check()` | taskmanager | タスクをプロジェクト間で移すトランザクションで、移動先がアクティブであることを、読まずに条件にする |
| `createBatch()` | taskmanager | 「ゴミ箱を空にする」を、書き込みだけの batch で消す |
| `SharedApi`（サーバーの API） | taskmanager | 「ゴミ箱を空にする」のルートで、ゴミ箱の一覧を Repository ではなく認可込みの API で読む |
| `useSessionStorageState` | survey | 回答の途中経過を、タブを閉じるまで残す |
| `memoryTransport` | survey | `MQTT_URL` がなければ、MQTT のブローカーを起動せず、プロセスの中で配送する |
| `useMemoryState` | form-demo | 「表示 / コード」のタブの選択を、デモを切り替えても保つ |

## 採らなかった案

- `useDynamicImportModal`（zod-form-widget）：taskmanager が同じ取り込みの部品（`DynamicImportPanel`）をすでに使っていて、モーダルで包むだけの違いなので外した
