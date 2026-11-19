# @zodapp/i18n-messages-react

> この README は日本語版です。英語版は日本語レビュー・整合性チェック後に翻訳予定です。

## 概要

`@zodapp/i18n-messages` の辞書とロケールを React に配る Provider と hook です。

## インストール

```bash
pnpm add @zodapp/i18n-messages @zodapp/i18n-messages-react
```

## 使い方

```tsx
import {
  I18nMessagesProvider,
  useMsg,
  useLocale,
} from "@zodapp/i18n-messages-react";

<I18nMessagesProvider locale="ja" messages={[formMantineJa, widgetJa, myAppJa]}>
  <App />
</I18nMessagesProvider>;

const Title = () => {
  const msg = useMsg();
  return <h1>{msg("myApp.title" /* i18n: タイトル */)}</h1>;
};
```

- `messages` は 1 つの辞書か、辞書の配列（後ろが優先）で渡します。入れ子の Provider では外側の辞書にマージされ、内側が優先されます。
- Provider が無いときは `locale` が `"en"` で、辞書は空です。
- `msg.resolve(text)` は、`msgKey` で詰めた文字列なら訳し、そうでなければそのまま返します。

### パッケージの既定の文言

ライブラリは自分の英語の辞書を既定にした hook を作ります。Provider の外でも英語で表示されます。

```ts
import { createUseMsg } from "@zodapp/i18n-messages-react";
export const useMsg = createUseMsg(zodEn, en);
```

## API

- `I18nMessagesProvider`（`locale`、`messages`）
- `useMsg()` / `createUseMsg(defaults)`
- `useLocale()`
