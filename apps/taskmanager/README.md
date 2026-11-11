# taskmanager：zod-dynamodb の E2E サンプル

zodapp にあったタスク管理のデモ（`firebase-final` の `apps/web`）を、Firestore から zod-dynamodb（DynamoDB）に置き換えて移植したアプリケーションです。
登録簿（`defineEndpoints`）、サーバーの API、Realtime Gateway、React の hooks を、ブラウザからデータベースまで通して動かします。

この README は、手元のマシンと Claude Code のクラウド環境で動かす構成（ローカル版）について書いています。
本番の構成（ECS・IoT Core・CDK）は、別のプランで追加します。

## 構成

| 役割 | ローカル版 | 本番での置き換え先 |
|---|---|---|
| データベース | DynamoDB Local（Docker、`:8000`） | DynamoDB |
| 認証 | magnito（Cognito のエミュレーター、Docker、`:5050`） | Cognito |
| ファイル（アバター画像） | S3Proxy（Docker、`:8081`） | S3 |
| リアルタイムの配送 | aedes（サーバーのプロセスの中、`:1883`） | IoT Core |
| 認証のメール | メールの記録（`pnpm mail`、SMTP `:2500`、HTTP `:2501`） | SES |
| API と Realtime Gateway | Express（`:4000`、`/api`、`/api/realtime`） | ECS |
| 画面 | Vite（`:3000`、`/api` をサーバーへ中継） | CloudFront + S3 |

Docker で動かすのは DynamoDB Local・magnito・S3Proxy の 3 つです（`infra/compose.yml`）。サーバー・画面・メールの記録は Node.js で直接動かします。

```
src/
  shared/   ブラウザとサーバーで共有する定義（Table定義、操作、認可、登録簿）
  server/   API、認証（ID トークンの検証）、S3 の署名付き URL、Realtime Gateway
  web/      画面（zodapp からの移植）
e2e/        Playwright のテスト
infra/      docker compose
scripts/    インフラの起動、メールの記録
```

## 動かす

必要なもの：Node.js 22 以上、pnpm、Docker（Docker Desktop、または dockerd）。

```bash
pnpm install                          # リポジトリのルートで
cd apps/taskmanager
pnpm infra:up                         # DynamoDB Local・magnito・S3Proxy を起動
pnpm mail                             # メールの記録（別のターミナル）
pnpm dev                              # サーバーと画面（別のターミナル）
```

<http://localhost:3000> を開きます。サーバーは起動のたびに、テーブル・バケット・開発用のユーザーを（なければ）作ります。

| ユーザー | パスワード |
|---|---|
| `alice@example.com` | `Passw0rd!` |
| `bob@example.com` | `Passw0rd!` |
| `vic@example.com` | `Passw0rd!` |

新しいユーザーでサインアップすると、magnito が確認コードのメールを送ります。メールはメールの記録が受け取り、ターミナルに出します。
HTTP でも読めます：`curl 'http://localhost:2501/messages/latest?to=you@example.com'`

止めるときは `pnpm infra:down` です。DynamoDB Local はメモリーで動かしているので、止めるとデータは消えます。

### Claude Code のクラウド環境では

- dockerd が動いていないので、`pnpm infra:up` が dockerd を起動してから docker compose を実行します（root で動いているときだけ。ログは `/tmp/dockerd.log`）
- Docker Hub がまれに `429 Too Many Requests` を返します。少し待ってから `pnpm infra:up` をやり直してください
- Playwright は、環境に入っている Chromium をそのまま使います（`playwright install` は不要です）

## テスト

```bash
pnpm test        # 共有の定義のテスト（DynamoDB Local を使う）
pnpm e2e         # Playwright の E2E
pnpm check-types # 型チェック（画面とサーバー）
```

`pnpm e2e` の前に `pnpm infra:up` を済ませておきます。メールの記録と `pnpm dev` は、起動していなければ Playwright が起動します。
各テストの動画は `test-results/` に、結果は `playwright-report/` に残ります（`npx playwright show-report`）。

E2E のシナリオは次の 8 つです。
Playwright が起動するサーバーは、認証の期限を 20 秒に縮めて動かします（`AUTH_MAX_AGE_SECONDS=20`）。どのシナリオも、トークンの入れ替えをまたいで動くことを確かめるためです。
`pnpm dev` を先に起動しておくとそれを使うので、そのときは `AUTH_MAX_AGE_SECONDS=20 pnpm dev` で起動してください（`08-token-refresh` は、そうでなければ失敗します）。

