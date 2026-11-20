# How each Zod type is rendered

[日本語](schema-types.ja.md)

Components are looked up in `componentLibrary` by the zf name (typeName), and if not found, by the name of the zod type (`schema.type`). Every type behaves the same whether written with `z.*` or `zf.*`. Without meta (written with `z.*`), it is drawn with the default look; with meta, `label`, `uiType`, and so on are used. meta texts are read with `useResolvedMeta` (to translate labels written with `msgKey`).

## Wrapping types

Like optional, nullable, and default, these remove the wrapper and draw the inside (`baseComponents` of mantine-lite).

| Type                                                     | How it is drawn                                                                                                                                                                                                        |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.readonly()`                                            | Draws the inside as is. zod's readonly only freezes the value and is not about whether input is allowed, so it is not shown read-only                                                                                  |
| `.catch()`                                               | Draws the inside as is. On submit, parse replaces the value with the catch value                                                                                                                                       |
| `.nonoptional()`                                         | Draws the inside as required (cancels the outer optional)                                                                                                                                                              |
| `.prefault()`                                            | Draws the inside as is. If there is no value, the prefault value is put in ([Default values](../../zod-form/docs/default-value.md))                                                                                    |
| `.pipe()`, `.transform()`, `z.codec()`, `z.stringbool()` | Drawn with the entry schema (`def.in`). Validation runs on the whole pipe, so the value only passes if it is of the entry type. Checks attached to the pipe are passed inside. `z.stringbool()` becomes a string field |

## Fixed values

Types whose value is decided as one (a literal with a single value, `z.null()`, `z.undefined()`, `z.void()`, `z.nan()`) show no field by default. The value is put in as a default when opening (AutoForm), and the component does not write it.

- With `hidden: false` in meta, the schema's value is shown with the same look as readOnly (`z.nan()` shows "NaN"). No required mark is added. null, undefined, and void have no content, so nothing is shown
- If the field has errors, only the errors are shown
- Since it is a display that cannot be edited, it is not registered with the mechanism that validates preceding fields (`useValidatePrecedingFields`). Registering it would mean the field before it is no longer the last field of its container
- Discriminators inside union arms are no longer shown either, so they do not duplicate the select field
- `z.literal(true)` with `zf.boolean.registry` (an agreement checkbox) is drawn with the boolean component
- NaN is compared with `Object.is` (the same for options of literal unions). NaN becomes null in JSON, so use `z.nan()` only inside forms

## Types chosen as options

- **Literals with multiple values** (`z.literal(["a", "b"])`) are drawn with the enum component. `uiType` `select` and `badge`, multiple selection (`multipleEnum`), and `unlisted` are also the same as enum
- **Names of enum options**: enums written as objects (`z.enum({ A: 1 })`, TS enums) use the key as the name if there is no label. Enums written as arrays use the value. Values that fail zod validation are removed from the options (the reverse-mapping keys of numeric TS enums disappear). To name options freely, use `zf.enum` or a union of literals (label has top priority). The same rules apply to enum, badges, multiple selection, set, `union_select`, and enum columns in tables

## Collection types

- **`z.set()`**: elements cannot be assigned fields with TanStack Form paths, so the whole set is drawn as one field. If the elements are an enum, a union of literals, or a literal with multiple values, it is a MultiSelect; if string or number, a TagsInput (no duplicates); otherwise a notice that it cannot be handled. The empty value follows `emptyValueOf`, and all element errors are also shown on the set's field. Value comparison (`isEqualValue`) compares the contents of Sets and Maps
- **`z.map()`**: one field like set, with pairs written in the look of record entries. Keys accept only string and number; otherwise a notice that it cannot be handled is shown
- **Records whose keys can be enumerated** (the key schema has `_zod.values`: enum, literal, and unions of them): zod validates every key as required, so those keys are laid out as fixed fields, the same as an object. The field name is the key (or the option's label, if it has one), also with `uiType: "entries"`. `z.partialRecord` has empty `_zod.values`, but the candidates are taken from the def of the key schema (`partialRecordKeys`), and it is drawn with the look described in "How records look" in the README
- **Key check errors** (`invalid_key`) are shown on the key side (the key's field for entries, the record's field for the default look). In the entries look and in Map, half-written pairs whose key is empty, duplicated, or fails the key schema are left out of the value until fixed (so that a value different from the screen is not submitted)
- **The rest of a tuple**, and **array `uiType`s that do not fit the element type** (`multipleEnum` on an array of objects, etc.) are hard to constrain with types, so "This form cannot handle this combination of schemas." is shown in the field's place, and `console.error` is output

## Other types

- **`z.file()`**: a file input whose value is a File (Mantine's `FileInput`). A string pointing to a file stored elsewhere is `zf.externalFile`, which is different
- **`z.templateLiteral()`**: a string input. Its shape is checked by zod's validation
- **Types that show no field but keep the value**: `z.any()`, `z.unknown()`, `z.custom()` that is not a zf type, `z.symbol()`, `z.function()`, `z.never()`. The value is kept and submitted as is, and if there are errors, only the errors are shown. Even with `hidden: false`, the content is not shown
- **`z.promise()` and asynchronous checks** (`.refine(async …)`): synchronous `safeParse` throws, so `FormRuntime`'s validation and parse catch it, output `console.error`, and show "cannot handle asynchronous validation" as the reason submission was stopped. A `z.promise()` field shows a notice that it cannot be handled (to check only the shape, use `z.custom`)
- **Types that match no component**: a notice that it cannot be handled (`UnsupportedNotice`) is shown in the field's place, and the name of the type is output with `console.error`
- **`zf.computed()`**: a display-only field without a value, so it includes optional from the start

## Recursion depth (`z.lazy`)

Recursion without optional never finishes rendering, so the lazy component counts the nesting, and when it exceeds the limit (10 by default), it stops and shows a notice that it cannot be handled. Values beyond that are not removed and are submitted. The limit can be changed with `maxDepth` in the lazy's meta (`zf.common.registry`).

- What is counted is a chain of lazies continuing only through places that draw their inside even without a value (object, intersection, tuple, record with fixed keys, pipe, etc.)
- Passing through a component that does not draw its inside without a value (the 0..1 frame of optional and nullable objects and intersections, array, record entries, Map, union) resets the count to 0 (`ResetLazyDepth`; the limit is carried over), because from there on, rendering stops at the depth of the value. The optional wrapper itself does not reset it (if the inside is a tuple or a record with fixed keys, it draws its inside even without a value)
- Whether it is the same schema is not checked, because that would rely on zod's internal behavior

## Type contract of `zf.*.registry`

If a zf typeName is the same as the name of a zod type, it always accepts that zod type and handles it with the same component. The type contract may be widened to accept other types (`zf.date` also accepts `z.coerce.date()`, `z.number()`, and `z.iso.*`), and custom names that do not correspond to a zod type do not overlap with zod type names. `zf.externalKey` and `zf.externalFile`, like `zf.string`, also accept formatted strings (`z.email()`, etc.).
