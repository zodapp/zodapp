# @zodapp/zod-form

[日本語](README.ja.md)

## Overview

`@zodapp/zod-form` lets you attach form metadata to Zod schemas, **without depending on React**.

- `zf.*`: extended factories built on the Zod v4 registry (metadata such as `label` / `uiType` / `readOnly`)
- `getMeta(schema)`: reads the metadata attached to a schema
- `externalKey` / `externalFile`: the foundation for types and config for foreign key selection and externally stored files (uploads). The config is plain data. To change it based on the parent or the context, wrap it in `zf.dynamic`. Whether options are fetched again is decided by the stringified config and the context values, so when you swap in a config that differs only in its functions, give the config a `key`
- `computed` / `dynamic`: functions that receive `{ value, parent, context }` and decide, at runtime, what to display or which schema to actually use
- `valueAction`: types for actions on a selected value (such as opening it as a link)
- `zf.time`: values that hold only a time of day (`z.iso.time()`, and `z.number()` holding the amount elapsed since midnight)
- `createMockFileResolver`: a mock for local development (keeps files as Data URLs)
- `createMockTopic` / `createMockExternalKeyResolver`: externalKey mocks for local development. They deliver the options put into a topic, and deliver them again whenever the topic changes. The mocks never wait: if the topic has a value, it is delivered as soon as you subscribe, and a topic without a value (`createMockTopic()`) delivers nothing until the first `set` (the field stays loading). To show a loading state, wrap the resolver on the caller side to delay it. The config's `filter(option, context)` can narrow the options using the resolverContext of `contextId`. Subscribing to a topic name that is not in `topics` immediately delivers `Error('topic "<name>" がありません')` to `onError` (the field goes into the error state and shows "Retry", so that a misspelled name is noticed). To deliver zero options, put an empty topic (`createMockTopic([])`)

To actually render forms (React components), use `@zodapp/zod-form-react` / `@zodapp/zod-form-mantine`.

## Installation

```bash
pnpm add @zodapp/zod-form
```

## Requirements

- Zod v4

## Quick start (schema definition)

```ts
import { z } from "zod";
import { zf } from "@zodapp/zod-form";

const userSchema = z
  .object({
    name: zf.string().register(zf.string.registry, { label: "Name" }),
    email: zf.string().email().register(zf.string.registry, { label: "Email" }),
    age: zf.number().min(0).register(zf.number.registry, { label: "Age" }),
  })
  .register(zf.object.registry, {});

export type User = z.infer<typeof userSchema>;
```

## Naming rules for `zf.*`

`zf.*()` are aliases of the standard Zod schemas with metadata registration added; their values and validation are the same as `z.*()`. Components are looked up by the zf name (typeName), and then by the Zod type name (`schema.type`) if none is found.

- When a zf name is the same as a Zod type name, it always accepts that Zod type and handles it with the same component. It may widen the contract to accept other types too (for example, `zf.date` accepts `z.number()`, `z.iso.datetime()`, and `z.iso.date()` in addition to `z.date()`)
- Custom names that do not correspond to a Zod type (`time`, `externalKey`, `externalFile`, `hidden`, `common`, `computed`, `dynamic`) never overlap with Zod type names. For example, a string that points to an externally stored file is `zf.externalFile`, which is different from `z.file()` (a File object)

## Reading metadata

```ts
import { zf, getMeta } from "@zodapp/zod-form";

const schema = zf
  .string()
  .register(zf.string.registry, { label: "Password", uiType: "password" });

const meta = getMeta(schema);
// meta?.typeName === "string"
// meta?.label === "Password"
// meta?.uiType === "password"
```

## Storage format of dates and times (`zf.date` / `zf.time`)

`z.iso.datetime()` / `z.iso.datetime({ local: true })` for `zf.date`, and `z.iso.time()` for `zf.time`, write strings by the same rules.

- With a precision, the value is written to match it (-1: up to minutes, 0: up to seconds, 1 or more: that many digits of fractional seconds). If unit is omitted, it is derived from precision (-1 → minute, 0 → second, 1 or more → millisecond)
- A unit finer than the precision can hold would not fit in the value, so an error is thrown at definition time (for example, unit `second` with precision -1, or unit `millisecond` with precision 0)
- Formats without a precision accept any granularity in Zod, so the unit decides the written form (second if unit is omitted)

