# Default values and value adjustment

[日本語](default-value.ja.md)

## `getDefaultValue(schema, value?)`

Builds a form's initial value from a schema. When `value` is passed, it walks the schema while keeping that value, and fills in only where the value is `undefined`. Values already present are not changed.

- It also fills in inside each array element, each record value, each object key, and the chosen arm of a union. Rather than building a separate tree of initial values and overlaying it, it walks the value and the schema together, so the same rules apply at every depth
- Without `value`, it builds the initial value from the schema alone
- When it cannot fill in (the shape of the schema and the value do not match, etc.), it returns the value as is
- AutoForm runs `defaultValues` through this when opening the form ("The value when opening" in the README of `@zodapp/zod-form-widget`). Values of fixed values (such as a literal with a single value) are also put in here, not by the components

The initial value per type (when the value is `undefined`):

| schema                                                                            | Initial value                                                                                                                                                           |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.default(x)`, `.prefault(x)`                                                     | `x` (the result of calling it, if it is a function)                                                                                                                     |
| object                                                                            | `{}` with the children's initial values. Keys that became `undefined` are not set (keys of children whose validation result depends on whether the key exists are kept) |
| Array                                                                             | `[]`. With a length constraint (`length`, `min`), that many `undefined`s                                                                                                |
| tuple                                                                             | As many `undefined`s as there are elements                                                                                                                              |
| Records whose keys can be enumerated (keys are enum, literal, and unions of them) | The value's initial value for each enumerated key (keys whose initial value is `undefined` are not set)                                                                 |
| Other records, Set, Map                                                           | Empty values                                                                                                                                                            |
| A literal with a single value                                                     | That value                                                                                                                                                              |
| A literal with multiple values                                                    | `undefined`                                                                                                                                                             |
| `z.null()`                                                                        | `null`                                                                                                                                                                  |
| `z.nan()`                                                                         | `NaN`                                                                                                                                                                   |
| `z.undefined()`, `z.void()`                                                       | `undefined` (the object key is set, because whether the key exists changes zod's validation result)                                                                     |
| optional                                                                          | `undefined` (the inside is not walked)                                                                                                                                  |
| `.nonoptional()`                                                                  | The initial value of the inside without optional                                                                                                                        |
| nullable                                                                          | If the inside is a default (`.default("x").nullable()`), that value; if the inside contains optional, `undefined`; otherwise `null`                                     |

- A field with both optional and nullable (`.optional().nullable()`, `.nullable().optional()`) is `undefined` in either order
- A nullable object starts as `null`, and its fields are not shown until it is opened with +
- An intersection fills in each side separately, and merges the keys if both sides are objects

### How union arms are chosen

For a union with a value, an arm is chosen in the following order, and the walk fills in with that arm. This matches the rules by which the zf.union component decides the arm ([zf.union](../../zod-form-mantine/docs/union.md) of `@zodapp/zod-form-mantine`).

1. For a discriminatedUnion, the arm whose discriminator value matches
2. If some arm validates the value as is, the first such arm
3. If exactly one object arm has literal fields whose values match, that arm
4. If it cannot decide, the value is returned as is (nothing is filled in)

Whether the walked result passes validation does not matter, because this is also for filling in data in the middle of input (such as something saved with required fields still empty).

## `pruneValueToSchema(value, schema)` and `adaptValueToSchema(value, schema)`

- `pruneValueToSchema`: removes values that do not fit the schema
- `adaptValueToSchema`: removes values that do not fit, then fills in (`getDefaultValue(schema, pruneValueToSchema(value, schema))`). Used by zf.dynamic when the schema switches as a result of the user's editing ([Values of zf.dynamic](../../zod-form-react/docs/dynamic.md) of `@zodapp/zod-form-react`)
