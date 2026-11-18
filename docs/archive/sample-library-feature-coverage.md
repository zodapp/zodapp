# サンプルでまだ使っていないライブラリの機能を、サンプルで使う

## 目的

`@zodapp/*` の公開 API のうち、サンプル（form-demo・taskmanager・survey）が直接も間接も使っていない機能を、既存のサンプルで使う。
ライブラリの内部で使われていて、サンプルが別の API を通して動かしているもの（`labelOf`、`onceItemStore`、`handleEntry` など）は対象にしない。ベクトル検索も対象外とする。

## 割り当て

| # | 機能（パッケージ） | アプリ | 使い方 |
|---|---|---|---|
| 1 | `override()`（zod-dynamodb） | taskmanager | タスクの完全削除（`tasks.remove`）に、ゴミ箱にあるもの（`deletedAt` が入っているもの）だけという `where` を、サーバーだけで足す |
| 2 | `immutable`（zod-dynamodb） | taskmanager | タスクの作成日時（`createdAt`）を変更不可にする |
| 3 | `fields` の pick / omit（zod-dynamodb） | taskmanager | 「ゴミ箱を空にする」で、ゴミ箱のタスクをキーだけ読む |
| 4 | `check()`（zod-dynamodb-node） | taskmanager | タスクをプロジェクト間で移すトランザクションで、移動先のプロジェクトがアクティブであることを、読まずに条件にする |
| 5 | `createBatch()`（zod-dynamodb-node） | taskmanager | 「ゴミ箱を空にする」を、書き込みだけの batch で削除する |
| 6 | SharedApi（zod-dynamodb-node） | taskmanager | 「ゴミ箱を空にする」のルートで、ゴミ箱の一覧を Repository ではなく認可込みの API（`serverApi.tasks.deleted`）で読む |
| 7 | `useSessionStorageState`（react-storage） | survey | 回答の途中経過を、タブを閉じるまで残す |
| 8 | `memoryTransport`（zod-dynamodb） | survey | `MQTT_URL` がないとき、MQTT のブローカー（aedes）を起動せず、プロセスの中でリアルタイムの配送をする |
| 9 | `useMemoryState`（react-storage） | form-demo | 「表示 / コード」のタブの選択を、デモを切り替えても保つ（再読み込みで消える） |

当初の案にあった `useDynamicImportModal`（zod-form-widget）は、taskmanager が同じ取り込みの部品（`DynamicImportPanel`）をすでに使っていて、モーダルで包むだけの違いなので外した。

## taskmanager

### 1. `override()`

- `src/server/overrides.ts` を足し、`override(taskOps.remove, { where: () => ({ deletedAt: { ne: null } }) })` を置く
- `createAppRepository` に `overrides` を渡す
- ブラウザの `can` には効かない（サーバーだけの規則）。ゴミ箱の外のタスクを完全削除しようとすると、条件の失敗になる
- テスト：`tables.spec.ts` で、上書きを入れた Repository でゴミ箱にないタスクの `remove` が失敗し、ゴミ箱のタスクは消せることを確かめる

### 2. `immutable`

- `tasks` の Table 定義に `immutable: ["createdAt"]` を足す
- テスト：`createdAt` を変えようとする更新がエラーになることを確かめる（Repository の `update` で直接）

### 3・5・6. 「ゴミ箱を空にする」

- サーバーのルート `POST /tasks/empty-trash`（`{ workspaceId, projectId }`）を足す
  1. `serverApi.tasks.deleted(params, { context: auth, fields: { pick: ["taskId"] }, cursor })` でゴミ箱のタスクのキーを読む（認可は登録簿の定義で行われる）
  2. 100 件ずつ `repository.createBatch()` に `delete`（`where: { deletedAt: { ne: null } }`）を積んで `commit()` する
  3. 消した件数を返す
- 権限は `canWriteTask`（`tasks.remove` と同じ）。ルートでも確かめる
- タスク一覧のゴミ箱のビューに「ゴミ箱を空にする」ボタンを足す（確認のダイアログ付き）
- `createAppRoutes` に `serverApi` を渡す

### 4. `check()`

- `/tasks/move` で、移動先のプロジェクトを事前に読む代わりに、トランザクションの中で `projects.withContext({ runner: tx }).check(key, { status: "active" })` を使う
- 条件が成り立たない（ない・アーカイブ済み・削除済み）ときは 409 を返す

## survey

### 7. `useSessionStorageState`

- 回答のページ（`survey-public/answer.tsx`）で、入力中の値を `survey-answer-draft:{workspaceId}:{surveyId}` に保存する
- 保存する形は `toStoredAnswers`（日付は `YYYY-MM-DD`）、戻すときは `fromStoredAnswers`
- 値の変化は、AutoForm の `actions` の `custom` で描く小さな部品が `useStore(form.store)` で受け取る
- 送信したら消す
- 「入力中の内容は、このタブを閉じるまで保存されます」と表示する

### 8. `memoryTransport`

- `MQTT_URL` があれば今と同じく MQTT（`mqttPublisher` / `mqttTransport`）
- なければ `memoryTransport()` を 1 つ作り、`createChangePublisher` と `createRealtimeGateway` に同じものを渡す
- aedes の起動と `MQTT_PORT` をなくし、survey の依存から `aedes` を外す
- README の「リアルタイムの配送」の行を直す
- taskmanager は MQTT（ローカルは aedes、AWS では IoT Core）のまま

## form-demo

### 9. `useMemoryState`

- フォームのページ（`pages/form/detail.tsx`）の「表示 / コード」のタブを `useMemoryState("form-demo:detail-tab", "form")` にする

## 確かめること

- `pnpm check-types`、`pnpm build`、`pnpm lint`
- taskmanager と survey の `pnpm test`（DynamoDB Local）
- taskmanager と survey の E2E（動かせる範囲で）
