# @zodapp/zod-transform

[日本語](README.ja.md)

## Overview

`@zodapp/zod-transform` is a utility that **preprocesses and postprocesses values** following the structure of a Zod schema.

- `preprocess`: `unknown -> (a value normalized to the Zod shape)` (for shaping values before Zod's `parse`)
- `postprocess`: `(a value in the Zod shape) -> unknown` (for shaping values before saving or sending)
- `$remove(options?)`: a sentinel for removing a value from its parent container (the behavior for arrays / tuples can be adjusted with options)

## Installation

```bash
pnpm add @zodapp/zod-transform
```

## Requirements

- Zod v4

## Quick start

### Normalize non-canonical data while transforming it (`preprocess`)

Use cases: reading data from a database, deserialization, getting default values

```ts
import { z } from "zod";
import { preprocess } from "@zodapp/zod-transform";

const schema = z.object({
  count: z.number(),
});

// Shape the unknown value (numbers become Number)
const normalized = preprocess({ count: "42" }, schema, {
  number: (v) => Number(v),
});

// Validation is left to Zod's parse
const parsed = schema.parse(normalized);
```

### Transform normalized data into non-canonical data (`postprocess`)

Use cases: saving to a database, serialization

```ts
import { z } from "zod";
import { postprocess } from "@zodapp/zod-transform";

const schema = z.object({
  createdAt: z.date(),
});

const out = postprocess(
  { createdAt: new Date("2026-01-01T00:00:00.000Z") },
  schema,
  {
    date: (v) => v.toISOString(),
  },
);
// out becomes something like { createdAt: "2026-01-01T00:00:00.000Z" }
```

### (Advanced) About `processor`

`processor` is a hook called **while traversing** the schema's shape. In typical use cases `preprocess` / `postprocess` are enough; use `processor` when you want to **change the behavior** as below (pass it as `TransformOption.processor`).

- **Changing how traversal works**: replace how object / array / tuple and others are traversed
- **Transforming during traversal**: add your own transformation for a particular type only (recurse with `context.transform(value, childSchema)` as needed)
- **Using `$remove()`**: to remove a value from its parent container, return `$remove()` from that node's `processor`

### Removing fields from the result (`$remove()`)

`$remove()` is a placeholder for removing a value from its parent container (object / record / map / set, etc.).
For arrays / tuples, options such as `$remove({ array: null })` adjust whether the element is removed or replaced.

```ts
import { z } from "zod";
import { preprocess, $remove } from "@zodapp/zod-transform";

const schema = z.object({ a: z.string(), b: z.string().optional() });

const out = preprocess({ a: "keep", b: "drop" }, schema, {}, {
  processor: { string: (v) => (v === "drop" ? $remove() : v) },
});
// out becomes { a: "keep" }
```

## Operational notes (important)

- **No side effects**: every step may run more than once for the same schema and value. Do not define steps with side effects such as getters / setters, references to external state, or destructive changes.
- **Record key constraints**: keys of `z.record` are not transformed (only values are). Only `string`, enumerable keys are handled.
- **Object key constraints**: only `string`, enumerable keys of a `ZodObject` are handled. `Symbol` keys are not, including in catchall (following the behavior of `z.object`).
- **Intersection merge rules**: an intersection transforms left and right independently, then merges by taking the result of the side that changed compared to the original value. Objects are merged key by key, and arrays of the same length element by element, recursively. If one side returns `$remove` and the other only passes the value through, it is removed. If both sides transform into different values that disagree, right wins.
- **Class instances are not transformed**: when a class instance is given to a `ZodObject`, it passes through unchanged (even its enumerable properties are not transformed).
- **Beware of getters running**: if an object key has a getter, it runs through `Object.entries` and the like. Avoid designs where getters have side effects.
- **Assumption for `z.catch`**: Zod's type contract expects `catchValue` of `z.catch` to return a value that satisfies `innerType`. This implementation assumes that too, and behavior for schemas that violate it is not guaranteed. When the catch target contains a union, catch is called if no element of the union matches, but note that the error information then differs from Zod's original error information.
- **Implicit calls**:
  - For `"nullable"` with `null`, the `"null"` handler is called
  - For `"optional"` with `undefined`, the `"undefined"` handler is called
  - However, for `z.default`, nothing more is called when the value is `undefined` in preprocess
- **Behavior of `$remove`**: preprocess / postprocess can return `$remove`. `$remove` removes the element in the containing object, but the behavior depends on the context.
  - set / map / object / record: removes the element completely (cannot be changed)
  - array / tuple: converts it to `undefined` (the behavior can be changed with options)
  - union: converts it to `undefined` when it is the final return value

## Design principles

- preprocess / postprocess are not a replacement for `parse`. Validation is left to Zod's `parse`, and this library is responsible only for "structural and value transformation".
- `safeParse` may be used internally to decide union / optional / nullable and so on, but its results are never mixed directly into the output of preprocess / postprocess.
- preprocess converts "`unknown -> z.infer<T>`", and postprocess converts "`z.infer<T> -> unknown`".

## API (excerpt)

- `preprocess(obj, schemaOrSchemas, preprocessor, transformOption?)`
- `postprocess(obj, schemaOrSchemas, postprocessor, transformOption?)`
- `$remove(options?)` / `$$remove` (sentinel for removing array elements)

## Related

- `@zodapp/zod-searchparams`: conversion to URLSearchParams (driven by Zod schemas)
- `@zodapp/zod-form`: used to normalize form input

## License

MIT ([`LICENSE`](../../LICENSE))
