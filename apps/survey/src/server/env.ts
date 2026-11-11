/**
 * ローカルの開発の既定値。本番では環境変数で上書きする。
 */
const env = (name: string, fallback: string) => process.env[name] ?? fallback;

export const config = {
  port: Number(env("PORT", "4000")),
  dynamodb: {
    endpoint: process.env.DYNAMODB_ENDPOINT ?? "http://127.0.0.1:8000",
    region: env("AWS_REGION", "ap-northeast-1"),
    tablePrefix: env("TABLE_PREFIX", ""),
  },
  cognito: {
    /** 管理用の API の接続先（magnito）。本番では使わない */
    endpoint: env("COGNITO_ENDPOINT", "http://localhost:5050"),
    userPoolId: env("COGNITO_USER_POOL_ID", "ap-northeast-1_survey"),
    clientId: env("COGNITO_CLIENT_ID", "survey-web"),
    /** ID トークンの発行元。本番では https://cognito-idp.{region}.amazonaws.com/{userPoolId} */
    issuer: env(
      "COGNITO_ISSUER",
      "http://localhost:5050/ap-northeast-1_survey",
    ),
  },
  mqtt: {
    /** 未指定なら、プロセスの中で aedes を起動する */
    url: process.env.MQTT_URL,
    port: Number(env("MQTT_PORT", "1883")),
  },
  auth: {
    /**
     * 認証の期限を、トークンの発行からこの秒数までに縮める（未指定ならトークンの exp のまま）。
     * magnito の ID トークンは 1 時間なので、E2E でトークンの入れ替えを確かめるときに使う
     */
    maxAgeSeconds: process.env.AUTH_MAX_AGE_SECONDS
      ? Number(process.env.AUTH_MAX_AGE_SECONDS)
      : undefined,
  },
  /**
   * 画面のオリジン（カンマ区切りで複数）。Realtime Gateway が upgrade の Origin ヘッダーと比べ、
   * ほかのサイトからの WebSocket の接続を拒否する
   */
  appOrigins: env("APP_ORIGIN", "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  cursorSecret: env("CURSOR_SECRET", "local-cursor-secret"),
  mail: {
    smtpPort: Number(env("MAIL_SMTP_PORT", "2500")),
    httpPort: Number(env("MAIL_HTTP_PORT", "2501")),
  },
} as const;
