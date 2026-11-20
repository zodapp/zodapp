# @zodapp/zod-form-react

[日本語](README.ja.md)

## Overview

`@zodapp/zod-form-react` is **the foundation for building form UIs in React** from Zod schemas with `@zodapp/zod-form` metadata.

- `Dynamic`: resolves a component from the schema's metadata (`typeName` / `uiType`) and renders it
- `ZodFormContextProvider`: supplies dependencies such as `componentLibrary` and resolvers
- `useZodForm` / `FormProvider`: form state management based on TanStack Form
- `zfReact`: provides `message` / `computed` (display only) in addition to `zf`
- `media`: preview resolution for images, videos, audio, etc. (`MediaResolvers`)

To use Mantine UI right away, `@zodapp/zod-form-mantine` is the quickest path.

## Installation

```bash
pnpm add @zodapp/zod-form-react
```

## Requirements

- React 18+ / 19+
- Zod v4
- `@tanstack/react-form`

## Quick start (minimal setup)

`Dynamic` resolves the `componentLibrary` key as `typeName` (for example `string`) or `typeName_uiType` (for example `string_password`).

```tsx
import { z } from "zod";
import {
  Dynamic,
  FormProvider,
  ZodFormContextProvider,
  useZodForm,
  type ComponentLibrary,
} from "@zodapp/zod-form-react";
import { zf } from "@zodapp/zod-form";

const schema = z
  .object({
    name: zf.string().register(zf.string.registry, { label: "Name" }),
  })
  .register(zf.object.registry, {});

// Example: your own componentLibrary (in practice, implement one for each typeName)
const componentLibrary: ComponentLibrary = {
  // key is `typeName` or `typeName_uiType`
  // value is a function returning `{ component }`, or a function returning a Promise of it
  string: () => import("./components/stringField"),
  object: () => import("./components/objectField"),
};

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
        <Dynamic fieldPath="" schema={schema} />
      </FormProvider>
    </ZodFormContextProvider>
  );
};
```

## `zfReact` (message / computed)

In addition to `zf` (React-independent), `zfReact` provides **display-only schema types**.

```ts
import { z } from "zod";
import { zfReact } from "@zodapp/zod-form-react";

const schema = z
  .object({
    notice: zfReact
      .message()
      .register(zf.message.registry, { content: "A supplementary message" }),
  })
  .register(zf.object.registry, {});
```

### `computed` (example from apps/form-demo)

`computed` receives `{ value, parent, context }` and computes **a value for display (a ReactNode)**.
On a field without a value (`zfReact.computed()`) it is display only; on a field with a value, it becomes the display of that value.
`parent` is set only with `dependsOnParent: true`, and `context` is set only when `contextId` is specified.

`apps/form-demo/src/pages/form/schemas/computed.ts` uses it like this:

```ts
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";

export const schema = z.object({
  unitPrice: zf
    .number()
    .min(0)
    .register(zf.number.registry, { label: "Unit price" }),
  quantity: zf
    .number()
    .min(0)
    .register(zf.number.registry, { label: "Quantity" }),
  total: zfReact.computed().register(zf.computed.registry, {
    label: "Total",
    dependsOnParent: true,
    compute: ({ parent }) => {
      const unitPrice = parent?.unitPrice ?? 0;
      const quantity = parent?.quantity ?? 0;
      return `¥${(unitPrice * quantity).toLocaleString()}`;
    },
  }),
});
```

## Hooks / providers (commonly used)

