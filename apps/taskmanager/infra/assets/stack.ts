/**
 * デプロイのファイルとイメージの置き場（S3 バケット、ECR リポジトリ）と、そこに書き込むロール。
 *
 * 試験環境のものを寿命で消すために、CDK の bootstrap の置き場ではなく、この置き場に入れる
 * （`test/` 頭のファイル、`test-` 頭のタグのイメージ、タグのないイメージは 1 日で消える）。
 * アカウントとリージョンに 1 つだけ置き、試験環境のスタックとは別に、恒久のスタックとして持つ。
 */
import { Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import { Repository, TagStatus } from "aws-cdk-lib/aws-ecr";
import {
  AccountRootPrincipal,
  ArnPrincipal,
  PolicyDocument,
  PolicyStatement,
  Role,
} from "aws-cdk-lib/aws-iam";
import { BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";
import type { ResolvedEnv } from "../cdk/config";

/** CDK の bootstrap の qualifier（既定） */
const BOOTSTRAP_QUALIFIER = "hnb659fds";

export type AssetStoreStackProps = StackProps & { config: ResolvedEnv };

export class AssetStoreStack extends Stack {
  constructor(scope: Construct, id: string, props: AssetStoreStackProps) {
    super(scope, id, props);
    const { config } = props;
    const { account, region, partition } = this;
    const bootstrapRole = (kind: string) =>
      `arn:${partition}:iam::${account}:role/cdk-${BOOTSTRAP_QUALIFIER}-${kind}-role-${account}-${region}`;

    const bucket = new Bucket(this, "AssetBucket", {
      bucketName: config.assetBucketName,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: false,
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [
        { id: "ExpireTest", prefix: "test/", expiration: Duration.days(1) },
      ],
    });
    // CloudFormation が、デプロイのときにテンプレートなどを読む
    bucket.addToResourcePolicy(
      new PolicyStatement({
        sid: "BootstrapRead",
        principals: ["deploy", "cfn-exec"].map(
          (kind) => new ArnPrincipal(bootstrapRole(kind)),
        ),
        actions: ["s3:GetObject*", "s3:GetBucket*", "s3:List*"],
        resources: [bucket.bucketArn, bucket.arnForObjects("*")],
      }),
    );

    const repository = new Repository(this, "AssetRepository", {
      repositoryName: config.assets.repositoryName,
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          rulePriority: 1,
          description: "Expire test- images",
          tagStatus: TagStatus.TAGGED,
          tagPrefixList: ["test-"],
          maxImageAge: Duration.days(1),
        },
        {
          rulePriority: 2,
          description: "Expire untagged images",
          tagStatus: TagStatus.UNTAGGED,
          maxImageAge: Duration.days(1),
        },
      ],
    });

    // 置き場に書き込むロール。アカウントの中の、引き受ける権限を与えられた主体から使う
    new Role(this, "AssetPublishingRole", {
      roleName: config.assets.publishingRoleName,
      assumedBy: new AccountRootPrincipal(),
      inlinePolicies: {
        Publish: new PolicyDocument({
          statements: [
            new PolicyStatement({
              sid: "Bucket",
              actions: [
                "s3:GetObject*",
                "s3:PutObject*",
                "s3:DeleteObject*",
                "s3:List*",
                "s3:GetBucket*",
                "s3:GetEncryptionConfiguration",
              ],
              resources: [bucket.bucketArn, bucket.arnForObjects("*")],
            }),
            new PolicyStatement({
              sid: "Repository",
              actions: [
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchGetImage",
                "ecr:InitiateLayerUpload",
                "ecr:UploadLayerPart",
                "ecr:CompleteLayerUpload",
                "ecr:PutImage",
                "ecr:BatchDeleteImage",
                "ecr:DescribeImages",
                "ecr:DescribeRepositories",
                "ecr:ListImages",
              ],
              resources: [repository.repositoryArn],
            }),
            new PolicyStatement({
              sid: "EcrAuth",
              actions: ["ecr:GetAuthorizationToken"],
              resources: ["*"],
            }),
          ],
        }),
      },
    });
  }
}
