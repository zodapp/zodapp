import path from "node:path";
// リポジトリの lint はビルドの前に動く（CI）ので、プラグインは dist ではなく src を直接読む
import i18nMessagesPlugin from "../eslint-plugin-i18n-messages/src/index.js";

const packagesDir = path.resolve(import.meta.dirname, "..");

/** リポジトリのパッケージの名前空間と、基準の言語（ja）の辞書 */
const packageDictionaries = {
  "zod.": path.join(packagesDir, "i18n-messages-zod/src/messages/ja.ts"),
  "zodFormReact.": path.join(packagesDir, "zod-form-react/src/messages/ja.ts"),
  "zodFormMantineLite.": path.join(
    packagesDir,
    "zod-form-mantine-lite/src/messages/ja.ts",
  ),
  "zodFormMantine.": path.join(
    packagesDir,
    "zod-form-mantine/src/messages/ja.ts",
  ),
  "zodFormWidget.": path.join(
    packagesDir,
    "zod-form-widget/src/messages/ja.ts",
  ),
};

/**
 * `@zodapp/i18n-messages/comment` を有効にする設定。
 * `msg("key" /* 文言 *\/)` のように、キーの直後に日本語の文言をコメントで書かせる（`--fix` で書き込む）。
 *
 * @param {Record<string, string>} [dictionaries] 足す名前空間と辞書（相対パスは ESLint の cwd から）
 * @returns {import("eslint").Linter.Config[]}
 */
export const i18nMessagesConfig = (dictionaries = {}) => [
  {
    plugins: { "@zodapp/i18n-messages": i18nMessagesPlugin },
    rules: {
      "@zodapp/i18n-messages/comment": [
        "warn",
        {
          referenceLocale: "ja",
          dictionaries: { ...packageDictionaries, ...dictionaries },
        },
      ],
    },
  },
];
