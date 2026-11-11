/**
 * Amplify（Cognito）の設定。ローカルでは userPoolEndpoint を magnito に向ける。
 * AWS では、配信のときの設定（runtime-config.ts）で Cognito の ID を受け取る。
 */
import { Amplify } from "aws-amplify";
import { runtimeConfig } from "./runtime-config";

const env = import.meta.env;

/** 配信のときの設定（AWS）があればそれを使い、なければ Vite の環境変数とローカルの既定値 */
export const cognitoConfig = runtimeConfig.cognito
  ? { ...runtimeConfig.cognito, userPoolEndpoint: undefined }
  : {
      userPoolId: env.VITE_COGNITO_USER_POOL_ID ?? "ap-northeast-1_taskmanager",
      userPoolClientId: env.VITE_COGNITO_CLIENT_ID ?? "taskmanager-web",
      userPoolEndpoint:
        env.VITE_COGNITO_ENDPOINT === undefined
          ? "http://localhost:5050"
          : env.VITE_COGNITO_ENDPOINT || undefined,
    };

/**
 * ログインの方式。Cognito の既定は SRP（パスワードを送らない）。
 * magnito の SRP は、およそ 20 回に 1 回「Incorrect username or password」で失敗するため、
 * エミュレーターに向けているときはパスワードを送る方式（USER_PASSWORD_AUTH）にする。
 * VITE_COGNITO_AUTH_FLOW で上書きできる。
 */
export const authFlowType: "USER_SRP_AUTH" | "USER_PASSWORD_AUTH" =
  env.VITE_COGNITO_AUTH_FLOW === "USER_SRP_AUTH" ||
  env.VITE_COGNITO_AUTH_FLOW === "USER_PASSWORD_AUTH"
    ? env.VITE_COGNITO_AUTH_FLOW
    : cognitoConfig.userPoolEndpoint
      ? "USER_PASSWORD_AUTH"
      : "USER_SRP_AUTH";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: cognitoConfig.userPoolId,
      userPoolClientId: cognitoConfig.userPoolClientId,
      ...(cognitoConfig.userPoolEndpoint
        ? { userPoolEndpoint: cognitoConfig.userPoolEndpoint }
        : {}),
      loginWith: { email: true },
      signUpVerificationMethod: "code",
    },
  },
});
