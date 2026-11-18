# @zodapp/i18n-messages-zod

> この README は日本語版です。英語版は日本語レビュー・整合性チェック後に翻訳予定です。

## 概要

zod の既定のエラーを、`@zodapp/i18n-messages` のキー（`zod.*`）と params を詰めた文字列にするエラーマップと、その ja・en の辞書です。

- `zodMsgKeyErrorMap` は確定前の issue を受け取り、こちらで決めたキーと params に変換します（例：`zod.tooSmall.string?minimum=3&inclusive=true`）。zod の issue の形に依存するのはこのマップの中だけで、キーと params は公開 API として固定します。
- スキーマに直接書いた文言（`.min(3, "…")` や `msgKey(...)`）は、このマップより優先されます。
- 表示するときに `msg.resolve` で辞書を引いて訳します。

`@zodapp/zod-form-react` のフォームでは、検証のたびにこのマップが自動で渡されます。利用者が設定することはありません。サーバーのエラーは、zod の既定の英語のままでかまいません。

## インストール

```bash
pnpm add @zodapp/i18n-messages @zodapp/i18n-messages-zod
```

## 使い方

```ts
import { zodMsgKeyErrorMap } from "@zodapp/i18n-messages-zod";
import { ja } from "@zodapp/i18n-messages-zod/messages";

const result = schema.safeParse(value, { error: zodMsgKeyErrorMap });
```

```tsx
<I18nMessagesProvider locale="ja" messages={[zodJa, /* ほかの辞書 */]}>
```

## キー

| キー | params |
| --- | --- |
| `zod.required` | なし（値が `undefined`/`null`） |
| `zod.invalidType` | `expected`、`received` |
| `zod.invalidValue` | `values`（`, ` 区切り） |
| `zod.tooSmall.{string,number,bigint,array,set,file,date,other}` | `minimum`（date は ISO 文字列）、`inclusive`（`"true"`/`"false"`） |
| `zod.tooBig.{…}` | `maximum`、`inclusive` |
| `zod.invalidFormat.{email,url,uuid,datetime,date,time,regex,startsWith,endsWith,includes,other}` | `format`、`pattern`、`prefix`、`suffix`、`includes` |
| `zod.notMultipleOf` | `divisor` |
| `zod.unrecognizedKeys` | `keys`（`, ` 区切り） |
| `zod.invalidKey`・`zod.invalidElement` | `origin` |
| `zod.invalidUnion` | なし（既定の辞書では空文字。union の欄は腕の欄にエラーを出すため） |
| `zod.invalid` | なし（`custom` など） |
