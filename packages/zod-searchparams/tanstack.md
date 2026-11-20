# Using zod-searchparams with TanStack Router

[日本語](tanstack.ja.md)

This guide explains how to use `@zodapp/zod-searchparams` together with TanStack Router.

## Overview

`zod-searchparams` is a library for two-way conversion between Zod schemas and URLSearchParams. Combined with TanStack Router, it lets you handle complex types such as Date, Set, and Map as URL parameters.

### Division of roles for encoding and decoding

| Processing      | Where it is set                     | Function                           | Schema     |
| --------------- | ----------------------------------- | ---------------------------------- | ---------- |
| Encoding        | `stringifySearch` of `createRouter` | `encodeSearchParams(obj)`          | Not needed |
| Parsing         | `parseSearch` of `createRouter`     | `searchParamsToParamsTree(params)` | Not needed |
| Type conversion | `validateSearch` of each route      | `fromParamsTree(tree, schema)`     | Needed     |

With this division of roles:

- **navigate / Link**: just pass an object (encoded automatically)
- **URL parsing**: nested structures are restored automatically (global setting)
- **Route definitions**: only type conversion with the schema (simple)

## Setup

### 1. Router settings (global)

Set `stringifySearch` and `parseSearch` on `createRouter`:

```typescript
// router.tsx
import { createRouter, type RouterHistory } from "@tanstack/react-router";
import {
  encodeSearchParams,
  searchParamsToParamsTree,
} from "@zodapp/zod-searchparams";

export const createAppRouter = (history: RouterHistory) =>
  createRouter({
    routeTree,
    history,
    // Encoding: object → URL string (schema-independent)
    stringifySearch: (search) => {
      return encodeSearchParams(search).toString();
    },
    // Parsing: URL string → ParamsTree (schema-independent)
    parseSearch: (searchStr) => {
      return searchParamsToParamsTree(new URLSearchParams(searchStr));
    },
  });
```

### 2. Route definitions (per route)

Each route's `validateSearch` only converts types using the schema:

```typescript
// tasks.route.ts
import { createRoute } from "@tanstack/react-router";
import { z } from "zod";
import { fromParamsTree, type ParamsTree } from "@zodapp/zod-searchparams";

// Search condition schema (includes the Date type)
const searchSchema = z.object({
  status: z.enum(["todo", "doing", "done"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueAt: z
    .object({
      $gte: z.date().optional(),
      $lte: z.date().optional(),
    })
    .optional(),
});

export const tasksRoute = createRoute({
  getParentRoute: () => parentRoute,
  path: "tasks",
  // ParamsTree → typed object (schema-dependent)
  validateSearch: (paramsTree: ParamsTree) =>
    fromParamsTree(paramsTree, searchSchema),
  component: TasksPage,
});
```

## Usage

### Navigation

Since `stringifySearch` is set globally, `navigate` and `Link` just take the object as is:

```typescript
import { useNavigate, useSearch } from "@tanstack/react-router";

const TasksPage = () => {
  const search = useSearch({ from: tasksRoute.id });
  const navigate = useNavigate({ from: tasksRoute.id });

  // Date objects can be passed as is (encoded automatically)
  const handleFilterChange = (status: string, from: Date, to: Date) => {
    navigate({
      search: {
        status,
        dueAt: { $gte: from, $lte: to },
      },
    });
  };

  return (
    // ...
  );
};
```

### The Link component

```typescript
import { Link } from "@tanstack/react-router";

// Dates and complex types can be passed as is
<Link
  to="/tasks"
  search={{
    status: "todo",
    dueAt: {
      $gte: new Date("2025-01-01"),
      $lte: new Date("2025-12-31"),
    },
  }}
>
  Tasks
</Link>
```

## Supported types and encoding formats

| Zod type        | URL parameter format | Example                      |
| --------------- | -------------------- | ---------------------------- |
| `z.string()`    | As is                | `name=John`                  |
| `z.number()`    | Stringified          | `count=42`                   |
| `z.boolean()`   | `"true"` / `"false"` | `active=true`                |
| `z.date()`      | `YYYYMMDDHHmmssSSS`  | `date=20250313005222213`     |
| `z.bigint()`    | Stringified          | `big=12345678901234567890`   |
| `z.null()`      | `"null"`             | `value=null`                 |
| `z.undefined()` | `"undefined"`        | `value=undefined`            |
| `z.array()`     | Index notation       | `items.0=a&items.1=b`        |
| `z.tuple()`     | Index notation       | `pair.0=x&pair.1=42`         |
| `z.set()`       | Index notation       | `tags.0=a&tags.1=b`          |
| `z.map()`       | Key notation         | `map.key1=v1&map.key2=v2`    |
| `z.object()`    | Dot notation         | `user.name=John&user.age=30` |

## Practical examples

### Date range filter

```typescript
const dateRangeSchema = z.object({
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

// Navigation (encoded automatically)
navigate({
  search: {
    startDate: new Date("2025-01-01"),
    endDate: new Date("2025-12-31"),
  },
});

// Resulting URL: startDate=20250101000000000&endDate=20251231235959999
```

### Complex filter conditions

```typescript
const filterSchema = z.object({
  status: z.set(z.enum(["active", "pending", "closed"])).optional(),
  assignees: z.array(z.string()).optional(),
  tags: z.map(z.string(), z.boolean()).optional(),
  dateRange: z
    .object({
      from: z.date().optional(),
      to: z.date().optional(),
    })
    .optional(),
});

// Navigation (encoded automatically)
navigate({
  search: {
    status: new Set(["active", "pending"]),
    assignees: ["user1", "user2"],
    tags: new Map([
      ["urgent", true],
      ["feature", false],
    ]),
    dateRange: {
      from: new Date("2025-01-01"),
      to: new Date("2025-12-31"),
    },
  },
});

// Resulting URL:
// status.0=active&status.1=pending&
// assignees.0=user1&assignees.1=user2&
// tags.urgent=true&tags.feature=false&
// dateRange.from=20250101000000000&dateRange.to=20251231235959999
```

### Pagination and sorting

```typescript
const paginationSchema = z.object({
  page: z.number().default(1),
  limit: z.number().default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

// Switching pages (encoded automatically)
const handlePageChange = (page: number) => {
  navigate({
    search: { ...currentParams, page },
  });
};
```

## Caveats

### 1. Schemas that contain transform

With schemas that use `z.transform()`, values may change over a round trip if the transformation is not reversible:

```typescript
// Caution: this example is an irreversible transformation
const schema = z.object({
  doubled: z.string().transform((s) => Number(s) * 2),
});

// Normalize the value with parse() before encoding
const parsed = schema.parse({ doubled: "21" }); // { doubled: 42 }
```

### 2. Field names containing dots

If a field name contains `.`, it is escaped automatically:

```typescript
const schema = z.object({
  "foo.bar": z.string(),
});

// Encoded result: foo%2ebar=value
```

## API reference

### Exported functions and types

```typescript
// High-level API (the traditional usage)
decodeSearchParams(searchParams, schema): T
encodeSearchParams(obj, schema?, validate?): URLSearchParams

// Low-level API (for TanStack Router integration)
searchParamsToParamsTree(searchParams): ParamsTree  // schema-independent
fromParamsTree(paramsTree, schema): T               // schema-dependent

// Types
type ParamsTree = { [key: string]: ParamsTreeItem }
```
