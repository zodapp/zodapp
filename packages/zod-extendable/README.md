# @zodapp/zod-extendable

[日本語](README.ja.md)

## Overview

`@zodapp/zod-extendable` is a utility for **attaching metadata to Zod v4 schemas and reading it back later**.
`extendCustom` takes a factory function (for example `z.string`), and the schemas it returns come with a metadata registry (`@zodapp/zod-propagating-registry`). The registry extends ZodRegistry, so you can attach metadata with standard Zod syntax.
Extended factories are provided for the standard factories such as z.string, z.number, z.boolean, z.date, z.array, z.object, z.union, z.enum, z.literal, z.tuple, z.record, z.set, and z.bigint: extendString, extendNumber, extendBoolean, extendDate, extendArray, extendObject, extendUnion, extendEnum, extendLiteral, extendTuple, extendRecord, extendSet, extendBigint, and so on.

- **Attach**: `schema.register(factory.registry, meta)`
- **Read (basic)**: `factory.registry.get(schema)` (fixed metadata such as `typeName` is merged in)
- **Read (helper)**: `getMeta(schema)` (for when you do not have the registry at hand. It reads the metadata through the internal key `Symbol.for("zodExtendable")`. Specify the registry type to make it type-safe)

Most `extend*` functions are thin wrappers that call `z.*` as is internally.
**Only `z.enum` takes "an array of values"** as its argument, so carrying the metadata attached to `z.literal(...)` in a form reachable from the enum takes some care.
That is why `extendEnum()` (the equivalent of `e.enum`) converts "a tuple of literals → values" and automatically registers `schemas`, through which the option's literal schemas can be reached (described below).

zodapp builds `zf` for form generation (`@zodapp/zod-form`) on top of this mechanism.

## Installation

```bash
pnpm add @zodapp/zod-extendable
```

## Requirements

- Zod v4

## Quick start

### 1) Attach metadata to a string schema

```ts
import z from "zod";
import { extendString } from "@zodapp/zod-extendable";

// Create an "extended factory" with the metadata type you want to attach
// exString() itself returns the same schema as z.string()
const exString = extendString<{ label?: string }>();

const userSchema = z.object({
  name: exString().register(exString.registry, { label: "Name" }),
});

// Read the metadata from the registry (the fixed typeName is merged in)
const meta = exString.registry.get(userSchema.shape.name);
// meta?.typeName === "string"
// meta?.label === "Name"
```

### Using `getMeta()` directly

The basic way is `registry.get(schema)`, but when you do not have the registry at hand, `getMeta()` reads the same metadata.

`getMeta` in `@zodapp/zod-extendable` lets you specify the registry type for type inference:

```ts
import { extendString, getMeta } from "@zodapp/zod-extendable";

const exString = extendString<{ label?: string }>();
const s = exString().register(exString.registry, { label: "Name" });

const meta1 = exString.registry.get(s);
const meta2 = getMeta<typeof s, typeof exString.registry>(s);
// meta1 and meta2 have the same content
```

### 2) Create an enum (labeled literals)

```ts
import { extendEnum, extendLiteral } from "@zodapp/zod-extendable";

const exLiteral = extendLiteral<{ label?: string }>();
const exEnum = extendEnum<{ label?: string }>();

const roleSchema = exEnum([
  exLiteral("admin").register(exLiteral.registry, { label: "Administrator" }),
  exLiteral("user").register(exLiteral.registry, { label: "User" }),
] as const).register(exEnum.registry, { label: "Role" });

const roleMeta = exEnum.registry.get(roleSchema);
// roleMeta?.label === "Role"

// Each option's schema (= literal) can be reached
const adminLit = roleMeta?.schemas?.admin;
const adminMeta = adminLit ? exLiteral.registry.get(adminLit) : undefined;
// adminMeta?.label === "Administrator"
```

### Specification of `extendEnum()` (equivalent of `e.enum`)

- **Input**: a tuple of string `z.literal(...)` schemas (`readonly [z.ZodLiteral<string>, ...]`, at least one element; order is preserved)
- **Second argument**: `params` is the same as `params` of `z.enum(values, params)`
- **Output**: the same `z.ZodEnum` as `z.enum(values, params)` (`parse()` behaves the same)
- **Conversion**: builds `values: string[]` from `literals[i].value` and calls `z.enum(values, params)`
- **Automatic registration**: `extendEnum()` **always** registers `{ schemas }` for the generated enum schema in the registry it returns (`exEnum.registry` in the example above)
  - `schemas` is a map `{ [value: string]: z.ZodLiteral<string> }` that keeps the original literal schemas
  - This lets you go from the enum to each option's literal, and read the option's metadata with `extendLiteral().registry.get(...)`
- **Two levels of metadata**: metadata can be attached both at the "option (literal) level" and the "enum level"
  - option: registered in the `extendLiteral()` registry (for example `{ label: "Administrator" }`)
  - enum: registered in the `extendEnum()` registry (for example `{ label: "Role" }`)
  - The enum-level metadata type is `Partial<TMeta> & { schemas?: ... }` (optional, since `schemas` is registered automatically)
- **Caution**: `schemas` is a reserved key used internally by `extendEnum()` (using the same key in your own metadata collides with it)

## API (excerpt)

- `extendCustom(factory, typeName, metaSchema?)`
- `extendString(metaSchema?)` / `extendNumber(metaSchema?)` / `extendBigint(metaSchema?)` / `extendDate(metaSchema?)` / `extendBoolean(metaSchema?)`
- `extendArray(metaSchema?)` / `extendTuple(metaSchema?)` / `extendRecord(metaSchema?)` / `extendSet(metaSchema?)` / `extendObject(metaSchema?)` / `extendUnion(metaSchema?)`
- `extendEnum(metaSchema?)` / `extendLiteral(metaSchema?)`
- `schemaType()` (a sentinel for type inference)
- `getMeta(schema)` (reads metadata)

## Related

- `@zodapp/zod-propagating-registry`: the registry implementation
- `@zodapp/zod-form`: `zf` (standard metadata for forms)

## License

MIT ([`LICENSE`](../../LICENSE))
