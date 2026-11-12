/**
 * 環境ごとの設定（`config/<環境名>.json`）の型と、それから決まる値。
 * CDK を読み込まずに使えるように、スタックとは別のファイルにする（scripts/aws-destroy.mts も使う）
 */
export type EnvConfig = {
  account: string;
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
   * CDK の 試験環境のものを寿命で消すために、CDK の bootstrap の置き場ではなく専用のものに入れる。
   * `burmaculex-automation` のスタック（Mac の burmaculex/infra/）が持つ
   */
  assets: {
    bucketName: string;
    repositoryName: string;
    publishingRoleArn: string;
  };
};

/** 環境の種類ごとの、デプロイのファイルとイメージの頭。試験環境の頭は、置き場の寿命の決まり（1 日）の対象 */
export const assetPrefixes = (envName: string, config: EnvConfig) =>
  (config.kind ?? "test") === "test"
    ? { bucketPrefix: `test/${envName}/`, dockerTagPrefix: `test-${envName}-` }
    : { bucketPrefix: `env/${envName}/`, dockerTagPrefix: `env-${envName}-` };
