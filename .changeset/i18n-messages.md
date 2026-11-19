---
"@zodapp/i18n-messages": minor
"@zodapp/i18n-messages-react": minor
"@zodapp/i18n-messages-zod": minor
"@zodapp/eslint-plugin-i18n-messages": minor
"@zodapp/zod-form-react": minor
"@zodapp/zod-form-mantine-lite": minor
"@zodapp/zod-form-mantine": minor
"@zodapp/zod-form-widget": minor
---

UI の文言と zod のエラーを辞書で差し替えられるようにする（i18n）。

- 新しいパッケージ：`@zodapp/i18n-messages`（型付きの辞書、`msgKey`、`msg.resolve`）、`@zodapp/i18n-messages-react`（`I18nMessagesProvider`・`useMsg`・`useLocale`）、`@zodapp/i18n-messages-zod`（zod の issue を `zod.*` のキーにする error map と ja・en の辞書）、`@zodapp/eslint-plugin-i18n-messages`（キーの形の文字列の直後に、基準の言語の文言を `/* i18n: 文言 */` のコメントで書かせるルール）
- zod-form-react・mantine-lite・mantine・widget の固定の日本語の文言を辞書のキーにし、`./messages` で `ja`・`en` を公開した。meta の文言・選択肢・表の列の見出しも、辞書のキーなら訳す。日付の欄のロケールと表の並べ替えは `useLocale()` に従う
- `FormRuntime` の検証は zod のエラーを辞書のキーにする。AutoSearch も `FormRuntime` で検証する
- **破壊的変更**：Provider が無いときの文言を、日本語から英語にした。日本語にするときは `I18nMessagesProvider` に `@zodapp/zod-form-widget/messages` などの `ja` を渡す
- **破壊的変更**：`@zodapp/zod-form-widget/i18n/ja`（`jaErrorMap`）を削除した
- **破壊的変更**：mantine-lite の `UNLISTED_LABEL` を削除し、`useUnlistedLabel()` にした。`externalKeyDisplayLabel` は 4 つめの引数で選択肢に無い値の表示を受け取る
- `parseDynamicTabularFile` は `TabularImportError`（`code`）を投げる
