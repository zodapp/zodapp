/**
 * 配信のときに決まる設定（AWS へのデプロイ）。`index.html` が読む `/config.js` が
 * `window.__TASKMANAGER_CONFIG__` に入れる。ローカルでは `public/config.js` の空の設定になり、
 * Vite の環境変数と既定値（magnito）を使う。
 */
export type RuntimeConfig = {
  cognito?: { userPoolId: string; userPoolClientId: string };
  /** サーバーの AUTH_MAX_AGE_SECONDS と同じ値（E2E でトークンの入れ替えを確かめるとき） */
  authMaxAgeSeconds?: number;
};

export const runtimeConfig: RuntimeConfig =
  (globalThis as { __TASKMANAGER_CONFIG__?: RuntimeConfig })
    .__TASKMANAGER_CONFIG__ ?? {};
