# @zodapp/zod-form-mantine-lite

[日本語](README.ja.md)

## Overview

`@zodapp/zod-form-mantine-lite` is the set of Mantine components for zod-form that **does not depend on TanStack Form**. `@zodapp/zod-form-mantine` and `@zodapp/zod-form-widget` are built on it; use this package directly when you want the pieces without a form state library.

- `baseComponents`: components shared by every library (`optional`, `nullable`, `default`, `pipe`, `lazy`, `hidden`, etc.)
- `tableComponentLibrary`: a componentLibrary for rendering values in table cells (read-only)
- `reactiveComponentLibrary` / `ReactiveFormContextProvider`: a componentLibrary for "reactive" forms that save each field as soon as it is confirmed, without a submit button
- `defaultMediaResolvers` / `DataBasedPreview` / `genericMediaResolver`: previews for files (images, videos, audio, and a download link for anything else)
- `./utils`: building blocks such as `BadgeSelect`, `ColorBadge`, `computeBadgeColors`, `ReadonlyText`, and helpers for enum options
- `./messages`: text dictionaries `en` and `ja`

For regular forms with a submit button, use `@zodapp/zod-form-mantine`, or `AutoForm` in `@zodapp/zod-form-widget`.

## Installation

```bash
pnpm add @zodapp/zod-form-mantine-lite
```

## Requirements

- React 18+ / 19+
- Zod v4
- Mantine 8 or 9 (`@mantine/core`, `@mantine/hooks`, `@mantine/dates`)

## Reactive forms

Fields in `reactiveComponentLibrary` keep their own value while editing, and report it through `ReactiveFormContextProvider` when it is confirmed (the confirm button shown next to a changed field, or Ctrl+Enter). Escape discards the edit.

```tsx
import { Dynamic, ZodFormContextProvider } from "@zodapp/zod-form-react";
import {
  reactiveComponentLibrary,
  ReactiveFormContextProvider,
} from "@zodapp/zod-form-mantine-lite";

<ZodFormContextProvider componentLibrary={reactiveComponentLibrary}>
  <ReactiveFormContextProvider
    onConfirm={async ({ fieldPath, value }) => save(fieldPath, value)}
    onBlur={({ value, previousValue }) =>
      value === previousValue ? false : undefined
    }
  >
    <Dynamic fieldPath="" schema={schema} value={item} />
  </ReactiveFormContextProvider>
</ZodFormContextProvider>;
```

- `onConfirm({ fieldPath, value, previousValue })`: called when a changed field is confirmed
- `onBlur(...)`: called when a field with an unconfirmed change loses focus. Return `true` to confirm, `false` to revert, and `undefined` to keep the edit pending
- While a field has no pending change, it follows changes to `value` from the parent

`ReactiveAutoForm` in `@zodapp/zod-form-widget` wraps this with a ready-made layout.

## Language of texts (i18n)

Texts are written as dictionary keys (`zodFormMantineLite.*`), and are in English without a provider. For Japanese, pass `ja` from `./messages` to `I18nMessagesProvider` of `@zodapp/i18n-messages-react` (the `ja` of `@zodapp/zod-form-mantine` and `@zodapp/zod-form-widget` already includes it).

## Subpath exports

- `@zodapp/zod-form-mantine-lite`: everything above
- `@zodapp/zod-form-mantine-lite/baseComponents`, `/tableComponents`, `/reactiveComponents`: each library, plus individual components (`/baseComponents/*`, etc.)
- `@zodapp/zod-form-mantine-lite/mediaResolvers`
- `@zodapp/zod-form-mantine-lite/utils`
- `@zodapp/zod-form-mantine-lite/messages`

## Related

- `@zodapp/zod-form-react`: `Dynamic` and the componentLibrary mechanism
- `@zodapp/zod-form-mantine`: the componentLibrary for forms with TanStack Form
- `@zodapp/zod-form-widget`: `AutoForm`, `ReactiveAutoForm`, `AutoTable`, and more

## License

MIT ([`LICENSE`](../../LICENSE))
