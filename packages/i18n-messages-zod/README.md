# @zodapp/i18n-messages-zod

[日本語](README.ja.md)

## Overview

An error map that turns Zod's default errors into strings packing `@zodapp/i18n-messages` keys (`zod.*`) and params, plus its ja / en dictionaries.

- `zodMsgKeyErrorMap` receives issues before they are finalized and converts them into keys and params defined by this package (for example `zod.tooSmall.string?minimum=3&inclusive=true`). Only this map depends on the shape of Zod issues; the keys and params are fixed as a public API.
- Texts written directly in a schema (`.min(3, "…")` or `msgKey(...)`) take precedence over this map.
- When displayed, the text is translated by looking it up in the dictionary with `msg.resolve`.

In `@zodapp/zod-form-react` forms, this map is passed automatically on every validation; you do not configure it. Server errors can stay in Zod's default English.

## Installation

```bash
pnpm add @zodapp/i18n-messages @zodapp/i18n-messages-zod
```

## Usage

```ts
import { zodMsgKeyErrorMap } from "@zodapp/i18n-messages-zod";
import { ja } from "@zodapp/i18n-messages-zod/messages";

const result = schema.safeParse(value, { error: zodMsgKeyErrorMap });
```

```tsx
<I18nMessagesProvider locale="ja" messages={[zodJa, /* other dictionaries */]}>
```

## Keys

| Key                                                                                              | params                                                                          |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `zod.required`                                                                                   | `expected` (only for `invalid_type`; optional)                                  |
| `zod.invalidType`                                                                                | `expected`, `received`                                                          |
| `zod.invalidValue`                                                                               | `values` (separated by `, `)                                                    |
| `zod.tooSmall.{string,number,bigint,array,set,file,date,other}`                                  | `minimum` (an ISO string for date), `inclusive` (`"true"`/`"false"`)            |
| `zod.tooBig.{…}`                                                                                 | `maximum`, `inclusive`                                                          |
| `zod.invalidFormat.{email,url,uuid,datetime,date,time,regex,startsWith,endsWith,includes,other}` | `format`, `pattern`, `prefix`, `suffix`, `includes`                             |
| `zod.notMultipleOf`                                                                              | `divisor`                                                                       |
| `zod.unrecognizedKeys`                                                                           | `keys` (separated by `, `)                                                      |
| `zod.invalidKey` / `zod.invalidElement`                                                          | `origin`                                                                        |
| `zod.invalidUnion`                                                                               | none (an empty string in the default dictionaries, since union fields show errors on the arm's fields) |
| `zod.invalid`                                                                                    | none (`custom`, etc.)                                                           |

## License

MIT ([`LICENSE`](../../LICENSE))
