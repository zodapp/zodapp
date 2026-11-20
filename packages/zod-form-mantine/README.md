# @zodapp/zod-form-mantine

[日本語](README.ja.md)

## Overview

`@zodapp/zod-form-mantine` provides **a componentLibrary for using `@zodapp/zod-form-react` with Mantine UI**.

- `componentLibrary`: for rendering forms (Mantine)
- `tableComponentLibrary`: for rendering tables (Mantine)
- `defaultMediaResolvers`: preview resolution for images / videos / audio + `genericMediaResolver` (fallback)
- `DataBasedPreview`: an intermediate component that fetches data from a URL and passes it to a data-based preview component
- `genericMediaResolver`: a fallback that accepts any mimeType (shows a download link)

Combined with `zf` (schemas with metadata) from `@zodapp/zod-form`, it generates UIs from schemas.

## Installation

```bash
pnpm add @zodapp/zod-form-mantine
```

## Requirements

- React 18+ / 19+
- Zod v4
- `@tanstack/react-form`
- Mantine (`@mantine/core`, `@mantine/hooks`, `@mantine/dates`, `@mantine/dropzone`)

## Quick start (rendering a form)

```tsx
import { z } from "zod";
import { Stack, Button } from "@mantine/core";
import { zf } from "@zodapp/zod-form";
import {
  componentLibrary,
  Dynamic,
  FormProvider,
  ZodFormContextProvider,
  ValidatePrecedingFieldsProvider,
  useZodForm,
} from "@zodapp/zod-form-mantine";

const schema = z
  .object({
    name: zf.string().register(zf.string.registry, { label: "Name" }),
  })
  .register(zf.object.registry, {});

export const MyForm = () => {
  const form = useZodForm({
    defaultValues: { name: "" },
    validators: {
      onChange: schema,
      onBlur: schema,
      onSubmit: schema,
    },
    onSubmit: ({ value }) => console.log(value),
  });

  return (
    <ZodFormContextProvider componentLibrary={componentLibrary}>
      <FormProvider form={form}>
        <ValidatePrecedingFieldsProvider>
          <Stack gap="md">
            <Dynamic fieldPath="" schema={schema} />
            <Button type="button" onClick={() => form.handleSubmit()}>
              Submit
            </Button>
          </Stack>
        </ValidatePrecedingFieldsProvider>
      </FormProvider>
    </ZodFormContextProvider>
  );
};
```

## Media previews

Pass `mediaResolvers` for previews in file fields. The Mantine default is `defaultMediaResolvers`.

### `DataBasedPreview` / `genericMediaResolver`

- `genericMediaResolver` is a fallback with `mimeType: "*"`; it shows a **download link** even for files that cannot be previewed.
- Use `DataBasedPreview` when you want to **fetch the actual data from a URL** (like `fetch(url) -> ArrayBuffer`) and pass it to a preview component.

## Foreign key / file resolvers

To use foreign keys or file uploads, pass `externalKeyResolvers` / `fileResolvers` to `ZodFormContextProvider`.

For concrete examples, see `@zodapp/zod-form-dynamodb` for foreign keys (reads options from DynamoDB) and `@zodapp/zod-form-s3` for files (stores them in S3).

## Subpath exports

You can also import from these subpaths as needed:

- `@zodapp/zod-form-mantine/componentLibrary`
- `@zodapp/zod-form-mantine/tableComponentsLibrary`
- `@zodapp/zod-form-mantine/mediaResolvers`
- `@zodapp/zod-form-mantine/messages` (text dictionaries `ja` and `en`)

## Usage in apps/form-demo

In `apps/form-demo`, `AutoForm` / `AutoTable` pass `componentLibrary` / `tableComponentLibrary` to `ZodFormContextProvider` and render `Dynamic`.

- `apps/form-demo/src/components/AutoForm.tsx`: `componentLibrary` + `useZodForm` + `FormProvider` + `ValidatePrecedingFieldsProvider`
- `apps/form-demo/src/components/AutoTable.tsx`: `tableComponentLibrary` + `Dynamic` (row values are passed with `TableRowProvider`, and computed / dynamic receive `parent` from there)

