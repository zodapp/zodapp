# @zodapp/zod-form-widget

[日本語](README.ja.md)

## Overview

`@zodapp/zod-form-widget` is a set of ready-to-use widgets built on top of `@zodapp/zod-form-mantine`.

- `AutoForm` / `ReactiveAutoForm` / `AutoSearch`: build forms and search bars from a schema
- `AutoTable`: builds a list table from a schema (column reordering, resizing, and saving column settings)
- `useImportModal` / `useExportModal` / `ImportPanel`: importing and exporting CSV and similar formats (`@zodapp/zod-tabular`)
- `useDeleteModal` / `FetchMore`: delete confirmation, and loading more
- `en` / `ja` (`./messages`): dictionaries for UI texts and Zod errors

## Installation

```bash
pnpm add @zodapp/zod-form-widget
```

## Requirements

- React 18+ / 19+
- Zod v4
- `@tanstack/react-form`
- Mantine (`@mantine/core`, `@mantine/hooks`, `@mantine/dates`, `@mantine/dropzone`)

## Loading the styles

The CSS for `AutoTable` and others is not imported from JS. Import it at your app's entry point, after Mantine's CSS.

```ts
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/dropzone/styles.css";
import "@zodapp/zod-form-widget/styles.css";
```

If you use Mantine's `styles.layer.css` (`@layer mantine`), you can use the version wrapped in `@layer zodapp`.
Since it sits inside `@layer`, your app's CSS (outside `@layer`) can override it.

```ts
import "@mantine/core/styles.layer.css";
import "@zodapp/zod-form-widget/styles.layer.css";
```

Background colors and the like use Mantine's theme variables (such as `--mantine-color-body`), so they follow dark mode.
CSS class names are not a public API. Do not write overrides that depend on them.

## Language of texts (i18n)

Without a provider, texts are in English. For Japanese, wrap your app's root in `I18nMessagesProvider` from `@zodapp/i18n-messages-react` and pass `ja` from `./messages`. `ja` also includes the dictionaries of the packages it depends on (zod-form-mantine, zod-form-mantine-lite, zod-form-react) and of Zod errors (`@zodapp/i18n-messages-zod`).

```tsx
import { I18nMessagesProvider } from "@zodapp/i18n-messages-react";
import { ja } from "@zodapp/zod-form-widget/messages";

<I18nMessagesProvider locale="ja" messages={ja}>
  <App />
</I18nMessagesProvider>;
```

To change only some texts, pass layered dictionaries (later dictionaries win). Texts passed as props (such as `submitLabel`) take precedence over the dictionary.

```tsx
<I18nMessagesProvider
  locale="ja"
  messages={[ja, { "zodFormWidget.autoForm.submit": "登録" }]}
>
```

`AutoForm` and `AutoSearch` validate by turning Zod errors into dictionary keys (`zod.*`), so you do not need to set an errorMap with `z.config`. Texts written in the schema (`.min(3, "…")`) are shown as they are. If you write a dictionary key, it is translated (see the README of `@zodapp/i18n-messages`).

Table column headers (`label` in the metadata) and the names of saved settings (`groupLabel`, `label`) are also translated when they are dictionary keys.

When a CSV cannot be read, `parseDynamicTabularFile` throws `TabularImportError` (`code`: `"emptyFile" | "noHeader" | "noRows"`). Its `message` is a dictionary key.

## Initial values (`AutoForm`)

`AutoForm` passes the received `defaultValues` through `getDefaultValue(schema, defaultValues)` before using them (`getDefaultValue(schema)` if there are no `defaultValues`).

- Missing parts are filled with the schema's defaults: values of `.default()` / `.prefault()`, empty arrays / objects / Sets / Maps, literals with a single value, NaN for `z.nan()`, keys of `z.undefined()` / `z.void()`, etc. The values you pass are used as they are, and only missing keys are filled
  - NaN becomes null in JSON. It does not arrive as NaN when sent to a server or saved to DynamoDB, so use `z.nan()` / `z.literal(NaN)` only inside forms
- The filled values go into the default values, so just opening the form does not count as "changed"
- Required objects, intersections, and arrays start as `{}` / `[]` (they cannot start empty)
- The values passed to `onSubmit` / `onCancel` also include the filled keys (such as empty arrays)
- For schemas that cannot be filled (such as a recursive `z.lazy` without optional), the passed value is used without filling, and `console.error` is logged
- `AutoSearch` and `ReactiveAutoForm` do not fill

## When submission is blocked (`AutoForm`)

When submission is blocked, the reason is shown near the button row (`data-testid="form-submit-blocked"`). All applicable reasons are shown, and they stay until submit is pressed again. They disappear when submission succeeds.

- Some fields are loading: "Could not submit because some fields are still loading." (`zodFormWidget.autoForm.blocked.loading`)
- Some fields failed to load: "Could not submit because some fields failed to load." (`zodFormWidget.autoForm.blocked.failed`)
- There are input errors: "Could not submit because some fields have errors." (`zodFormWidget.autoForm.blocked.input`)

## Sorting tables (`AutoTable`)

Clicking a header sorts by the following rules for each kind of column.

- Numbers, dates, strings, booleans: sorted by value (strings with suggestions are also sorted by the value's text, not the display name)
- externalKey: sorted by the stored value (the ID), not by the display name (label)
- enum: in the order the options are defined. Values not in the options go last
- computed: sorted by the computed value (for strings, numbers, booleans, and dates; objects such as link or badge are sorted by the text shown on screen (label); anything else goes last)
- dynamic: not sortable (the meaning changes per row)

## Subpath exports

- `@zodapp/zod-form-widget`: everything below, plus re-exports such as `extendSchema`
- `@zodapp/zod-form-widget/form`: `AutoForm`, `ReactiveAutoForm`, `AutoSearch`
- `@zodapp/zod-form-widget/table`: `AutoTable` and the column settings controller
- `@zodapp/zod-form-widget/tabular`: import and export modals
- `@zodapp/zod-form-widget/feedback`: `useDeleteModal`, `FetchMore`
- `@zodapp/zod-form-widget/messages`: text dictionaries `en` and `ja`
- `@zodapp/zod-form-widget/styles.css`, `@zodapp/zod-form-widget/styles.layer.css`

## Examples

- `apps/form-demo`: `AutoForm`
- `apps/survey`: `AutoTable`, `AutoSearch`, import and export, delete confirmation
- `apps/taskmanager`: saving column settings (`useColumnSettingsProfileController`)

## Related

- `@zodapp/zod-form`: `zf` (schema extensions)
- `@zodapp/zod-form-mantine`: the Mantine componentLibrary
- `@zodapp/zod-tabular`: CSV / Excel conversion

## License

MIT ([`LICENSE`](./LICENSE))
