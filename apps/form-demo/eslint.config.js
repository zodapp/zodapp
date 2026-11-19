import { config as reactConfig } from "@repo/eslint-config/react-internal";
import { i18nMessagesConfig } from "@repo/eslint-config/i18n-messages";

/** @type {import("eslint").Linter.Config} */
export default [
  ...reactConfig,
  // 辞書のキーの直後に日本語の文言をコメントで書く（--fix で書き込む）
  ...i18nMessagesConfig({ "formDemo.": "src/messages/ja.ts" }),
];
