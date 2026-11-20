# @zodapp/zod-dynamodb-node

[日本語](README.ja.md)

Builds a repository that operates on DynamoDB, and the server API, from the table definitions of `@zodapp/zod-dynamodb` (the specifications are in [docs/](docs/), in Japanese).

```ts
const repository = createRepository({
  tables: { tasks },
  overrides, // the list of override() (server-only overrides)
  dynamodb: new DynamoDBClient({}),
  cursorSecret: process.env.CURSOR_SECRET,
  listener: { onChanges: (changes) => publish(changes) },
});

await repository.tasks.create({ workspaceId: "ws1", taskId: "t1" }, input);
await repository.tasks.mutate(
  taskOps.setStatus,
  { workspaceId: "ws1", taskId: "t1" },
  { status: "done" },
  { context: auth },
);
const { items, cursor } = await repository.tasks.query(taskOps.byStatus, {
  workspaceId: "ws1",
  status: "done",
});

// Run through validation and authorization (authorize and overrides)
await repository.execute(
  taskOps.setStatus,
  { key, params: { status: "done" } },
  { context: auth },
);
```

- Updates use `UpdateItem` diffs with `ALL_OLD`, and change events are built from the exact Before / After
- Only when values needed to re-key an index's physical keys are missing does it read beforehand with strong consistency and update on the condition that `_version` matches. If it does not match, it reads again and retries
- `runTransaction()` / `createBatch()` accumulate writes and commit them with a single `TransactWriteItems`. Transactions and bulk writes (`bulkWrite`) are not put in the registry; they are used as repository features
- Updates that switch variants also read beforehand, and remove the fields and index physical keys that only the previous variant had
- If you pass the token from `get(key, { withToken: true })` to `ifUnchanged`, the update is rejected with `StaleItemError` when another update has happened since the read
- Pagination tokens are signed and bound to the key condition computed from the parameters and the authentication context (`context`). Another user's token cannot be used
- `set()` replaces the whole item. `delete()` is always a physical delete (write logical deletes as regular mutations)
- Runtime vector settings (slots and filter functions) go in `vectors` and `resolveVectorConfig`, and the embedding vector for search goes in the override's `queryVector`

## Server API

```ts
import type { IncomingMessage } from "node:http";

export const serverApi = createServerApi(endpoints, {
  repository,
  context: (req: IncomingMessage) => resolveAuth(req.headers), // called per request by the router and the Gateway
});

await serverApi.tasks.setStatus(key, { status: "done" }, { context: auth });
await serverApi.tasks.purge(key); // server-only operations can be called too

app.use(serverApi.scope()); // sets up an authentication context scope for the duration of the request
await runWithContext(auth, () => finishAll(serverApi, "ws1")); // inside a scope, context can be omitted
```

- The function shapes are the same as the browser API (`@zodapp/zod-dynamodb-client`). Code that runs in both takes `SharedApi<typeof endpoints>` as its argument
- The authentication context is taken from the explicit `{ context }`, then the scope. If none is found for an operation with `authorize`, it is a `MissingContextError`
- On the server, delete returns the item before deletion

## Tests

Tests run against DynamoDB Local.

```bash
pnpm emulator:start   # starts amazon/dynamodb-local on port 8000 with docker
pnpm test
```

DynamoDB Local does not support `SearchVectors`, so the vector search tests replace only that request.

## License

MIT ([`LICENSE`](../../LICENSE))
