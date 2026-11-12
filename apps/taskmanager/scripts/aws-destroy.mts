/**
 * AWS の環境を消す（`pnpm aws:destroy [環境名]`。既定 `test`）。
 *
 * 1. `cdk destroy` でスタックを消す
 * 2. 試験環境なら、デプロイのファイルとイメージ（専用の置き場の `test/<環境名>/`、`test-<環境名>-`）も消す。
 *    消し忘れても、置き場の寿命の決まりで 1 日後に消える。永続環境のものは消さない
 *
 * `--assets-only` を付けると、2 だけを行う（スタックがもう消えているとき）。
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  BatchDeleteImageCommand,
  ECRClient,
  paginateListImages,
} from "@aws-sdk/client-ecr";
import {
  DeleteObjectsCommand,
  paginateListObjectsV2,
  S3Client,
} from "@aws-sdk/client-s3";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import { assetPrefixes, type EnvConfig } from "../infra/cdk/config";

const args = process.argv.slice(2);
const assetsOnly = args.includes("--assets-only");
const envName = args.find((a) => !a.startsWith("--")) ?? "test";
const cdkDir = path.resolve(import.meta.dirname, "../infra/cdk");
const config = JSON.parse(
  readFileSync(path.join(cdkDir, "config", `${envName}.json`), "utf8"),
) as EnvConfig;

if (!assetsOnly) {
  execFileSync(
    path.resolve(import.meta.dirname, "../node_modules/.bin/cdk"),
    ["destroy", "--force", "-c", `env=${envName}`],
    { cwd: cdkDir, stdio: "inherit" },
  );
}

if ((config.kind ?? "test") !== "test") {
  console.log(`[destroy] ${envName} is persistent: keeping its assets`);
  process.exit(0);
}

// 置き場の読み書きは、専用の発行ロールで行う（自動化ユーザーにも SSO にも同じ手順）
const sts = new STSClient({ region: config.region });
const { Credentials } = await sts.send(
  new AssumeRoleCommand({
    RoleArn: config.assets.publishingRoleArn,
    RoleSessionName: `burmaculex-destroy-${envName}`,
  }),
);
const credentials = {
  accessKeyId: Credentials!.AccessKeyId!,
  secretAccessKey: Credentials!.SecretAccessKey!,
  sessionToken: Credentials!.SessionToken!,
};
const { bucketPrefix, dockerTagPrefix } = assetPrefixes(envName, config);

// ファイル（テンプレート、フロントエンドのビルド成果物、Lambda のコード）
const s3 = new S3Client({ region: config.region, credentials });
let files = 0;
for await (const page of paginateListObjectsV2(
  { client: s3 },
  { Bucket: config.assets.bucketName, Prefix: bucketPrefix },
)) {
  const objects = (page.Contents ?? []).map((o) => ({ Key: o.Key! }));
  if (objects.length === 0) continue;
  await s3.send(
    new DeleteObjectsCommand({
      Bucket: config.assets.bucketName,
      Delete: { Objects: objects, Quiet: true },
    }),
  );
  files += objects.length;
}

// イメージ
const ecr = new ECRClient({ region: config.region, credentials });
const imageIds = [];
for await (const page of paginateListImages(
  { client: ecr },
  {
    repositoryName: config.assets.repositoryName,
    filter: { tagStatus: "TAGGED" },
  },
)) {
  imageIds.push(
    ...(page.imageIds ?? []).filter((id) =>
      id.imageTag?.startsWith(dockerTagPrefix),
    ),
  );
}
for (let i = 0; i < imageIds.length; i += 100) {
  await ecr.send(
    new BatchDeleteImageCommand({
      repositoryName: config.assets.repositoryName,
      imageIds: imageIds.slice(i, i + 100),
    }),
  );
}

console.log(
  `[destroy] deleted ${files} files (s3://${config.assets.bucketName}/${bucketPrefix}) and ${imageIds.length} images (${config.assets.repositoryName}:${dockerTagPrefix}*)`,
);
