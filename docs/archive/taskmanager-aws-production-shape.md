# taskmanager：AWS の本番の形で動くことを確かめる

対象：`apps/taskmanager/infra/cdk`（アプリのスタック）。置き場のスタック（`infra/assets`）は変えない。

## 目的とスコープ

taskmanager は、利用者が写して使うサンプル。常時動かす予定はない。
ここでは「本番の形の設定で AWS で動くこと」を確かめ、サンプルとして見える「スキ」を残さない。

やること：

1. ALB を内部向けにし、CloudFront の VPC オリジンからだけつなぐ
2. Fargate の外向きの通信を 443 番だけにする
3. 永続環境（`kind: persistent`）の設定：データを残す、自分を消さない、Cognito を本番の形にする
4. 試験環境と永続環境の両方をデプロイして確かめ、消す

やらないこと：WAF、private サブネットと NAT や VPC エンドポイント、SES、監視のアラーム、Gateway の複数台、ベクトルインデックス。

## 1. ALB を内部向けにする

今の ALB はインターネット向けで、受け付けを AWS の管理する CloudFront の IP の一覧に絞っている。
この一覧はほかの人の CloudFront も含むので、ほかの CloudFront をこちらの ALB に向ければ、こちらの CloudFront を通らずに届く。

変更：

- VPC に、ALB を置くための隔離のサブネット（`PRIVATE_ISOLATED`、2 AZ、NAT なし、費用なし）を足す
- ALB を `internetFacing: false` にして、隔離のサブネットに置く
- CloudFront の `/api/*` のオリジンを、`origins.VpcOrigin.withApplicationLoadBalancer(alb)`（HTTP、80 番）にする
- ALB のセキュリティグループは、CloudFront の VPC オリジンのセキュリティグループからだけ受ける。CloudFront が VPC に作るセキュリティグループ（`CloudFront-VPCOrigins-Service-SG`）を、VPC オリジンの作成のあとに引いて許可する。実装の最初に、CDK でこれを扱う方法を確かめる（引けなければ、AWS 管理の CloudFront のプレフィックスリストのまま、ALB を内部向けにするだけでも、外からは届かない）
- 設定ファイルの `cloudFrontPrefixListId` は、使わなくなれば消す

結果：ALB はインターネットから見えなくなる。ALB の公開 IPv4（2 つ）もなくなる。

WebSocket（`/api/realtime`）が VPC オリジンを通ることは、E2E の `03-realtime`、`05-reconnect`、`07-revoke`、`08-token-refresh` で確かめる。

## 2. Fargate の外向きの通信を 443 番だけにする

- タスクのセキュリティグループを `allowAllOutbound: false` にし、外向きは TCP 443 だけを許可する
- タスクが外へつなぐ先（ECR、DynamoDB、S3、IoT Core の WebSocket、Cognito の JWKS、Secrets Manager、CloudWatch Logs）は、どれも HTTPS の 443 番
- 入ってくる方は今のまま（ALB のセキュリティグループからの 4000 番だけ）
- タスクの公開 IP は残す（外へ出るためだけに使う。なくすには NAT かエンドポイントが要り、費用がかかる）

## 3. 永続環境の設定

`config/<環境名>.json` の `kind` で切り替える（既定 `test`）。試験環境の動きは今のまま変えない。

| 項目 | 試験環境（`test`） | 永続環境（`persistent`） |
|---|---|---|
| スタックが自分を消す | 1 時間（今のまま） | しない |
| テーブル | 消す | 残す（`RETAIN`）、PITR、削除保護 |
| ユーザープール | 消す | 残す（`RETAIN`）、削除保護 |
| 添付のバケット | 消す（自前の Lambda で空にする） | 残す（`RETAIN`）。空にする対象から外す |
| ログ（サーバー、関数） | 1 日 | 30 日 |
| 開発用のユーザー | 作る | 作らない |
| パスワード方式のログイン（`USER_PASSWORD_AUTH`） | 許可（E2E が使う） | 許可しない（SRP だけ） |
| 確認メール | Cognito の既定の送信 | 同じ |

- 永続環境の片付けのために、コンテキスト `-c releaseData=true` を用意する。付けてデプロイすると、永続環境でもデータを `DESTROY` にし、削除保護を外す。そのあとの `pnpm aws:destroy` で、データも含めて消える
- 永続環境の設定ファイルの例として、`config/demo.json`（`kind: persistent`）を足す。アカウント ID は書かない（今のまま `AWS_ACCOUNT_ID` から読む）

## 4. 確かめ方

### 試験環境（`test`）

1. デプロイし、E2E（7 本。サインアップは除く）を流す
2. ALB がインターネットから届かないことを確かめる（ALB の DNS 名が内部の IP だけを返す）
3. `pnpm aws:destroy` で消し、何も残らないことを確かめる（今までと同じ）

### 永続環境（`demo`）

1. デプロイし、テンプレートで次を確かめる：テーブル・ユーザープール・添付のバケットの `DeletionPolicy: Retain`、PITR、削除保護、自分を消すスケジュールがないこと、開発用のユーザーがないこと、クライアントの認証方式が SRP だけであること
2. フロントエンドでサインアップし（確認コードは、このスレッドにつないだ Gmail で読む）、ワークスペース・プロジェクト・タスクを作る。テーブルにも確認用のデータを直接書き込む（確認の途中で、人の手の作業を待たない）
3. 同じ構成で、もう一度デプロイする（タスクを入れ替える）。2 のユーザーでログインでき、データが残っていて、テーブル・ユーザープール・添付のバケットが同じもののままであることを確かめる
4. `-c releaseData=true` でデプロイし、`pnpm aws:destroy -- demo` で消す。何も残らないことを確かめる

## 5. README

「AWS で動かす」を書き直す。

- 構成の図と表（内部の ALB と VPC オリジン、外向きは 443 だけ）
- 試験環境と永続環境の違い（上の表）と、永続環境の片付け方（`releaseData`）
- 本番で使うときに足すとよいもの（このサンプルでは入れていない）：独自ドメインと、CloudFront から ALB までの HTTPS、WAF、private サブネットと NAT や VPC エンドポイント、SES、監視のアラーム。理由は一行ずつ。手順は書かない

## 進め方

1. このプランをレビューしてもらう
2. 実装する（1 → 2 → 3 → README の順にコミット）
3. 試験環境で確かめる
4. 永続環境で確かめる
5. PR を出す（base は幹の候補のブランチ）

## 確かめたいこと（実装の最初に）

- CloudFront の VPC オリジンのセキュリティグループを、CDK のスタックの中で ALB の受け付けに使えるか
- VPC オリジンが、隔離のサブネット（IGW への経路なし）の内部 ALB につなげるか
- VPC オリジンを作ってから使えるようになるまでの時間（デプロイの時間が延びるか）