- **Context**
  - `useZodFormContext()`: access `componentLibrary`, resolvers, timezone, etc.
  - `useExternalKeyResolver(config)`: gets the matching resolver from `externalKeyResolvers` and runs it
  - `useExternalKeyDynamicMeta(schema)` / `useArrayExternalKeyDynamicMeta(schema)` (`@zodapp/zod-form-react/utils/externalKey`): build dynamic metadata from a single-select or multi-select (`z.array(zf.externalKey ...)`) externalKey field. Passed to `useDynamicSchema`, they deliver a schema built from the options (an enum by default, string + selection with `allowUnlisted`; for multi-select, an array of it that inherits the original array's constraints and metadata). Fetch failures become a dynamic error and block submission
  - `useExternalKeyOptions(schema)` (`@zodapp/zod-form-react/utils/externalKey`): subscribes to externalKey options. When the resolver calls `onError`, it returns `error` and `retry` (zod-form-mantine-lite fields use these to show "Retry"). If options arrive on the same subscription, it recovers; `retry` unsubscribes and starts over
  - `useFileResolver(config)`: gets the matching resolver from `fileResolvers` and runs it
  - `useMediaResolvers()`: returns `mediaResolvers` (`basicMediaResolvers` if not specified)
- **Forms / fields**
  - `useZodForm(...)`: creates a form based on TanStack Form
  - `useZodField(...)`, `useFormValues(...)`: helpers for referencing fields and values
  - `useArray(fieldApi, fieldPath, discriminator?)`: a wrapper for insert / remove / append / move on array fields
- **Runtime schemas / source of edits**
  - `useRunAsUserEdit()`: records value changes inside the given function as "user edits" (see "What the source of an edit changes" below)
  - `useDynamicSchema(meta, fieldPath)`: calls dynamic's resolve and registers the result in the form's registry
  - `TableRowProvider` / `useTableRow()`: passes the table row's value (table components receive `parent` from here)
- **Lazy loading / validation**
  - `useLazyFactory()`: Dynamic's lazy loading strategy (default is `React.lazy`)
  - `useValidatePrecedingFields({ name, ref })`: on focus, validates the "preceding fields" together (requires the provider)

### What the source of an edit changes (`useRunAsUserEdit`)

Each value change is recorded as either a user edit or an external change (writes from app code, `reset`, etc.). Input from components is a user edit. To write from app code as a user edit, wrap it in `useRunAsUserEdit()`.

The source only affects **pruning values whose type does not match** a schema refetched by dynamic.

- When a user edit changes the dynamic key, the value is trimmed to fit the new schema (items not in the new schema are removed)
- An external change leaves the value untouched, and mismatching values remain as validation errors
- `unlisted: "clear"` for values not in the options clears regardless of the source (the clearing is written as a user edit, so it cascades to dynamic fields below)

Provider components:

- `ZodFormContextProvider`: supplies `componentLibrary`, resolvers, and timezone
- `FormProvider`: supplies the form created with `useZodForm`
- `LazyProvider`: replaces the implementation of `useLazyFactory`
- `ValidatePrecedingFieldsProvider`: enables `useValidatePrecedingFields`

## Component props (`ZodFormProps`)

Components (the React components put into `componentLibrary`) receive `ZodFormProps`.

- `fieldPath` / `schema` / `defaultValue` / `readOnly` / `label`
- `optional`: `true` for a component inside an outer `.optional()` (or `.default()`). Treated as required when omitted
- `nullable`: `true` for a component inside an outer `.nullable()`. When nested like `.optional().nullable()`, both are `true`

The required mark on the label (Mantine's `required`) is decided by `!(optional || nullable)`.
When clearing a value, a component writes `undefined` if `optional`, or `null` if only `nullable` (`undefined` if both; a required field that is neither writes `undefined`, producing a "required" error). Custom components can get this value with `emptyValueOf({ optional, nullable })`.

> The former `required?: boolean` (optional when `false`) was replaced with `optional?: boolean`. In custom components, read `required !== false` as `!(optional || nullable)`, and `required={false}` as `optional={true}`.

### Where union arm errors go

Zod's `invalid_union` (the issue for a value that matches no arm) stays in the field's errors. `wrapComponent` and array fields do not display `invalid_union`. The zf.union component reads `invalid_union` and adds the selected arm's errors to `onDynamic` in the errorMap of the same field (and of the child fields of an object arm).

`onDynamic` is a slot that TanStack does not read or write under the default validation flow (TanStack Form's `defaultValidationLogic`). In forms that use `revalidateLogic` or per-field `validators.onDynamic`, this slot may collide.

## `basicMediaResolvers`

`basicMediaResolvers` is a minimal Mantine-independent set (image / video / audio). Pass it to `ZodFormContextProvider`, or it is used as the default of `useMediaResolvers()`.

> The Mantine fallbacks (generic previews, etc.) are provided by `@zodapp/zod-form-mantine`.

## Language of texts (i18n)

Component texts (such as "Loading") are written as keys (`zodFormReact.*`) of the `@zodapp/i18n-messages` dictionary. Without a provider, they are in English. For Japanese, pass `ja` from `./messages` to `I18nMessagesProvider` of `@zodapp/i18n-messages-react` (it includes the Zod error dictionary `zod.*`).

```tsx
import { I18nMessagesProvider } from "@zodapp/i18n-messages-react";
import { ja } from "@zodapp/zod-form-react/messages";

<I18nMessagesProvider locale="ja" messages={ja}>
  <App />
</I18nMessagesProvider>;
```

- `FormRuntime` (`wrapValidator`, `validate`) validates by turning Zod errors into dictionary keys. Texts written in the schema (`.min(3, "…")`) are shown as they are, and dictionary keys are translated. When a schema is passed directly to a validator, Zod's default texts are used.
- When metadata texts (`label`, `trueLabel`, `falseLabel`, `emptyMessage`, `selectorLabel`, `unselectedLabel`) are dictionary keys, components translate them (`useResolvedMeta`, `useResolveText`).
- When building components, create a `useMsg` with your own dictionary as the default using `createUseMsg`.

## API (excerpt)

- Rendering / context: `Dynamic`, `ZodFormContextProvider`
- Form state: `useZodForm`, `FormProvider`, `useZodField`, `useFormValues`
- More hooks / providers: `useZodFormContext`, `useExternalKeyResolver`, `useFileResolver`, `useMediaResolvers`, `useArray`, `useLazyFactory`, `LazyProvider`, `ValidatePrecedingFieldsProvider`, `useValidatePrecedingFields`
- Schema extensions: `zfReact`, `getMetaReact`
- Media: `MediaResolvers`, `basicMediaResolvers`, `imageMediaResolver` / `videoMediaResolver` / `audioMediaResolver`

## Related

- `@zodapp/zod-form`: React-independent `zf`
- `@zodapp/zod-form-mantine`: Mantine UI implementation (includes a `componentLibrary`)
- `@zodapp/zod-form-dynamodb`: a resolver that reads externalKey options from DynamoDB (`@zodapp/zod-dynamodb`)
- `@zodapp/zod-form-s3`: a resolver that stores files (`zf.externalFile`) in S3 (server side: `@zodapp/zod-form-s3-node`)
- Detailed specifications: [Passing field errors](docs/errors.md), [Values of zf.dynamic](docs/dynamic.md), ["Touched" and "changed" for container fields](docs/container-touch.md)

## License

MIT ([`LICENSE`](../../LICENSE))
