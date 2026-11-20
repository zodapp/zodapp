# @zodapp/zod-propagating-registry

[日本語](README.ja.md)

## Overview

`@zodapp/zod-propagating-registry` is **a thin utility for attaching metadata to schemas and reading it back with the Zod v4 registry mechanism**.

zodapp uses it as the foundation for attaching UI metadata such as `label` and `uiType` to Zod schemas (it is used inside `@zodapp/zod-extendable`).

## Installation

```bash
pnpm add @zodapp/zod-propagating-registry
```

## Requirements

- Zod v4

## Quick start

```ts
import { z } from "zod";
import { zodPropagatingRegistry } from "@zodapp/zod-propagating-registry";

// Create a registry with any name (string or symbol)
const uiMeta = zodPropagatingRegistry<{ label?: string }>("uiMeta");

// Attach metadata to a Zod schema (uses Zod v4's register)
const nameSchema = z.string().register(uiMeta, { label: "Name" });

// Read the attached metadata
const meta = uiMeta.getExtended(nameSchema);
// meta?.label === "Name"
```

### Using `getMeta`

`getMeta(schema, metaIdKey)` reads metadata with an explicit **metaIdKey (Symbol)**.

```ts
import { z } from "zod";
import {
  zodPropagatingRegistry,
  getMeta,
} from "@zodapp/zod-propagating-registry";

const uiMeta = zodPropagatingRegistry<{ label?: string }>("uiMeta");

const schema = z.string().register(uiMeta, { label: "Name" });
const meta = getMeta(schema, Symbol.for("uiMeta"));
```

## API (excerpt)

- `zodPropagatingRegistry(name, fixedMeta?)`
- `getMeta(schema, metaIdKey)`
- `registry.add(schema, meta)` / `registry.getExtended(schema)`
- `type MetaOf<Registry>`

## Related

- `@zodapp/zod-extendable`: extended Zod factories that can carry metadata (the foundation of zf)
- `@zodapp/zod-form`: standardizes schema metadata for forms

## License

MIT ([`LICENSE`](../../LICENSE))
