/**
 * ローカルの開発だけで行う準備：テーブルとバケットの作成、magnito の設定と開発用のユーザー。
 * 本番では CDK と Cognito の設定が受け持つ。
 */
import {
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  UpdateUserPoolClientCommand,
  UsernameExistsException,
} from "@aws-sdk/client-cognito-identity-provider";
import type { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import type { S3FileSigner } from "@zodapp/zod-form-s3-node";
import { appTable } from "../shared";
import { ensureTable } from "./dynamo";
import { config } from "./env";

/** 開発用のユーザー（パスワードは共通） */
export const DEV_PASSWORD = "Passw0rd!";
export const devUsers = [
  { email: "alice@example.com", name: "Alice" },
  { email: "bob@example.com", name: "Bob" },
  { email: "vic@example.com", name: "Vic" },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** magnito は、最初のヘルスチェックで既定の User Pool とクライアントを作る */
const waitForMagnito = async () => {
  const url = `${config.cognito.endpoint}/publicApi/health`;
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // 起動中
    }
    await sleep(1000);
  }
  throw new Error(
    `magnito is not healthy at ${url}. Is \`pnpm infra:up\` running, and the mail recorder (SMTP) up?`,
  );
};

const setupCognito = async () => {
  await waitForMagnito();
  const cognito = new CognitoIdentityProviderClient({
    endpoint: config.cognito.endpoint,
    region: config.dynamodb.region,
    credentials: { accessKeyId: "magnito-access-key", secretAccessKey: "magnito-secret-key" },
  });
  // Amplify の既定の SRP と、テストで使うパスワードのログインを許可する
  await cognito.send(
    new UpdateUserPoolClientCommand({
      UserPoolId: config.cognito.userPoolId,
      ClientId: config.cognito.clientId,
      ExplicitAuthFlows: [
        "ALLOW_USER_SRP_AUTH",
        "ALLOW_USER_PASSWORD_AUTH",
        "ALLOW_REFRESH_TOKEN_AUTH",
      ],
    }),
  );
  for (const user of devUsers) {
    try {
      await cognito.send(
        new AdminCreateUserCommand({
          UserPoolId: config.cognito.userPoolId,
          Username: user.email,
          MessageAction: "SUPPRESS",
          UserAttributes: [
            { Name: "email", Value: user.email },
            { Name: "email_verified", Value: "true" },
            { Name: "name", Value: user.name },
          ],
        }),
      );
    } catch (error) {
      if (!(error instanceof UsernameExistsException)) throw error;
    }
    await cognito.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: config.cognito.userPoolId,
        Username: user.email,
        Password: DEV_PASSWORD,
        Permanent: true,
      }),
    );
  }
};

export const setupLocal = async (deps: { dynamodb: DynamoDBClient; files: S3FileSigner }) => {
  const [table, bucket] = await Promise.all([
    ensureTable(deps.dynamodb, appTable),
    deps.files.ensureBucket(),
    setupCognito(),
  ]);
  console.log(
    `[setup] table ${table}, bucket ${bucket}, users: ${devUsers.map((u) => u.email).join(", ")} / ${DEV_PASSWORD}`,
  );
};
