/**
 * デプロイのファイルとイメージの置き場を作る CDK のアプリ（`pnpm aws:assets:deploy`）。
 *
 * 名前は、taskmanager のスタックと同じ `../cdk/config/<環境名>.json`（既定 `test`）から決める。
 * アカウント ID は環境変数 `AWS_ACCOUNT_ID`。スタック名は `burmaculex-assets`。
 * アカウントとリージョンに 1 つだけ置く恒久のスタックなので、削除保護を付ける。
 */
import { App, Tags } from "aws-cdk-lib";
import { loadEnvConfig } from "../cdk/config";
import { AssetStoreStack } from "./stack";

const app = new App();
const config = loadEnvConfig(String(app.node.tryGetContext("env") ?? "test"));

const stack = new AssetStoreStack(app, "burmaculex-assets", {
  env: { account: config.account, region: config.region },
  terminationProtection: true,
  description:
    "Asset store for burmaculex deployments (test assets expire in 1 day)",
  config,
});
Tags.of(stack).add("burmaculex:env", "shared");
