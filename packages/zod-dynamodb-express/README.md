# @zodapp/zod-dynamodb-express

[日本語](README.ja.md)

Exposes the operations written in the registry (`defineEndpoints`) of `@zodapp/zod-dynamodb` as Express 5 routes (the specifications are [Server API](../zod-dynamodb-node/docs/server-api.md) and [Protocol input / output and errors](../zod-dynamodb/docs/protocol.md)).

```ts
import type { IncomingMessage } from "node:http";
import express from "express";
import { createRepository, createServerApi } from "@zodapp/zod-dynamodb-node";
import { router } from "@zodapp/zod-dynamodb-express";

const repository = createRepository({
  tables: { tasks },
  overrides,
  dynamodb: new DynamoDBClient({}),
  cursorSecret: process.env.CURSOR_SECRET,
});

const serverApi = createServerApi(endpoints, {
  repository,
  // Builds the authentication context from the request. Errors thrown here are passed to next(error)
  context: (req: IncomingMessage) => resolveAuth(req.headers),
});

const app = express();
app.use(express.json());
app.use("/api", router(serverApi, { onError: (e) => logger.error(e) }));
```

- `router()` returns a `Router` with the registry's operations that have a `path`, registered under their HTTP method and path. Server-only operations (without `authorize`) and operations without a `path` are not registered
- `GET` operations read the input from the `input` query parameter (the JSON of the whole input). Others read it from the request body
- Put upstream middleware (rate limiting, etc.) on the path first with `app.use`

To expose an operation with a path or input reading that differs from the registry, register it individually with `handle()`.

```ts
import { handle } from "@zodapp/zod-dynamodb-express";

app.get(
  "/legacy/tasks/:workspaceId/:taskId",
  rateLimit,
  handle(serverApi.tasks.get, {
    input: (req) => ({
      workspaceId: req.params.workspaceId,
      taskId: req.params.taskId,
    }),
  }),
);
```

## Processing flow

1. Read the input (`input` in the query string for `GET`, `req.body` otherwise; if `input` is passed to `handle()`, its return value)
2. Restore values from JSON (`Date`, `bigint`, `Set`, `Map`) and validate them with the operation's schema
3. Build the authentication context with `context(req)` and set up a scope for the duration of the request
4. Call `authorize` (the shared definitions and the server overrides). If rejected, `FORBIDDEN` (403)
5. Call the repository
6. Convert the output to JSON and return it (200). Get always returns the token too, and delete returns `{}`

## Errors

Errors are returned as an HTTP status and `{ code, message, issues? }`.

| code             | HTTP | Source error                                                                        |
| ---------------- | ---- | ----------------------------------------------------------------------------------- |
| `INVALID_INPUT`  | 400  | Input validation failed. `issues` contains the Zod issues                           |
| `INVALID_CURSOR` | 400  | The pagination token is invalid                                                     |
| `FORBIDDEN`      | 403  | `authorize` returned `false` (also when an override throws `ForbiddenError`)        |
| `NOT_FOUND`      | 404  | The item does not exist, or the `where` condition does not hold (not distinguished) |
| `ALREADY_EXISTS` | 409  | Already created                                                                     |
| `CONFLICT`       | 409  | `ifUnchanged` mismatch, or the retry limit was reached                              |
| `INTERNAL`       | 500  | Anything else. The message is not returned; it is passed to `onError`               |

Errors thrown by the application inside `context` are passed to Express's error handler with `next(error)` without conversion.

## Tests

Tests start a real Express app on a free port, call it with `fetch`, and go all the way to DynamoDB Local.

```bash
pnpm emulator:start
pnpm test
```

## License

MIT ([`LICENSE`](../../LICENSE))
