import { readdirSync } from "node:fs";
import { config as reactConfig } from "@repo/eslint-config/react-internal";
import { i18nMessagesConfig } from "@repo/eslint-config/i18n-messages";

// 辞書はデモごとのファイル（src/messages/ja/<name>.ts）に分ける。
// キーは formDemo.<name>.*（フォームの中身）と formDemo.page.<name>.*（デモの title・description）
const dictionaryNames = readdirSync(
  new URL("./src/messages/ja/", import.meta.url),
)
  .filter((file) => file.endsWith(".ts"))
  .map((file) => file.slice(0, -".ts".length));
const dictionaries = Object.fromEntries(
  dictionaryNames.flatMap((name) => [
    [`formDemo.${name}.`, `src/messages/ja/${name}.ts`],
    [`formDemo.page.${name}.`, `src/messages/ja/${name}.ts`],
  ]),
);

/** @type {import("eslint").Linter.Config} */
export default [
  ...reactConfig,
  // 辞書のキーの直後に日本語の文言をコメントで書く（--fix で書き込む）
  ...i18nMessagesConfig(dictionaries),
];
