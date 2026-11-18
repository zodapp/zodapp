# @zodapp/i18n-messages

> この README は日本語版です。英語版は日本語レビュー・整合性チェック後に翻訳予定です。

## 概要

UI の文言とエラーの文言を、型付きの辞書で差し替えられるようにする小さな仕組みです。i18next や react-intl には依存しません。

- 辞書の型は `RegisteredMessages` に module augmentation で足します。
- 文言を引く `msg(key, params?)` と、キーと params を文字列に詰める `msgKey(key, params?)` は、登録されたキーと params の型で検査されます。
- `msgKey` で詰めた文字列（`key?a=1&b=2`）は、zod のエラーの文言やスキーマの `label` にそのまま渡せ、表示するときに辞書で訳されます。キーでない文字列はそのまま出ます。

React で使うときは `@zodapp/i18n-messages-react`、zod の既定のエラーを訳すときは `@zodapp/i18n-messages-zod` を併せて使います。

## インストール

```bash
pnpm add @zodapp/i18n-messages
```

## 使い方

### 辞書を定義して型を登録する

```ts
import { defineMessages, type MessagesOf } from "@zodapp/i18n-messages";

// 型の基準にする辞書
export const en = defineMessages({
  "myApp.submit": "Submit",
  "myApp.rowCount": ({ count }: { count: number }) => `${count} rows`,
  // msgKey で使うキーの params は文字列で受け取る
  "myApp.nameTooShort": ({ length }: { length: string }) =>
    `At least ${length} characters`,
});

declare module "@zodapp/i18n-messages" {
  interface RegisteredMessages extends MessagesOf<typeof en> {}
}

// ほかの言語は satisfies でキーのそろいと params の型を確かめる
export const ja = {
  "myApp.submit": "送信",
  "myApp.rowCount": ({ count }) => `${count} 件`,
  "myApp.nameTooShort": ({ length }) => `${length}文字以上で入力`,
} satisfies MessagesOf<typeof en>;
```

### エラーの文言やラベルにキーを書く

```ts
import { msgKey } from "@zodapp/i18n-messages";

z.string().min(
  3,
  msgKey("myApp.nameTooShort" /* ${length}文字以上で入力 */, { length: 3 }),
);
// → "myApp.nameTooShort?length=3"
```

params をすべて省略できる項目（`(p?: { expected?: string }) => …`）は、params を省いて `msgKey("key")`・`msg("key")` と書けます。

### 運用ルール

- キーは `msg(...)` か `msgKey(...)` を通して書き、生の文字列では書きません。
- キーの名前空間はアプリ名・パッケージ名にします（`myApp.*`）。`zod.*` は `@zodapp/i18n-messages-zod` が使います。
- キーの直後に、基準の言語の文言をブロックコメントで書きます。`@zodapp/eslint-plugin-i18n-messages` が辞書と突き合わせ、`--fix` で書き込みます。

### i18next と併せて使う

```ts
import { messagesFromTranslator } from "@zodapp/i18n-messages";

const messages = messagesFromTranslator(i18n.t);
```

訳が無いキーは、各パッケージの既定の文言に落ちます。

## API

- `msgKey(key, params?)` / `encodeMsgKey(key, params?)`（型を確かめない版） / `parseMsgKey(text)`
- `createMsg(lookup)` / `resolveMsg(lookup, text)` / `lookupFromDictionaries(...dictionaries)`
- `defineMessages(messages)`
- `messagesFromTranslator(t, options?)`
- 型: `RegisteredMessages`、`MessageKey`、`Messages`、`MessagesOf`、`MsgFn` など
