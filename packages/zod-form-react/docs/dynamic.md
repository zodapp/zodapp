# Values of zf.dynamic

[日本語](dynamic.ja.md)

`zf.dynamic` draws a field with a schema decided at runtime. externalKey is built on the same mechanism (`useDynamicSchema`), delivering the schema built from its options to dynamic.

## The value when the schema is decided

**When the schema is decided, fill in missing values with defaults. Remove values that do not fit only when the user switched.**

| When                                                              | What happens to the value                   |
| ----------------------------------------------------------------- | ------------------------------------------- |
| When the schema is first decided                                  | Fill in (do not remove)                     |
| When it switches to another key as a result of the user's editing | Remove, then fill in (`adaptValueToSchema`) |
| When it switches other than by the user's editing                 | Nothing                                     |

- The first time does not remove, because the value at that point may be saved data
- Only places where the value is `undefined` are filled in; values already present are not changed. Filling in is done by `getDefaultValue(schema, value)` ([Default values and value adjustment](../../zod-form/docs/default-value.md))
- The first write uses `dontValidate` and `dontUpdateMeta`, so it does not count as "touched" or "changed". It is not treated as the user's editing either
- If the filled-in result is the same as the current value, nothing is written
- The registered schema is rewrapped with the outer wrappers on the same path (the `outer` prop: optional, nullable, default, and checks attached to the wrappers such as `.refine()`). This keeps a `null` written by clearing the field from being stopped by the decided schema's validation, and shows errors from the outer checks on the field

## Putting the filled-in values into the initial values

If only the value is written the first time, TanStack compares the current value with `defaultValues`, so `isDefaultValue` becomes false just by opening, and `reset()` loses the filled-in values. So the fill is also put into `defaultValues`.

- dynamic registers "fill this path with this schema (including the outer wrappers)" with `FormRuntime.setDefaultFill(path, schema)` the first time, and removes it with `removeDefaultFill` when it goes away
- `FormRuntime.applyDefaultFills(defaults)` returns the value with the registered paths filled in, shallowest first, with `getDefaultValue(schema, value at that position)`. It does not create values for paths without a parent or outside the range of an array. If nothing changes, it returns `defaults` as is
- `useDefaultValuesWithFills(runtime, defaults)` recomputes when the registrations change. AutoForm passes it to `defaultValues` of `useZodForm`
- dynamic also writes directly to the current value, for when the user has touched it first and TanStack does not reset the value to `defaultValues`

When you use `useZodForm` directly without AutoForm and do not go through `useDefaultValuesWithFills`, `isDefaultValue` and `reset()` are based on the `defaultValues` before filling in.

When opening a form, AutoForm also fills in with the static schema using `getDefaultValue(schema, defaultValues)` ("The value when opening" in the README of `@zodapp/zod-form-widget`).

## `zf.dynamic` in the static schema

The base of `zf.dynamic()` is `z.unknown()`. The static schema can be parsed as is, and `.refine()` on neighboring fields runs too. Values are validated with the schema that dynamic decides and registers. Loading and fetch failures stop submission with the registered marker issues. CSV export and import (zod-tabular) skip dynamic fields.

The base has an `abort: true` check that rejects only the marker (`DYNAMIC_UNRESOLVED`) that the form's evaluation inserts. The marker is used only inside the form's evaluation, so parsing the same schema elsewhere, such as on the server, always passes this check.

## Validation and the submitted value (`FormRuntime.evaluate`)

Error display (`FormRuntime.validate`) and the submitted value (`FormRuntime.parse`) both read a single evaluation by `FormRuntime.evaluate`. It first inserts dynamic outputs into the value, then parses with the static schema.

1. Sort the registered paths, deepest first
2. For each, parse the current value at that path with the schema of the deepest registration for that path
   - Passed: insert the output at that path (the value is a copy; the form's value is not changed)
   - Failed, loading, or fetch failed: collect the issues, and insert the marker at that path
3. Parse the inserted value with the static schema
4. Drop the issues that rejected the marker (including inside arms of `invalid_union`), and return the remaining issues. If there are no issues, the output of step 3 is the submitted value

- "No error is shown but the form cannot be submitted" and "an error is shown but the form can be submitted" do not happen
- Outer transforms and refines receive the value after dynamic is parsed (the same as a parent receiving a child's output in zod). The insertion target is a path in the input value, so it always exists even when there is an outer transform
- When dynamic fails, is loading, or failed to fetch, the marker is rejected by the base's check, so outer refines do not run (the same as when a child's type does not match in zod; they do not run even when the child's failure is a continuable kind such as `min()`)
- When a parent's `.refine(..., { path: [...] })` points at a dynamic field, that error is shown on the dynamic field
- For a dynamic inside a dynamic, the inner one is inserted first. Seen from outside, the inner base is `z.unknown()`, so the output passes through
- When dynamics are nested on the same path, only the deepest registration is used. The inner dynamic registers with the outer wrappers and checks added ("The value when the schema is decided" above), so the outer `.refine()` still takes effect
- If a dynamic inside a union arm fails, zod gives up on that arm and tries another. It may pass with another arm, but submission is stopped by the dynamic's own issue
- `onCancel` receives the form's value (`z.input`)
