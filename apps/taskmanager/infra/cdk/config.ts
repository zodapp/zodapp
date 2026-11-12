/**
 * 環境ごとの設定（`config/<環境名>.json`）の型と、それから決まる値。
 * CDK を読み込まずに使えるように、スタックとは別のファイルにする（scripts/aws-destroy.mts も使う）
 *
 * AWS のアカウント ID は設定のファイルに書かず、環境変数 `AWS_ACCOUNT_ID` から読む。
 * 置き場のバケット名と、書き込むロールの ARN は、アカウント ID とリージョンから組み立てる
 */
import { readFileSync } from "node:fs";
import path from "node:path";

export type EnvConfig = {
  region: string;
  /** CloudFront からの接続だけを ALB に通すための、AWS 管理のプレフィックスリスト（リージョンごとに ID が違う） */
  cloudFrontPrefixListId: string;
  /**
   * 試験環境（`test`。既定）か、永続環境（`persistent`）か。
   * 試験環境は、既定で 1 時間でスタックが自分を消し、デプロイのファイルとイメージは 1 日で消える置き場に入る
   */
  kind?: "test" | "persistent";
  /**
   * デプロイのファイル（テンプレート、フロントエンドのビルド成果物、Lambda のコード）とイメージの置き場。
   * 試験環境のものを寿命で消すために、CDK の bootstrap の置き場ではなく専用のものに入れる。
   * 置き場は `infra/assets/` のスタックが作る
   */
  assets: {
    /** S3 バケットの名前の頭。実際の名前は `<頭>-<アカウント>-<リージョン>` */
    bucketNamePrefix: string;
    /** ECR のリポジトリの名前 */
    repositoryName: string;
    /** 置き場に書き込むロールの名前 */
    publishingRoleName: string;
  };
};

/** 設定のファイルと環境変数から決まる、環境の値 */
export type ResolvedEnv = EnvConfig & {
  account: string;
  assetBucketName: string;
  assetPublishingRoleArn: string;
};

export const loadEnvConfig = (envName: string): ResolvedEnv => {
  const config = JSON.parse(
    readFileSync(
      path.join(import.meta.dirname, "config", `${envName}.json`),
      "utf8",
    ),
  ) as EnvConfig;
  const account = process.env.AWS_ACCOUNT_ID ?? "";
  if (!/^[0-9]{12}$/.test(account)) {
    throw new Error(
      "AWS_ACCOUNT_ID (the 12-digit account ID to deploy to) is not set",
    );
  }
  return {
    ...config,
    account,
    assetBucketName: `${config.assets.bucketNamePrefix}-${account}-${config.region}`,
    assetPublishingRoleArn: `arn:aws:iam::${account}:role/${config.assets.publishingRoleName}`,
  };
};

/** 環境の種類ごとの、デプロイのファイルとイメージの頭。試験環境の頭は、置き場の寿命の決まり（1 日）の対象 */
export const assetPrefixes = (envName: string, config: EnvConfig) =>
  (config.kind ?? "test") === "test"
    ? { bucketPrefix: `test/${envName}/`, dockerTagPrefix: `test-${envName}-` }
    : { bucketPrefix: `env/${envName}/`, dockerTagPrefix: `env-${envName}-` };