| unit                   | `z.iso.datetime()`                                   | `z.iso.datetime({ local: true })` | `z.iso.time()` |
| ---------------------- | ---------------------------------------------------- | --------------------------------- | -------------- |
| hour / minute / second | `YYYY-MM-DDTHH:mm:ssZ` (seconds are `00` for minute) | `YYYY-MM-DDTHH:mm:ss`             | `HH:mm:ss`     |
| millisecond            | `YYYY-MM-DDTHH:mm:ss.SSSZ`                           | `YYYY-MM-DDTHH:mm:ss.SSS`         | `HH:mm:ss.SSS` |

(`hour` is for `zf.time` only)

- Do not change the unit of a field without a precision later. Stored values and newly written values would end up in mixed forms
- When the unit is coarser than a stored value, editing sets the parts finer than the unit to 0 (for example, editing a value with seconds in a unit `minute` field makes the seconds `00`). Just opening the form does not rewrite the value
- Editing with the date-time picker writes 0 for the digits the picker cannot edit (for example, milliseconds: even in a unit `millisecond` field, choosing a date and time again in the picker makes the milliseconds `000`). Just opening the form does not rewrite the value

## Foreign keys / files (foundation for types and config)

This package provides the **config types**. The actual resolution is provided by separate packages.

- Foreign keys: `@zodapp/zod-form-dynamodb` (a resolver that reads options from a query in the DynamoDB registry)
- Files: `@zodapp/zod-form-s3` (a resolver that stores files in S3)

## externalKey resolvers

A resolver returns a value with `subscribe(callback, onError?)`.

```ts
const resolvers = [
  {
    type: "api",
    resolver: (config) => ({
      subscribe: (callback, onError) => {
        const off = watchOptions(config, {
          next: (options) => callback(options), // { label, value }[]
          error: (error) => onError?.(error),
        });
        return off;
      },
    }),
  },
];
```

- Deliver options with `callback`. You may call it any number of times; each call changes the field's options
- Call `onError` when fetching fails. The field goes into the dynamic error state, shows "Retry", and submission is blocked. The value is not cleared (neither pruned nor cleared as unlisted)
- If options later arrive through `callback` on the same subscription, the field recovers without pressing Retry. Pressing Retry unsubscribes and starts over
- `onError` is optional. Resolvers that do not use it keep working as they are
- A mock topic delivers a failure with `fail(error)`. The failure state lasts until the next `set`, and fields that subscribe in the meantime receive the failure immediately

Both the single-select field (`zf.externalKey`) and the multi-select field (`z.array(zf.externalKey ...)` with `uiType: "multipleExternalKey"`) are built on dynamic. Both build a schema from the options and deliver it to dynamic, so loading, refetching, fetch failures (which block submission), and pruning behave the same way.

- The schema delivered to a multi-select field is an array of the enum built from the options (string + selection if `allowUnlisted`). It inherits the original array's constraints (`min` / `max` / `length`) and metadata (such as `label`)
- For a multi-select field, write `unlisted` / `allowUnlisted` / `emptyMessage` on the element's `zf.externalKey`. `clear` removes only the elements not in the options; `keep` shows "(Invalid value)" and makes it an error (they can be removed one by one with ×)

## For development and testing: `createMockFileResolver`

For when the upload destination is not decided yet, or for checking behavior during UI development, a file resolver that **does not actually upload** is provided.

```ts
import { createMockFileResolver } from "@zodapp/zod-form";

const fileResolvers = [createMockFileResolver()];
```

`apps/form-demo/src/pages/form/detail.tsx` also uses `createMockFileResolver()` for the form demo page.

## Values not in the options (`unlisted`)

`unlisted` on `zf.enum` / `zf.externalKey` decides what happens when a value is not in the options.

- `clear` (default): clear the value
- `keep`: keep the value, show "(Invalid value)" in the field, and make it an error. When the option comes back, the display returns to normal

`allowUnlisted` on `zf.externalKey` is different from `unlisted`.

