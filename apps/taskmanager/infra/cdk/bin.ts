/**
 * taskmanager を AWS に試しにデプロイする CDK のアプリ。
 *
 * 環境名は `-c env=<名前>`（既定 `test`）。アカウントとリージョンなどは `config/<環境名>.json`。
 * スタック名は `burmaculex-taskmanager-<環境名>`。使い方は ../README.md の「AWS で動かす」。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { App } from "aws-cdk-lib";
import { TaskmanagerStack, type EnvConfig } from "./stack";

const app = new App();
const envName = String(app.node.tryGetContext("env") ?? "test");
if (!/^[a-z0-9-]{1,20}$/.test(envName) || envName.startsWith("t-")) {
  throw new Error(`invalid env name: ${envName}`);
}
const config = JSON.parse(
  readFileSync(
    path.join(import.meta.dirname, "config", `${envName}.json`),
    "utf8",
  ),
) as EnvConfig;

const number = (key: string, fallback?: number) => {
  const value = app.node.tryGetContext(key);
  return value === undefined || value === "" ? fallback : Number(value);
};

new TaskmanagerStack(app, `burmaculex-taskmanager-${envName}`, {
  env: { account: config.account, region: config.region },
  envName,
  config,
  // 作成（と更新）から、この分数でスタックが自分を消す。0 なら消さない
  ttlMinutes: number("ttlMinutes", 60)!,
  // E2E でトークンの入れ替えを確かめるときだけ指定する（例 20）
  authMaxAgeSeconds: number("authMaxAgeSeconds"),
  devUsers: app.node.tryGetContext("devUsers") !== "false",
});
