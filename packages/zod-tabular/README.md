# @zodapp/zod-tabular

[日本語](README.ja.md)

## Overview

`@zodapp/zod-tabular` converts between values of a Zod schema and tabular data (a 2D array with a header row), for CSV and Excel.

- `toTable(schema, rows)`: values → table. The first row is the header
- `fromTable(schema, table)`: table → values
- `tableToCsv(table)` / `csvToTable(csv)`: table ↔ Excel-compatible CSV text
- `formatCell(cell)`: the text of a single cell, as written to CSV

Nested objects, arrays, and unions are flattened into columns. `@zodapp/zod-form-widget` uses it for its import and export modals.

## Installation

```bash
pnpm add @zodapp/zod-tabular
```

## Requirements

- Zod v4

## Quick start

```ts
import { z } from "zod";
import { toTable, fromTable, tableToCsv, csvToTable } from "@zodapp/zod-tabular";

const schema = z.object({
  name: z.string(),
  age: z.number().optional(),
  tags: z.array(z.string()).default([]),
  address: z.object({ city: z.string() }),
});

const table = toTable(schema, [
  { name: "Alice", age: 30, tags: ["a", "b"], address: { city: "Tokyo" } },
  { name: "Bob", tags: [], address: { city: "Osaka" } },
]);
// [
//   ["name", "age", "tags[0]", "tags[1]", "address.city"],
//   ["Alice", 30, "a", "b", "Tokyo"],
//   ["Bob", null, null, null, "Osaka"],
// ]

const csv = tableToCsv(table);
const rows = fromTable(schema, csvToTable(csv));
```

## Columns

- Object fields become `parent.child`, and array elements become `items[0]`, `items[1]`, … (as many columns as the longest array)
- A union adds a `.__TYPE__` column next to it that records which option the value matched (`u`, `u.__TYPE__`)
- When reading, columns are matched by header text, so their order may differ from the schema. Columns that do not belong to the schema are ignored
- `skip: (schema) => boolean` in the options removes fields from the table both when writing and reading (treated like `z.never()` fields). It is called with the field's schema, still wrapped in `optional` and the like

## Reading (`fromTable`)

- Cell values are coerced to the schema's types before validation (numbers, booleans, dates, bigints). The coercion can be replaced with `numberConverter`, `booleanConverter`, `dateConverter`, and `bigintConverter` in the options
- Each row is validated with `schema.safeParse`, and **rows that fail are skipped** without an error. Compare the number of rows if you need to detect them
- Empty cells are read as missing. A required array whose cells are all empty does not pass, so give arrays that may be empty a `.default([])` (or make them optional)

## CSV

`tableToCsv` writes CSV that Excel opens as is: UTF-8 with a BOM, CRLF line breaks, `TRUE` / `FALSE` for booleans, and `YYYY-MM-DD HH:mm:ss` for dates. `csvToTable` reads it back (it also accepts CSV without a BOM).

## Errors

Schemas that cannot be turned into a table make `toTable` / `fromTable` throw `TabularError`, with a `code` from `ErrorCode`: `E_UNION_TYPE_COLLISION` (union options that cannot be told apart in a table) and `E_ID_OVERFLOW` (too many columns). A broken `.__TYPE__` cell (`E_INVALID_CONTROL_VALUE`) does not throw; that row is skipped like other invalid rows.

## API

- `toTable(schema, rows, options?)` / `fromTable(schema, table, options?)`
- `tableToCsv(table)` / `csvToTable(csv)` / `formatCell(cell)`
- `TabularError`, `ErrorCode`
- Types: `Table`, `TableCell`, `ToTableOptions`, `FromTableOptions`, `TableSchemaOptions`, `ToTableFn`, `FromTableFn`

## Related

- `@zodapp/zod-form-widget`: import and export modals built on this package

## License

MIT ([`LICENSE`](../../LICENSE))
