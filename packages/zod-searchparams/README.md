# @zodapp/zod-searchparams

[日本語](README.ja.md)

## Overview

`@zodapp/zod-searchparams` is a utility for **converting between URLSearchParams and objects** based on a Zod schema.

- `decodeSearchParams(searchParams, schema)`: URL → typed object
- `encodeSearchParams(obj, schema?, validate?)`: object → URL (works without a schema too)
- `searchParamsToParamsTree(searchParams)`: URL → `ParamsTree` (for TanStack Router integration)
- `fromParamsTree(paramsTree, schema)`: `ParamsTree` → typed object (for TanStack Router's `validateSearch`)

It also handles types that are hard to put in a URL, such as Date / Set / Map / bigint.

## Installation

```bash
pnpm add @zodapp/zod-searchparams
```

## Requirements

- Zod v4

## Quick start

### Using it directly (decode / encode)

```ts
import { z } from "zod";
import { decodeSearchParams, encodeSearchParams } from "@zodapp/zod-searchparams";

const schema = z.object({
  q: z.string().optional(),
  page: z.number().default(1),
  from: z.date().optional(),
});

// URL -> object
const params = decodeSearchParams(new URLSearchParams("page=2"), schema);
// params.page === 2

// object -> URL
const sp = encodeSearchParams({ q: "hello", page: 2, from: new Date("2025-01-01") }, schema);
// sp.toString() => "q=hello&page=2&from=20250101000000000" (for example)
```

### Using it with TanStack Router (recommended)

We recommend setting up **schema-independent** encode / decode globally (on the Router), and doing only the **schema-based type conversion** per route.

```ts
import { createRouter, type RouterHistory } from "@tanstack/react-router";
import { encodeSearchParams, searchParamsToParamsTree } from "@zodapp/zod-searchparams";

export const createAppRouter = (history: RouterHistory) =>
  createRouter({
    routeTree,
    history,
    stringifySearch: (search) => {
      const str = encodeSearchParams(search).toString();
      return str ? `?${str}` : "";
    },
    parseSearch: (searchStr) => {
      return searchParamsToParamsTree(new URLSearchParams(searchStr));
    },
  });
```

In each route, call `fromParamsTree` in `validateSearch`:

```ts
import { z } from "zod";
import { fromParamsTree, type ParamsTree } from "@zodapp/zod-searchparams";

const searchSchema = z.object({
  dueAt: z
    .object({ $gte: z.date().optional(), $lte: z.date().optional() })
    .optional(),
});

validateSearch: (paramsTree: ParamsTree) => fromParamsTree(paramsTree, searchSchema)
```

## Supported types (main ones)

- `z.string()` → as is
- `z.number()` → string (`"42"`)
- `z.boolean()` → `"true"` / `"false"`
- `z.date()` → `YYYYMMDDHHmmssSSS` (UTC)
- `z.bigint()` → string
- `z.array()` / `z.tuple()` / `z.set()` → index form (`items.0=...`)
- `z.map()` → key form (`map.key=value`)
- `z.object()` → dot-separated (`user.name=...`)

### When a field name contains `.`

`.` is used as the path separator, so a `.` in a field name is escaped as `%2e`.

## API (excerpt)

- `decodeSearchParams(searchParams, schema)`
- `encodeSearchParams(obj, schema?, validate?)`
- `searchParamsToParamsTree(searchParams): ParamsTree`
- `fromParamsTree(paramsTree, schema)`

## Related

- `@zodapp/zod-transform`: the transformation engine (used internally)
- `@tanstack/react-router`: Router integration example (see this README)

## License

MIT ([`LICENSE`](../../LICENSE))
