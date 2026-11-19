// @ts-check
import comment from "./rules/comment.js";

/**
 * `@zodapp/eslint-plugin-i18n-messages`。
 *
 * ルール `comment`：`msg("key" /* 文言 *\/)` のように、キーの直後に基準の言語の文言をコメントで書かせる。
 *
 * @example
 * // eslint.config.mjs
 * import i18nMessages from "@zodapp/eslint-plugin-i18n-messages";
 *
 * export default [
 *   {
 *     plugins: { "@zodapp/i18n-messages": i18nMessages },
 *     rules: {
 *       "@zodapp/i18n-messages/comment": [
 *         "warn",
 *         { dictionaries: { "myapp.": "src/messages/ja.ts" } },
 *       ],
 *     },
 *   },
 * ];
 *
 * @type {import("eslint").ESLint.Plugin & { rules: { comment: import("eslint").Rule.RuleModule } }}
 */
const plugin = {
  meta: { name: "@zodapp/eslint-plugin-i18n-messages" },
  rules: { comment },
};

export default plugin;
