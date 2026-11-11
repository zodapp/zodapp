import { builtinModules } from "node:module";
import { config } from "@repo/eslint-config/react-internal";

/**
 * ブラウザでも動くパッケージなので、Node.js 専用のモジュールとサーバーのパッケージを import しない。
 * 同じ検査をテスト（src/browser-safe.spec.ts）でも行い、CI で落とす
 */
const restricted = {
  files: ["src/**/*.{ts,tsx}"],
  ignores: ["src/**/*.spec.{ts,tsx}", "src/test/**", "src/__fixtures__/**"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: builtinModules.map((name) => ({
          name,
          message: "browser packages must not import Node.js modules",
        })),
        patterns: [
          {
            group: ["node:*"],
            message: "browser packages must not import Node.js modules",
          },
          {
            group: [
              "@zodapp/zod-dynamodb-node",
              "@zodapp/zod-dynamodb-express",
              "@zodapp/zod-dynamodb-realtime",
              "@zodapp/zod-dynamodb-mqtt",
              "@aws-sdk/*",
            ],
            message: "browser packages must not import server packages",
          },
        ],
      },
    ],
  },
};

/** @type {import("eslint").Linter.Config[]} */
export default [...config, restricted];
