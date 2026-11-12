# taskmanager：zod-dynamodb の E2E サンプル

zodapp にあったタスク管理のデモ（`firebase-final` の `apps/web`）を、Firestore から zod-dynamodb（DynamoDB）に置き換えて移植したアプリケーションです。
登録簿（`defineEndpoints`）、サーバーの API、Realtime Gateway、React の hooks を、ブラウザからデータベースまで通して動かします。

この README は、手元のマシンと Claude Code のクラウド環境で動かす構成（ローカル版）について書いています。
AWS（ECS Fargate・IoT Core・CDK）に試しにデプロイする手順は、「[AWS で動かす](#aws-で動かす)」にあります。

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

E2E は、GitHub Actions の `E2E (samples)`（`.github/workflows/e2e.yml`）でも回します（survey と別のジョブ）。ライブラリの CI（`ci.yml`）とは別のワークフローで、必須のチェックではありません。

- 走るのは、`apps/taskmanager`・`apps/survey`・`packages`・`pnpm-lock.yaml` が変わった PR と main への push、それと手動（Actions の画面の「Run workflow」）です
- コンテナは手元と同じ `pnpm infra:up` で立てます。イメージのタグは、CI で通ったバージョンに固定しています（`infra/compose.yml`）
- 各テストの動画とレポートは、実行の結果のページの artifact（`e2e-report-taskmanager`、14 日）からダウンロードできます。展開した `playwright-report` を `npx playwright show-report <dir>` で開きます

## AWS で動かす

試験用に、AWS（ECS Fargate の構成）へデプロイできます。CDK のコードは `infra/cdk/` です。使い終わったらすぐに消す前提で、消し忘れても作成・更新から 1 時間でスタックが自分を消します。

```
ブラウザ ── CloudFront ──┬─ S3（フロントエンド。/config.js に Cognito の ID などを入れる）
                        └─ /api/* ─ ALB ─ Fargate 1 台（Express と Realtime Gateway）
Fargate ── DynamoDB、S3（添付ファイル）、Cognito（ID トークンの検証）、IoT Core（変更の配送）
```

| 役割 | ローカル版 | AWS |
|---|---|---|
| データベース | DynamoDB Local | DynamoDB（`burmaculex-<環境名>-taskmanager`） |
| 認証 | magnito | Cognito（確認メールは Cognito の既定の送信。1 日 50 通まで） |
| ファイル | S3Proxy | S3（ブラウザが署名付き URL で直接読み書き） |
| リアルタイムの配送 | aedes | IoT Core（タスクロールで SigV4 の署名をした WebSocket。証明書は使わない。`src/server/iot.ts`） |
| API と Realtime Gateway | Express（`pnpm dev`） | ECS Fargate 1 台（`pnpm build:server` の 1 ファイル。`infra/server.Dockerfile`） |
| フロントエンド | Vite | CloudFront + S3 |
| 開発用のユーザー | サーバーの起動時に作る | スタックの中で作る（alice・bob・vic、パスワードは同じ） |

- Realtime Gateway は接続の状態をメモリーに持つので、Fargate は 1 台だけ動かします
- VPC は自分のもの（`10.40.0.0/16`、公開サブネットだけで NAT Gateway なし）です。ALB は CloudFront からの接続だけを受けます
- 名前とタグは `burmaculex` で始めます（スタック `burmaculex-taskmanager-<環境名>`、タグ `burmaculex:env`）
- リージョン、試験環境か永続環境か（`kind`）、デプロイのファイルとイメージの置き場（`assets`）は `infra/cdk/config/<環境名>.json` に置きます（環境名の既定は `test`。ほかの環境は `pnpm aws:deploy -- -c env=<環境名>`）
- AWS のアカウント ID はリポジトリに置かず、環境変数 `AWS_ACCOUNT_ID` で渡します。置き場のバケット名とロールの ARN は、そこから組み立てます。CDK が書き出す `infra/cdk/cdk.context.json` もアカウント ID を含むので、コミットしません（.gitignore 済み）

### デプロイのファイルとイメージの置き場

CDK は、デプロイに使うファイル（テンプレート、フロントエンドのビルド成果物、Lambda のコード）とコンテナのイメージを、いったん置き場に入れます。試験環境のものを寿命で消せるように、bootstrap の置き場ではなく専用の置き場に入れます（`infra/cdk/bin.ts` の `DefaultStackSynthesizer`）。

| もの | 置き場 | 試験環境（`kind: test`） | 永続環境（`kind: persistent`） |
|---|---|---|---|
| ファイル | S3 `burmaculex-assets-<アカウント>-<リージョン>` | `test/<環境名>/…`。1 日で自動的に消える | `env/<環境名>/…`。消さない |
| イメージ | ECR `burmaculex/assets` | タグ `test-<環境名>-…`。1 日で自動的に消える | タグ `env-<環境名>-…`。消さない |

置き場と、そこに書き込むロール（`burmaculex-asset-publishing`）は、`burmaculex-automation` のスタック（Mac の `burmaculex/infra/`。SSO でデプロイ）が持ちます。デプロイは、今までどおり bootstrap の deploy ロールで行います。

### デプロイする

必要なもの：Docker（イメージを作る）、CDK の bootstrap 済みのアカウント（既定の qualifier）、置き場（上）、bootstrap の deploy ロールと `burmaculex-asset-publishing` を引き受けられる認証情報。

```bash
cd apps/taskmanager
export AWS_ACCOUNT_ID=<デプロイ先のアカウント ID>   # aws:deploy と aws:destroy の両方で使う
pnpm aws:deploy                                  # フロントエンドとサーバーをビルドしてデプロイ（8 分ほど）
pnpm aws:deploy -- -c authMaxAgeSeconds=20       # E2E の 08-token-refresh を流すとき
pnpm aws:deploy -- -c ttlMinutes=120             # 自分を消すまでの分数を変える（0 で消さない）
```

出力の `Url` がフロントエンドの URL、`ExpiresAt` がスタックが自分を消す時刻（UTC）です。

### E2E を流す

```bash
E2E_BASE_URL=<Url> COGNITO_ENDPOINT= COGNITO_REGION=us-east-1 COGNITO_CLIENT_ID=<UserPoolClientId> \
  NODE_USE_ENV_PROXY=1 pnpm e2e
```

- `01-signup` は、確認のメールを読めないので行いません
- `NODE_USE_ENV_PROXY=1` は、HTTPS_PROXY のある環境（Claude Code のクラウド環境など）のときだけ要ります。ブラウザも同じプロキシを通します（`playwright.config.ts`）。クラウド環境では、ネットワークの許可に `*.cloudfront.net` を入れておきます

### 消す

```bash
pnpm aws:destroy                      # スタックを消し、試験環境のファイルとイメージも消す
pnpm aws:destroy -- --assets-only     # ファイルとイメージだけ（スタックがもう消えているとき）
```

`scripts/aws-destroy.mts` が、`cdk destroy` のあとに、その環境のファイルとイメージ（`test/<環境名>/`、`test-<環境名>-`）を消します。スタックが自分を消したときや、消し忘れたときも、置き場の寿命の決まりで 1 日後に消えます。永続環境のものは消しません。

スタックのほかのものは、スタックと一緒に消えます。バケットは、スタックを消すときに自前の Lambda で空にします。Lambda のログはスタックのロググループ（`/burmaculex/<環境名>/taskmanager-<識別子>/functions`。識別子はスタック ID の先頭 8 文字）に出し、消したあとに遅れて届いたログでロググループが作り直されないように、Lambda にはロググループを作る権限を与えていません。

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
