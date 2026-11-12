/**
 * taskmanager の試験用のスタック（ECS Fargate の構成）。
 *
 *   ブラウザ ── CloudFront ──┬─ S3（フロントエンド。/config.js に Cognito の ID などを入れる）
 *                           └─ /api/* ─ ALB ─ Fargate（Express と Realtime Gateway）
 *   Fargate ── DynamoDB、S3（添付ファイル。ブラウザは署名付き URL で直接読み書き）、
 *              Cognito（ID トークンの検証）、IoT Core（変更の配送。SigV4 の WebSocket）
 *
 * 名前・タグは `burmaculex`（AWS アカウントの利用ガイド §3）。VPC は自分のもの（10.40.0.0/16、
 * 公開サブネットだけで NAT なし）。消し忘れに備えて、作成・更新から ttlMinutes 分で、
 * EventBridge Scheduler がこのスタックを消す。
 */
import path from "node:path";
import {
  CfnOutput,
  CustomResource,
  Duration,
  Fn,
  RemovalPolicy,
  Stack,
  Tags,
  type StackProps,
} from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as scheduler from "aws-cdk-lib/aws-scheduler";
import * as secrets from "aws-cdk-lib/aws-secretsmanager";
import * as cr from "aws-cdk-lib/custom-resources";
import type { PhysicalTable } from "@zodapp/zod-dynamodb";
import type { Construct } from "constructs";
import { appTable } from "../../src/shared/table";
import type { EnvConfig } from "./config";

export type { EnvConfig };

export type TaskmanagerStackProps = StackProps & {
  envName: string;
  config: EnvConfig;
  ttlMinutes: number;
  authMaxAgeSeconds?: number;
  devUsers: boolean;
};

/** 開発用のユーザー（ローカルの src/server/local.ts と同じ） */
const DEV_USERS = [
  { email: "alice@example.com", name: "Alice" },
  { email: "bob@example.com", name: "Bob" },
  { email: "vic@example.com", name: "Vic" },
];
const DEV_PASSWORD = "Passw0rd!";

/** MQTT のトピックとクライアント ID の頭（src/server/main.ts の MQTT_PREFIX） */
const MQTT_PREFIX = "taskmanager";
const SERVER_PORT = 4000;

const appDir = path.resolve(import.meta.dirname, "../..");

/**
 * スタックを消すときに、バケットを空にするカスタムリソースの Lambda（Node.js 22 の SDK を使う）。
 * 作成・更新では何もしない。結果は CloudFormation の署名付き URL に PUT する
 */
const BUCKET_CLEANER_CODE = `
const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require("@aws-sdk/client-s3");
const s3 = new S3Client({});
const empty = async (bucket) => {
  let token;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
    const objects = (page.Contents || []).map((o) => ({ Key: o.Key }));
    if (objects.length > 0) {
      await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: objects, Quiet: true } }));
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
};
exports.handler = async (event) => {
  let status = "SUCCESS";
  let reason = "";
  try {
    if (event.RequestType === "Delete") {
      for (const bucket of event.ResourceProperties.Buckets || []) {
        try {
          await empty(bucket);
        } catch (error) {
          if (error.name !== "NoSuchBucket") throw error;
        }
      }
    }
  } catch (error) {
    console.error(error);
    status = "FAILED";
    reason = String(error);
  }
  await fetch(event.ResponseURL, {
    method: "PUT",
    headers: { "content-type": "" },
    body: JSON.stringify({
      Status: status,
      Reason: reason || "see the function logs",
      PhysicalResourceId: event.PhysicalResourceId || "empty-buckets",
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
    }),
  });
};
`;