- `allowUnlisted: true`: accept values not in the options as valid (the field becomes string + selection, and the options become suggestions). It neither clears them nor makes them errors
- `unlisted`: when values not in the options are treated as wrong (`allowUnlisted` omitted or `false`), decides how to handle such a value

With `allowUnlisted: true`, `unlisted` has no effect, so writing both is a type error.

`clear` is done by the selection component, so it only affects fields that are rendered. Values of fields that are not rendered (such as an unselected arm of a `union`) are not cleared even if they are not in the options.

`clear` clears the value as soon as the field is displayed. Even if the user touches nothing, a stored value that is not in the options disappears, and saving as is saves without it. When subscribed to the options, the value disappears even in a form being edited, as soon as someone removes it from the options. Even if the option comes back later, the cleared value does not come back. If you do not want to lose values, use `keep`.

Whether just opening a form changes values depends on the mechanism.

- `z.preprocess` (such as `union`): normalizes the value when the form opens
- `unlisted: "clear"`: clears values not in the options when the form opens
- Date and time precision: not rewritten on open (adjusted to the field's precision only when the user edits)

Rewriting on open (`clear` and the `z.preprocess` of `union`) is by design. Neither marks fields as "touched" or "changed", though, so `isDirty` stays `false` after just opening the form.

- The required error of a field cleared by `clear`, like other required fields, does not appear until the field is touched or the form is submitted
- The same applies when a dynamic refetch prunes values
- When the user changes an upper field and a lower field is cleared, the edit of the upper field makes `isDirty` `true`

## When there are no options (`emptyMessage`)

While there are zero options, for example because an upper field is not selected yet, the field is disabled and shows `emptyMessage` (default: "No options").

- Required fields: if you write `emptyMessage` on `zf.externalKey`, that text becomes the field's error (for example, "Select a prefecture first" for the city field while the prefecture is empty). This text goes into the form errors instead of "Required", and submission is blocked. It is shown in red on the field only after the field is touched or the form is submitted, like other required fields
- Optional fields: only disabled with the text shown; not an error
- Multi-select fields: disabled with the text shown. The error of a required field stays the same text as other required arrays (it does not become `emptyMessage`)

## Placeholder (`placeholder`)

`placeholder` is the text shown while an input is empty. Write it in the meta of `zf.string`, `zf.number`, `zf.bigint`, `zf.date`, `zf.enum`, and `zf.externalKey`. If you write it as a dictionary key with `msgKey`, the components translate it.

- While a component shows its own text (loading, no options, the label of the selected value while searching), the component's text takes precedence
- `zf.time` does not have it (the time picker has no single input)

## API (excerpt)

- `zf` / `getMeta`
- Metadata that takes functions: `FnInput`, `FnSourceMeta`, `ComputedMetaDef`, `DynamicMetaDef`, `SchemaResolver`, `asRegistrySchemaResolver`, `defineDynamicMeta`
- Adjusting values: `pruneValueToSchema`, `adaptValueToSchema`
- `valueAction` types: `BaseValueActionConfig`, `ValueActionRegistry`, `RegisteredValueActionConfig`
- `externalKey` types: `ExternalKeyResolverEntry`, `ExternalKeyResolvers`, `BaseExternalKeyConfig`, `RegisteredExternalKeyConfig`, ...
- `file` types / functions: `FileResolverEntry`, `FileResolvers`, `BaseFileConfig`, `RegisteredFileConfig`, `parseMimeTypeFromUrl`, `createMockFileResolver`, ...

## Related

- `@zodapp/zod-form-react`: React-dependent `Dynamic` / hooks / `zfReact`
- `@zodapp/zod-form-mantine`: componentLibrary implementation for Mantine UI
- `@zodapp/zod-form-dynamodb`: a resolver that reads externalKey options from DynamoDB (`@zodapp/zod-dynamodb`)
- `@zodapp/zod-form-s3`: a resolver that stores files (`zf.externalFile`) in S3 (server side: `@zodapp/zod-form-s3-node`)
- Detailed specification: [Default values and value adjustment](docs/default-value.md)

## License

MIT ([`LICENSE`](../../LICENSE))
