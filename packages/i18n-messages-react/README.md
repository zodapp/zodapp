# @zodapp/i18n-messages-react

[日本語](README.ja.md)

## Overview

A provider and hooks that supply the dictionaries and locale of `@zodapp/i18n-messages` to React.

## Installation

```bash
pnpm add @zodapp/i18n-messages @zodapp/i18n-messages-react
```

## Usage

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

- Pass `messages` as a single dictionary or an array of dictionaries (later ones take precedence). In nested providers, the dictionaries are merged into the outer ones, and the inner ones take precedence.
- Without a provider, `locale` is `"en"` and the dictionary is empty.
- `msg.resolve(text)` translates a string packed with `msgKey`, and returns any other string as is.

### Default texts of packages

A library creates a hook with its own English dictionary as the default, so texts are shown in English even outside a provider.

```ts
import { createUseMsg } from "@zodapp/i18n-messages-react";
export const useMsg = createUseMsg(zodEn, en);
```

## API

- `I18nMessagesProvider` (`locale`, `messages`)
- `useMsg()` / `createUseMsg(defaults)`
- `useLocale()`

## License

MIT ([`LICENSE`](../../LICENSE))
