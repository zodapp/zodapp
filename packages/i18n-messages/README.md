# @zodapp/i18n-messages

[日本語](README.ja.md)

## Overview

A small mechanism for replacing UI texts and error texts through typed dictionaries. It does not depend on i18next or react-intl.

- Dictionary types are added to `RegisteredMessages` through module augmentation.
- `msg(key, params?)`, which looks up a text, and `msgKey(key, params?)`, which packs a key and params into a string, are checked against the registered key and params types.
- A string packed with `msgKey` (`key?a=1&b=2`) can be passed as is to Zod error texts or a schema's `label`, and is translated with the dictionary when displayed. Strings that are not keys are shown as they are.

For React, use `@zodapp/i18n-messages-react` alongside it; to translate Zod's default errors, use `@zodapp/i18n-messages-zod`.

## Installation

```bash
pnpm add @zodapp/i18n-messages
```

## Usage

### Define a dictionary and register its type

```ts
import { defineMessages, type MessagesOf } from "@zodapp/i18n-messages";

// The dictionary used as the type reference
export const en = defineMessages({
  "myApp.submit": "Submit",
  "myApp.rowCount": ({ count }: { count: number }) => `${count} rows`,
  // params of keys used with msgKey are received as strings
  "myApp.nameTooShort": ({ length }: { length: string }) =>
    `At least ${length} characters`,
});

declare module "@zodapp/i18n-messages" {
  interface RegisteredMessages extends MessagesOf<typeof en> {}
}

// For other languages, check that the keys match and the params types with satisfies
export const ja = {
  "myApp.submit": "送信",
  "myApp.rowCount": ({ count }) => `${count} 件`,
  "myApp.nameTooShort": ({ length }) => `${length}文字以上で入力`,
} satisfies MessagesOf<typeof en>;
```

### Write keys in error texts and labels

```ts
import { msgKey } from "@zodapp/i18n-messages";

z.string().min(
  3,
  msgKey("myApp.nameTooShort" /* i18n: ${length}文字以上で入力 */, {
    length: 3,
  }),
);
// → "myApp.nameTooShort?length=3"
```

For entries whose params can all be omitted (`(p?: { expected?: string }) => …`), you can omit the params and write `msgKey("key")` / `msg("key")`.

### Conventions

- Always write keys through `msg(...)` or `msgKey(...)`, never as raw strings.
- Use your app or package name as the key namespace (`myApp.*`). `zod.*` is used by `@zodapp/i18n-messages-zod`.
- Right after a key, write the reference-language text in a block comment. `@zodapp/eslint-plugin-i18n-messages` checks it against the dictionary and writes it with `--fix`.

### Using it with i18next

```ts
import { messagesFromTranslator } from "@zodapp/i18n-messages";

const messages = messagesFromTranslator(i18n.t);
```

Keys without a translation fall back to each package's default texts.

### Rules for libraries that own texts

How the `@zodapp/*` packages decide keys, dictionaries, and precedence is described in [docs/library-messages.ja.md](docs/library-messages.ja.md) (Japanese).

## API

- `msgKey(key, params?)` / `encodeMsgKey(key, params?)` (the version without type checking) / `parseMsgKey(text)`
- `createMsg(lookup)` / `resolveMsg(lookup, text)` / `lookupFromDictionaries(...dictionaries)`
- `defineMessages(messages)`
- `messagesFromTranslator(t, options?)`
- Types: `RegisteredMessages`, `MessageKey`, `Messages`, `MessagesOf`, `MsgFn`, etc.

## License

MIT ([`LICENSE`](../../LICENSE))
