# @zodapp/zod-transport-json

[日本語](README.ja.md)

## Overview

`@zodapp/zod-transport-json` converts values to and from JSON along a Zod schema. Types that JSON cannot carry, such as `Date`, `bigint`, `Set`, and `Map`, are turned into JSON values when sending and restored when receiving.

`createJsonTransport(schema)` returns:

- `domainSchema`: the schema you passed (the shape used in your code)
- `transportSchema`: a schema for the JSON shape derived from it (useful for validating payloads or generating API documentation)
- `encode(value, context?)`: value → JSON-ready value
- `decode(input, context?)`: JSON value → value of the schema

zodapp uses it in the HTTP and realtime protocols of `@zodapp/zod-dynamodb`.

## Installation

```bash
pnpm add @zodapp/zod-transport-json
```

## Requirements

- Zod v4

## Quick start

```ts
import { z } from "zod";
import { createJsonTransport } from "@zodapp/zod-transport-json";

const schema = z.object({
  createdAt: z.date(),
  size: z.bigint(),
  tags: z.set(z.string()),
  counts: z.map(z.string(), z.number()),
});

const transport = createJsonTransport(schema);

const json = transport.encode({
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  size: 10n,
  tags: new Set(["a", "b"]),
  counts: new Map([["x", 1]]),
});
// { createdAt: "2026-01-01T00:00:00.000Z", size: "10", tags: ["a", "b"], counts: { x: 1 } }

const value = transport.decode(JSON.parse(JSON.stringify(json)));
// value.createdAt is a Date, value.size is a bigint, value.tags is a Set, value.counts is a Map
```

## Conversion rules

| Schema | JSON |
| --- | --- |
| `z.date()` | An ISO 8601 string with an offset. In UTC (`toISOString()`) by default; with `context.timeZone`, in that time zone (`2026-01-01T09:00:00.000+09:00`) |
| `z.bigint()` | A string |
| `z.set()` | An array |
| `z.map()` | An object. Only keys that are strings (string, string literals / enums, or unions of them) are supported; others throw when the transport is created |
| `z.object()` / `z.array()` / `z.tuple()` / `z.record()` / `z.union()` / `z.intersection()` / `optional` / `nullable` / `default` / `catch` / `readonly` / `pipe` / `lazy` | Converted recursively, keeping the structure |
| Others | As they are |

- `encode` validates the value with the schema, converts it, and then validates the result with `transportSchema`. `decode` validates the input with `transportSchema`, restores the values, and then validates with the schema. Both throw `ZodError` on failure
- Object fields whose value is `undefined` are removed
- The schema's `description` (or the result of the `descriptionResolver` option) is copied to `transportSchema`

## Options

```ts
createJsonTransport(schema, {
  allowLocalDateTime: true, // also accept date-times without an offset when decoding
  descriptionResolver: (schema) => labelOf(schema), // description for transportSchema
});

transport.decode(input, { timeZone: "Asia/Tokyo" });
```

- `allowLocalDateTime`: accepts date-times without an offset (`2026-01-01T09:00:00`) in `decode`. They are interpreted in `context.timeZone`, which is then required (an error is thrown without it)
- `context.timeZone`: an IANA time zone name. Used to write dates in `encode` and to read local date-times in `decode`

## API

- `createJsonTransport(domainSchema, options?)`
- Types: `JsonTransport`, `JsonTransportOptions`, `JsonTransportContext`

## Related

- `@zodapp/zod-transform`: the transformation engine (used internally)
- `@zodapp/zod-dynamodb`: uses this package for its protocols

## License

MIT ([`LICENSE`](../../LICENSE))