| ファイル | 確かめること |
|---|---|
| `01-signup` | サインアップし、メールの記録から確認コードを取って確認し、ログインする |
| `02-create` | ワークスペース・メンバー・プロジェクト・タスクを画面で作る。メンバーのアバター画像を S3 にアップロードし、読み直す |
| `03-realtime` | alice と bob の 2 つのブラウザで同じプロジェクトを開き、alice の作成・ステータスの変更・ゴミ箱への移動が bob の一覧にすぐ届く（bob の画面の動画も残す） |
| `04-authorization` | 閲覧者は新規作成のボタンが押せず、詳細は読み取り専用。API を直接呼んでも `FORBIDDEN`。所属していないワークスペースは読めない |
| `05-reconnect` | Realtime の接続が切れている間の変更が、つながり直したときの読み直しで一覧に出る |
| `06-test-data` | 期限つきのタスクを、サーバーのルート（`bulkWrite`）でまとめて入れられる |
| `07-revoke` | alice が bob をメンバーから外すと、bob の開いている一覧に「権限がありません」が出て、そのあとの変更は bob に届かない |
| `08-token-refresh` | 認証の期限を 2 回以上またいでも、Realtime の接続は 1 本のまま（`auth` メッセージでトークンを入れ替える）で、変更が届き続ける |

### CI

E2E は、GitHub Actions の `E2E (sample)`（`.github/workflows/e2e.yml`）でも回します。ライブラリの CI（`ci.yml`）とは別のワークフローで、必須のチェックではありません。

- 走るのは、`apps/taskmanager`・`packages`・`zodapp`・`pnpm-lock.yaml` が変わった PR と main への push、それと手動（Actions の画面の「Run workflow」）です
- コンテナは手元と同じ `pnpm infra:up` で立てます。イメージのタグは、CI で通ったバージョンに固定しています（`infra/compose.yml`）
- 各テストの動画とレポートは、実行の結果のページの artifact（`e2e-report`、14 日）からダウンロードできます。展開した `playwright-report` を `npx playwright show-report <dir>` で開きます

## 認証と Realtime の接続

- サーバーの API は、リクエストから ID トークンを取り出し（`credential`）、検証してロールを読み、認証コンテキストを作ります（`context`）。コンテキストの期限は、トークンの `exp` と「作ってから 5 分」の早いほうで、操作の認可のたびに確かめます（`expiresAt`。データベースは読みません）
- HTTP では、リクエストのたびにコンテキストを作るので、ロールの変更はすぐに効きます
- Realtime の接続では、接続したときにコンテキストを作ります。ブラウザは、トークンの期限の少し前に取り直して `auth` メッセージで送り、接続を保ったまま入れ替えます（`src/web/shared/api.ts`）
- Realtime Gateway は、コンテキストの寿命の 8 割で、同じトークンからコンテキストを作り直します。ロールの変更は、`revalidate` がなくても 5 分以内に反映されます
- メンバーが変わったら（追加・ロールの変更・削除）、サーバーはその人の接続のコンテキストを作り直します（Repository の `listener` から `revalidate`。`src/server/main.ts`）。外された人の開いている一覧は `FORBIDDEN` で止まり、画面に「権限がありません」が出ます
- 期限が切れたトークンのままの接続は、次の配信の前に閉じられます。ブラウザはつながり直し、そのときに新しいトークンを渡します
- Realtime Gateway は、upgrade の Origin ヘッダーを画面のオリジンと比べ、ほかのサイトからの接続を 403 で拒否します。画面のオリジンは環境変数 `APP_ORIGIN`（カンマ区切りで複数。既定は `http://localhost:3000`）で変えられます
- 登録簿（`src/shared/endpoints.ts`）は、`defineContext<Auth>()` が返す `defineEndpoints` で作ります。別の `defineContext` の操作や、書き込みへの `GET` などは型のエラーになります

## 移植で置き換えたもの

| zodapp（Firestore） | このアプリ（zod-dynamodb） |
|---|---|
| `collectionConfig` と `createCollectionQueries` | `tableConfig` と `createOps`（`src/shared/tables/`） |
| `useList` / `useGrowingList` / `useDoc` | `createUseList(..., { live: true })` / `createUseItem`（`src/web/shared/hooks.ts`） |
| Firestore のセキュリティルール | 操作の `authorize`（ブラウザでは `can` で同じ判定をする） |
| Firebase Auth | Amplify v6 の `aws-amplify/auth`（magnito に向ける） |
| `createFirestoreResolver`（外部キーの選択肢） | `createDynamoExternalKeyResolver`（`src/web/shared/resolvers.ts`） |
| Firebase Storage | S3 の署名付き URL（`/api/files/*`） |
| `runTransaction` / `WriteBatch`（ブラウザから） | サーバーのルートでの `runTransaction` と `bulkWrite`（`src/server/routes.ts`） |
| Firestore の where（サーバー絞り込み） | Index のキーでの絞り込み。残りの条件はブラウザで絞る |

タスク一覧の検索条件のうち、ステータスは Index（`byStatus`）で、優先度や期限はブラウザで絞ります。DynamoDB はキーでしか絞り込めないためです。