## Language of texts (i18n)

Component texts are written as dictionary keys (`zodFormMantine.*`, `zodFormMantineLite.*`). Without a provider, they are in English. For Japanese, pass `ja` from `./messages` to `I18nMessagesProvider` of `@zodapp/i18n-messages-react`. `ja` also includes the dictionaries of zod-form-mantine-lite, zod-form-react, and Zod errors, and importing it also loads the dayjs ja locale. The locale of date fields follows the `locale` of `I18nMessagesProvider`.

```tsx
import { I18nMessagesProvider } from "@zodapp/i18n-messages-react";
import { ja } from "@zodapp/zod-form-mantine/messages";

<I18nMessagesProvider locale="ja" messages={ja}>
  <App />
</I18nMessagesProvider>;
```

To change only some texts, pass dictionaries layered in an array (later ones win).

## How records look

The look depends on the key schema.

| Key                                    | Default                                                                                                                                       | `uiType: "entries"`                                                                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| enum / literal (`z.record`)            | A fixed field per key (all required)                                                                                                          | Same                                                                                                                                         |
| enum / literal (`z.partialRecord`)     | All candidate keys as fixed fields, each looking optional. A field that is emptied removes the key itself instead of putting undefined in the value | Only the keys in the value are listed as rows, and each row can only be deleted. Keys not present yet are added with the select at the bottom (filterable by typing) |
| Others (such as `z.string()`)          | Lists the keys in the value                                                                                                                   | Add key-value pairs, typing the key                                                                                                          |

When `z.partialRecord` is rendered with `uiType: "entries"`, the order of rows is decided by `keyOrder` in the metadata.

- `"definition"` (default): the enum's definition order. For stores that do not keep key order, such as Firestore and DynamoDB
- `"value"`: the order in the value object. Added keys go at the end, so in stores that keep key order (zod-searchparams, JSON in localStorage, etc.) this is effectively the order they were added. Note that JS objects order keys that look like integers, such as `"1"` and `"2"`, in ascending numeric order regardless of insertion order

## Keys that cannot be used in forms

Form fields are addressed by field paths (`a.b[0].c`), so keys containing `.`, `[`, or `]`, and empty-string keys, cannot be fields.

- If such a key is in a `z.object` shape or in a record with fixed keys (`z.record(z.enum([...]), …)`), "This key name cannot be used" is shown in place of the field, and the reason is also logged with `console.error`
- In the entries look of a record, entering such a key is an error and it is not put into the value
- If such a key is in a value stored in a record, that element is shown as a non-editable row (the key, a note, the element's errors, and a delete button). The value is not displayed and is sent unchanged
- Caution: in a record whose values are objects, if keys `a` and `a.b` exist at the same time, the error names overlap and you cannot tell which element an error belongs to

## API (excerpt)

- `componentLibrary` / `tableComponentLibrary`
- `defaultMediaResolvers`
- `DataBasedPreview`, `genericMediaResolver`
- `Dynamic`, `ZodFormContextProvider`, `useZodForm`, `FormProvider`, ...

## Related

- `@zodapp/zod-form`: `zf` (schema extensions)
- `@zodapp/zod-form-react`: React foundation (for your own UI)
- `@zodapp/zod-form-dynamodb`: a resolver that reads externalKey options from DynamoDB (`@zodapp/zod-dynamodb`)
- `@zodapp/zod-form-s3`: a resolver that stores files (`zf.externalFile`) in S3 (server side: `@zodapp/zod-form-s3-node`)
- Detailed specifications (Japanese): [Object containers](docs/object.ja.md), [zf.intersection](docs/intersection.ja.md), [zf.union](docs/union.ja.md), [Selections shown as badges](docs/badge.ja.md), [How each Zod type is rendered](docs/schema-types.ja.md)

## License

MIT ([`LICENSE`](../../LICENSE))
