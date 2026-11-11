import { config as reactConfig } from "@repo/eslint-config/react-internal";

/** @type {import("eslint").Linter.Config} */
export default [
  ...reactConfig,
  // AWS 向けのビルドの出力（pnpm aws:build、cdk synth）
  { ignores: ["dist-server/**", "infra/cdk/cdk.out/**"] },
  {
    // ブラウザに Node.js 専用のモジュールが入らないように、共有の定義と画面からサーバーを import しない
    files: ["src/shared/**", "src/web/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["**/server/**", "../server/*"], message: "src/server is server-only" },
            { group: ["node:*"], message: "Node.js modules are server-only" },
          ],
        },
      ],
    },
  },
];
