# `@zodapp/*` のパッケージが文言を持つときの決まり

[English](library-messages.md)

zod-form-react・zod-form-mantine・zod-form-mantine-lite・zod-form-widget など、画面に文言を出す `@zodapp/*` のパッケージは、次の決まりで i18n-messages を使います。新しく文言を持つパッケージも、これに合わせます。

## キーと辞書

- **キー**は `.` 区切りの平らな文字列で、パッケージ名のキャメルケースを名前空間にします（`zodFormReact.*`・`zodFormMantine.*`・`zodFormMantineLite.*`・`zodFormWidget.*`）。その下は部品名で区切ります（`zodFormWidget.tableSetting.saveAs`）。`zod.*` は i18n-messages-zod が使います。キーは公開 API として固定します
- **辞書**は各パッケージの `src/messages/`（`types.ts`・`en.ts`・`ja.ts`・`useMsg.ts`・`index.ts`）に置き、`./messages` のサブパスで `en` と `ja` を export します。型の基準は `en` で、`ja` は `satisfies MessagesOf<typeof en>` で確かめます
- 各パッケージの `en`・`ja` は、依存するパッケージの辞書も含みます（zod-form-widget の `ja` に、mantine・lite・react・zod の辞書が入る）。アプリは 1 つ渡せば足ります
- `useMsg` は `createUseMsg(...依存するパッケージの en, 自分の en)` で作ります（後ろが勝つ）
- 日付の部品が使う dayjs の ja ロケールは、部品からではなく ja の辞書のモジュールで import します

## 文言の優先順位

1. props で個別に渡された値（`submitLabel`・`selectorLabel` など）。既定値は `submitLabel ?? msg("zodFormWidget.autoForm.submit" /* 保存 */)` の形で書き、props の既定値に文言を書きません
2. `I18nMessagesProvider` の辞書（入れ子なら内側が勝つ）
3. パッケージの既定（`en`）

Provider が無いときは英語です。

## 文言の種類ごとの扱い

- **画面の文言**：`msg("キー" /* 基準の言語の文言 */)` で書きます。コメントは ESLint（`@zodapp/eslint-plugin-i18n-messages`）が辞書と突き合わせ、`--fix` で書き込みます
- **エラーの文言**：`msgKey(...)` で詰めた文字列（`key?a=1&b=2`）を issue の message にし、表示するときに `msg.resolve` で訳します。経路を問わず、キーでなければそのまま出ます。部品の中で `safeParse` するときは `{ error: zodMsgKeyErrorMap }` を渡します
- **throw する文言**：コード付きのエラーにし、表示する側でコードから訳します（`TabularImportError` の `message` は辞書のキー）
- **meta の文言**：`label`・`trueLabel`・`falseLabel`・`emptyMessage`・`selectorLabel`・`unselectedLabel`・`placeholder`、選択肢のラベル、表の列の見出し、computed・formatter が返す文字列（badge などの `label` を含む）は、zod-form-react の `useResolvedMeta`・`useResolveText` で訳します（キーなら訳し、普通の文字列ならそのまま）
- **開発者向けの文言**（`console.error`・設定の誤りで throw するもの）：辞書に入れず、英語で書きます
- **ロケール**：日付の部品の `locale`、`toLocaleString`、`localeCompare` は `useLocale()` から取ります

サーバーのエラーは訳しません（zod の既定の英語のまま）。
