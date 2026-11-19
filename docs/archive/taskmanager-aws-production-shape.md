# taskmanager：AWS の本番の形で動くことを確かめる

今の構成と、試験環境・永続環境の違いは [taskmanager の README](../../apps/taskmanager/README.md) の「AWS で動かす」にあります。

## 目的

taskmanager は、利用者が写して使うサンプルで、常時動かす予定はない。「本番の形の設定で AWS で動くこと」を確かめ、サンプルとして見える「スキ」を残さない。

## 決めたこと

- **ALB を内部向けにし、CloudFront の VPC オリジンからだけつなぐ。** それまでは、インターネット向けの ALB の受け付けを AWS の管理する CloudFront の IP の一覧に絞っていた。この一覧はほかの人の CloudFront も含むので、ほかの CloudFront をこちらの ALB に向ければ、こちらの CloudFront を通らずに届いた
- **Fargate の外向きの通信を 443 番だけにする。** つなぐ先（ECR、DynamoDB、S3、IoT Core、Cognito の JWKS、Secrets Manager、CloudWatch Logs）はどれも HTTPS のため。タスクの公開 IP は、外へ出るためだけに残す（なくすには NAT かエンドポイントが要り、費用がかかる）
- **環境を試験（`test`）と永続（`persistent`）に分ける。** 試験環境は自分で消え、データも残さない。永続環境はデータを残し（`RETAIN`、PITR、削除保護）、開発用のユーザーとパスワード方式のログインを持たない。永続環境は `releaseData` を付けてデプロイすれば、データごと消せる

やらないこと（README に「本番で足すとよいもの」として理由だけを書く）：WAF、private サブネットと NAT や VPC エンドポイント、SES、監視のアラーム、Gateway の複数台、独自ドメインと CloudFront から ALB までの HTTPS。