export class TaskmanagerStack extends Stack {
  constructor(scope: Construct, id: string, props: TaskmanagerStackProps) {
    super(scope, id, props);
    const { envName, config } = props;
    const prefix = `burmaculex-${envName}`;
    Tags.of(this).add("burmaculex:env", envName);
    Tags.of(this).add("burmaculex:app", "taskmanager");

    /**
     * デプロイの識別子：スタック ID の UUID の先頭 8 文字。更新では変わらず、作り直すと変わる。
     * 一時的なリソースの固定の名前（ロググループ）に入れ、どのデプロイのものかを見分けられるようにする。
     * 消したあとに何かが残っても、次のデプロイと名前がぶつからない
     */
    const deployId = Fn.select(
      0,
      Fn.split("-", Fn.select(2, Fn.split("/", this.stackId))),
    );
    const logPrefix = `/burmaculex/${envName}/taskmanager-${deployId}`;

    /**
     * スタックの Lambda（カスタムリソースなど）のログ。スタックと一緒に消す。
     * 消したあとに遅れて届いたログで作り直されないように、Lambda にはロググループを作らせない（このファイルの最後）
     */
    const functionLogs = new logs.LogGroup(this, "FunctionLogs", {
      logGroupName: `${logPrefix}/functions`,
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // ---- データ ----

    // テーブルは、アプリと同じ物理レイアウト（src/shared/table.ts）から作る
    const table = new dynamodb.Table(this, "Table", {
      tableName: `${prefix}-${appTable.name}`,
      partitionKey: {
        name: appTable.primary.pk,
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: appTable.primary.sk,
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const layout: PhysicalTable = appTable;
    for (const [indexName, def] of Object.entries(layout.indexes)) {
      const projection = def.projection;
      table.addGlobalSecondaryIndex({
        indexName,
        partitionKey: { name: def.pk, type: dynamodb.AttributeType.STRING },
        sortKey: { name: def.sk, type: dynamodb.AttributeType.STRING },
        ...(projection === "ALL" || projection === "KEYS_ONLY"
          ? { projectionType: dynamodb.ProjectionType[projection] }
          : {
              projectionType: dynamodb.ProjectionType.INCLUDE,
              nonKeyAttributes: [...projection.include],
            }),
      });
    }

    const userPool = new cognito.UserPool(this, "UserPool", {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const userPoolClient = userPool.addClient("Web", {
      // SRP は Amplify の既定。パスワードの方式は E2E が ID トークンを取るときに使う
      authFlows: { userSrp: true, userPassword: true },
      generateSecret: false,
      preventUserExistenceErrors: true,
    });

    // ---- フロントエンドの配信 ----

    const webBucket = new s3.Bucket(this, "WebBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // ---- ネットワークとサーバー ----

    const vpc = new ec2.Vpc(this, "Vpc", {
      ipAddresses: ec2.IpAddresses.cidr("10.40.0.0/16"),
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        { name: "public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
      ],
      restrictDefaultSecurityGroup: false,
    });

    const albSecurityGroup = new ec2.SecurityGroup(this, "AlbSecurityGroup", {
      vpc,
      description: "taskmanager ALB: CloudFront only",
      allowAllOutbound: true,
    });
    albSecurityGroup.addIngressRule(
      ec2.Peer.prefixList(config.cloudFrontPrefixListId),
      ec2.Port.tcp(80),
      "CloudFront origin-facing",
    );
    const alb = new elbv2.ApplicationLoadBalancer(this, "Alb", {
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
      // Realtime の WebSocket を、やり取りのない間も保つ
      idleTimeout: Duration.minutes(5),
    });

    // CloudFront：フロントエンドは S3、/api/* は ALB（同じオリジンにして、Cookie や CORS を使わずに済ませる）
    const spaRewrite = new cloudfront.Function(this, "SpaRewrite", {
      code: cloudfront.FunctionCode.fromInline(
        [
          "function handler(event) {",
          "  var request = event.request;",
          "  // 拡張子のないパスは、フロントエンドのルート（TanStack Router）として index.html を返す",
          "  if (!/\\.[a-zA-Z0-9]+$/.test(request.uri)) request.uri = '/index.html';",
          "  return request;",
          "}",
        ].join("\n"),
      ),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });
    const distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: `burmaculex taskmanager (${envName})`,
      defaultRootObject: "index.html",
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [
          {
            function: spaRewrite,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      additionalBehaviors: {
        "/api/*": {
          origin: new origins.HttpOrigin(alb.loadBalancerDnsName, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
            readTimeout: Duration.seconds(60),
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          // Authorization、Origin、WebSocket の upgrade のヘッダーとクエリ文字列を ALB に渡す
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
    });
    const appOrigin = `https://${distribution.distributionDomainName}`;

    // 添付ファイル：ブラウザが署名付き URL で直接 PUT・GET する
    const filesBucket = new s3.Bucket(this, "FilesBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      cors: [
        {
          allowedOrigins: [appOrigin],
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
          allowedHeaders: ["*"],
          maxAge: 3000,
        },
      ],
    });

    // IoT Core のデータのエンドポイント（アカウントとリージョンで決まる）
    const iotEndpoint = new cr.AwsCustomResource(this, "IotEndpoint", {
      onUpdate: {
        service: "Iot",
        action: "describeEndpoint",
        parameters: { endpointType: "iot:Data-ATS" },
        physicalResourceId: cr.PhysicalResourceId.of("iot-data-ats-endpoint"),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
      logGroup: functionLogs,
      installLatestAwsSdk: false,
    }).getResponseField("endpointAddress");

    // カーソルの署名の鍵（秘密の値。出力に出さない）
    const cursorSecret = new secrets.Secret(this, "CursorSecret", {
      description: `burmaculex taskmanager (${envName}) cursor secret`,
      generateSecretString: { excludePunctuation: true, passwordLength: 48 },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const serverLogs = new logs.LogGroup(this, "ServerLogs", {
      logGroupName: `${logPrefix}/server`,
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const taskDefinition = new ecs.FargateTaskDefinition(this, "Task", {
      cpu: 256,
      memoryLimitMiB: 512,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });
    taskDefinition.addContainer("Server", {
      image: ecs.ContainerImage.fromAsset(appDir, {
        file: "infra/server.Dockerfile",
        // サーバーの 1 ファイル（pnpm build:server の出力）だけをイメージに入れる
        exclude: ["**", "!dist-server/**", "!infra/server.Dockerfile"],
      }),
      logging: ecs.LogDrivers.awsLogs({
        logGroup: serverLogs,
        streamPrefix: "server",
      }),
      portMappings: [{ containerPort: SERVER_PORT }],
      environment: {
        PORT: String(SERVER_PORT),
        AWS_REGION: this.region,
        LOCAL_SETUP: "0",
        // 空にすると AWS のエンドポイントと、タスクロールの認証情報を使う
        DYNAMODB_ENDPOINT: "",
        TABLE_PREFIX: `${prefix}-`,
        S3_ENDPOINT: "",
        S3_BUCKET: filesBucket.bucketName,
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
        COGNITO_ISSUER: `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
        IOT_ENDPOINT: iotEndpoint,
        APP_ORIGIN: appOrigin,
        ...(props.authMaxAgeSeconds
          ? { AUTH_MAX_AGE_SECONDS: String(props.authMaxAgeSeconds) }
          : {}),
      },
      secrets: {
        CURSOR_SECRET: ecs.Secret.fromSecretsManager(cursorSecret),
      },
    });
    table.grantReadWriteData(taskDefinition.taskRole);
    filesBucket.grantReadWrite(taskDefinition.taskRole);
    const iotArn = (resource: string) =>
      `arn:aws:iot:${this.region}:${this.account}:${resource}`;
    taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ["iot:Connect"],
        resources: [iotArn(`client/${MQTT_PREFIX}-*`)],
      }),
    );
    taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ["iot:Publish", "iot:Receive"],
        resources: [iotArn(`topic/${MQTT_PREFIX}/*`)],
      }),
    );
    taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ["iot:Subscribe"],
        resources: [iotArn(`topicfilter/${MQTT_PREFIX}/*`)],
      }),
    );

    const cluster = new ecs.Cluster(this, "Cluster", { vpc });
    const serviceSecurityGroup = new ec2.SecurityGroup(
      this,
      "ServiceSecurityGroup",
      {
        vpc,
        description: "taskmanager server: ALB only",
        allowAllOutbound: true,
      },
    );
    serviceSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(SERVER_PORT),
      "ALB",
    );
    // Realtime Gateway は接続の状態をメモリーに持つので、1 台だけ動かす
    const service = new ecs.FargateService(this, "Service", {
      cluster,
      taskDefinition,
      desiredCount: 1,
      minHealthyPercent: 0,
      maxHealthyPercent: 100,
      assignPublicIp: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [serviceSecurityGroup],
      circuitBreaker: { enable: true, rollback: false },
    });
    alb.addListener("Http", { port: 80, open: false }).addTargets("Server", {
      port: SERVER_PORT,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [service],
      healthCheck: { path: "/api/health", interval: Duration.seconds(15) },
      deregistrationDelay: Duration.seconds(5),
    });

    // ---- フロントエンドのビルド成果物と、配信のときの設定 ----

    new s3deploy.BucketDeployment(this, "WebDeployment", {
      destinationBucket: webBucket,
      sources: [
        s3deploy.Source.asset(path.join(appDir, "dist"), {
          exclude: ["config.js"],
        }),
        s3deploy.Source.data(
          "config.js",
          `window.__TASKMANAGER_CONFIG__ = ${this.toJsonString({
            cognito: {
              userPoolId: userPool.userPoolId,
              userPoolClientId: userPoolClient.userPoolClientId,
            },
            ...(props.authMaxAgeSeconds
              ? { authMaxAgeSeconds: props.authMaxAgeSeconds }
              : {}),
          })};\n`,
        ),
      ],
      cacheControl: [s3deploy.CacheControl.noCache()],
      distribution,
      distributionPaths: ["/*"],
      memoryLimit: 512,
      logGroup: functionLogs,
    });

    // ---- 開発用のユーザー ----

    if (props.devUsers) {
      DEV_USERS.forEach((user, i) => {
        new cr.AwsCustomResource(this, `DevUser${i}`, {
          onCreate: {
            service: "CognitoIdentityServiceProvider",
            action: "adminCreateUser",
            parameters: {
              UserPoolId: userPool.userPoolId,
              Username: user.email,
              MessageAction: "SUPPRESS",
              UserAttributes: [
                { Name: "email", Value: user.email },
                { Name: "email_verified", Value: "true" },
                { Name: "name", Value: user.name },
              ],
            },
            physicalResourceId: cr.PhysicalResourceId.of(user.email),
          },
          policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
            resources: [userPool.userPoolArn],
          }),
          logGroup: functionLogs,
          installLatestAwsSdk: false,
        });
        const password = new cr.AwsCustomResource(this, `DevUserPassword${i}`, {
          onCreate: {
            service: "CognitoIdentityServiceProvider",
            action: "adminSetUserPassword",
            parameters: {
              UserPoolId: userPool.userPoolId,
              Username: user.email,
              Password: DEV_PASSWORD,
              Permanent: true,
            },
            physicalResourceId: cr.PhysicalResourceId.of(
              `${user.email}-password`,
            ),
          },
          policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
            resources: [userPool.userPoolArn],
          }),
          logGroup: functionLogs,
          installLatestAwsSdk: false,
        });
        password.node.addDependency(this.node.findChild(`DevUser${i}`));
      });
    }

    // ---- 消し忘れの対策：作成・更新から ttlMinutes 分で、このスタックを消す ----

    if (props.ttlMinutes > 0) {
      const expiresAt = new Date(Date.now() + props.ttlMinutes * 60_000);
      const schedulerRole = new iam.Role(this, "SelfDestructRole", {
        assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com"),
      });
      schedulerRole.addToPolicy(
        new iam.PolicyStatement({
          actions: ["cloudformation:DeleteStack"],
          resources: [this.stackId],
        }),
      );
      // CDK のスタックは、CloudFormation の実行ロール（bootstrap のもの）で消す
      schedulerRole.addToPolicy(
        new iam.PolicyStatement({
          actions: ["iam:PassRole"],
          resources: [
            `arn:aws:iam::${this.account}:role/cdk-hnb659fds-cfn-exec-role-${this.account}-${this.region}`,
          ],
        }),
      );
      new scheduler.CfnSchedule(this, "SelfDestruct", {
        description: `Delete ${this.stackName} (burmaculex test environment)`,
        scheduleExpression: `at(${expiresAt.toISOString().slice(0, 19)})`,
        scheduleExpressionTimezone: "UTC",
        flexibleTimeWindow: { mode: "OFF" },
        target: {
          arn: "arn:aws:scheduler:::aws-sdk:cloudformation:deleteStack",
          roleArn: schedulerRole.roleArn,
          input: this.toJsonString({ StackName: this.stackName }),
          retryPolicy: { maximumRetryAttempts: 3 },
        },
      });
      new CfnOutput(this, "ExpiresAt", { value: expiresAt.toISOString() });
    }

    // ---- スタックを消すときに、バケットを空にする ----
    // CDK の autoDeleteObjects は、ログの置き場所を選べない Lambda を作り、消したあとに
    // /aws/lambda/… のロググループが残るので、ログを functionLogs に出す小さな Lambda で行う
    const bucketCleaner = new lambda.Function(this, "BucketCleaner", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      timeout: Duration.minutes(5),
      logGroup: functionLogs,
      code: lambda.Code.fromInline(BUCKET_CLEANER_CODE),
    });
    for (const bucket of [webBucket, filesBucket]) {
      bucket.grantRead(bucketCleaner);
      bucket.grantDelete(bucketCleaner);
    }
    // バケットより先に消える（バケットの名前を受け取るので、バケットに依存する）
    new CustomResource(this, "EmptyBuckets", {
      serviceToken: bucketCleaner.functionArn,
      resourceType: "Custom::BurmaculexEmptyBuckets",
      properties: { Buckets: [webBucket.bucketName, filesBucket.bucketName] },
    });

    // スタックの Lambda にロググループを作らせない。消したあとに届いたログで作り直されて、残るのを防ぐ
    for (const construct of this.node.findAll()) {
      if (construct instanceof lambda.Function && construct.role) {
        construct.role.addToPrincipalPolicy(
          new iam.PolicyStatement({
            effect: iam.Effect.DENY,
            actions: ["logs:CreateLogGroup"],
            resources: ["*"],
          }),
        );
      }
    }

    new CfnOutput(this, "Url", { value: appOrigin });
    new CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
    });
    new CfnOutput(this, "TableName", { value: table.tableName });
  }
}
