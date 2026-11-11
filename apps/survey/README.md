# survey：質問をデータとして持つアンケート（zod-dynamodb のサンプル）

質問の定義（短文・数値・選択・日付など）をアンケートの Item に保存し、実行時に Zod のスキーマへ組み立てて、
回答フォーム・回答の表・回答の詳細に使い回すサンプルです。
zodapp にあったアンケートのデモ（`firebase-final` の `apps/web`）を、Firestore から zod-dynamodb（DynamoDB）に移植しました。

taskmanager が「スキーマをコードで書くアプリ」の例なのに対して、このアプリは次のことを示します。

- **スキーマを実行時に作る**：`buildSurveySchema()` が質問の定義から `z.object` を組み立てる。回答フォーム（`AutoForm`）、回答の表の列（`AutoTable`）、読み取り専用の詳細が、同じスキーマを使う
- **ビルダーとライブプレビュー**：質問の定義そのものを `discriminatedUnion` のフォームで編集し、編集中の値からプレビューを組み立てる（`SurveyBuilder.tsx`）
- **版の管理**：公開のたびに版（`revision`）を原子的に 1 上げ（`o.mutation` の `add`）、回答は回答時の版を持つ。定義が変わった後の古い回答も表示できる
- **横断と絞り込み**：回答はワークスペースの直下に置き、全回答（`responses.all`）とアンケートごと（`responses.bySurvey`、Index）を読み分ける
- **外部キーの選択肢**：回答の「アンケート」「回答者」を、登録簿の live なクエリ（`@zodapp/zod-form-dynamodb`）から選ぶ

## 構成

| 役割 | ローカル版 | 本番での置き換え先 |
|---|---|---|
| データベース | DynamoDB Local（Docker、`:8000`） | DynamoDB |
| 認証 | magnito（Cognito のエミュレーター、Docker、`:5050`） | Cognito |
| リアルタイムの配送 | aedes（サーバーのプロセスの中、`:1883`） | IoT Core |
| 認証のメール | メールの記録（`pnpm mail`、SMTP `:2500`、HTTP `:2501`） | SES |
| API と Realtime Gateway | Express（`:4000`、`/api`、`/api/realtime`） | ECS |
| 画面 | Vite（`:3000`、`/api` をサーバーへ中継） | CloudFront + S3 |

ファイルの項目はないので、S3 は使いません（ファイルの例は `apps/taskmanager` のアバター画像）。
ポートは taskmanager と同じです。両方を同時には動かせないので、片方の `pnpm infra:down` をしてから、もう片方を起動してください。

```
src/
  shared/
    tables/   Table 定義と操作（workspace・member・survey・response）
    survey/   質問の定義（fieldDefs）、スキーマの組み立て（buildSurveySchema）、回答の保存の形（answers）、フィクスチャ
  server/     API、認証（ID トークンの検証）、Realtime Gateway、テストデータのルート
  web/        画面
e2e/          Playwright のテスト
infra/        docker compose
scripts/      インフラの起動、メールの記録
```

## 動かす

必要なもの：Node.js 22 以上、pnpm、Docker（Docker Desktop、または dockerd）。

```bash
pnpm install                          # リポジトリのルートで
cd apps/survey
pnpm infra:up                         # DynamoDB Local・magnito を起動
pnpm mail                             # メールの記録（別のターミナル）
pnpm dev                              # サーバーと画面（別のターミナル）
```

<http://localhost:3000> を開きます。サーバーは起動のたびに、テーブルと開発用のユーザーを（なければ）作ります。

| ユーザー | パスワード |
|---|---|
| `alice@example.com` | `Passw0rd!` |
| `bob@example.com` | `Passw0rd!` |
| `vic@example.com` | `Passw0rd!` |

ワークスペースを作ったら、サイドバーの「テストデータ」で、アンケートの定義（公開中・下書き・削除済みの 3 件）とダミーの回答を入れられます。
「回答ページを開く」で別のタブに回答ページを開くと、手で入れた回答とダミーの回答が同じ一覧に並びます。

止めるときは `pnpm infra:down` です。DynamoDB Local はメモリーで動かしているので、止めるとデータは消えます。
Claude Code のクラウド環境での注意は、`apps/taskmanager/README.md` と同じです。

## テスト

```bash
pnpm test        # 共有の定義のテスト（スキーマの組み立て、フィクスチャ、回答の変換、Table の操作。DynamoDB Local を使う）
pnpm e2e         # Playwright の E2E
pnpm check-types # 型チェック（画面とサーバー）
```

| ファイル | 確かめること |
|---|---|
| `01-signup` | サインアップし、メールの記録から確認コードを取って確認し、ログインする |
| `02-survey` | アンケートを作って公開する（版が 1 になる）。テストデータの定義を入れ、回答ページから答えると、そのアンケートの回答一覧に質問の列で出る。詳細は回答フォームと同じスキーマで表示する |

## 回答の保存の形

回答（`answers`）は、質問の ID をキーにした `Record<string, string | number | boolean>` で保存します（`src/shared/survey/answers.ts`）。

- zod-dynamodb と JSON の通信は、スキーマに沿って値を変換します。`z.unknown()` では Date を戻せないので、値の型を限っています
- 日付の質問は `YYYY-MM-DD` の文字列で保存し、フォームや表に出すときに Date に戻します（`toStoredAnswers` / `fromStoredAnswers`）
- 未回答の項目は保存しません

## 移植で置き換えたもの

| zodapp（Firestore） | このアプリ（zod-dynamodb） |
|---|---|
| `surveys` / `responses` のコレクション | `tableConfig` と `createOps`（`src/shared/tables/survey.ts`・`response.ts`） |
| `updateDoc` での公開（`revision + 1` をブラウザで計算） | `surveys.publish`（`add: { revision: 1 }` でサーバーが原子的に加算） |
| `useList` / `useGrowingList` / `useDoc` | `createUseList(..., { live: true })` / `createUseItem`、画面の状態で切り替える一覧は `useListStore` |
| Firestore のセキュリティルール | 操作の `authorize`（ブラウザでは `can` で同じ判定をする） |
| `createFirestoreResolver`（外部キーの選択肢） | `createDynamoExternalKeyResolver`（`src/web/shared/resolvers.ts`） |
| 列設定のプロファイル（Firestore に保存） | このブラウザ（localStorage）だけに保存（`src/web/shared/useLocalColumnSettings.ts`） |
| ブラウザからの回答の一括投入 | 1 件ずつは API、まとめてはサーバーのルート（`/api/test-data/responses`、`bulkWrite`） |
