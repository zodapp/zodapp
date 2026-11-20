# @zodapp/zod-dynamodb-client

[日本語](README.ja.md)

Builds the browser API from the registry (`defineEndpoints`) of `@zodapp/zod-dynamodb` (the specifications are [Browser API](docs/client-api.md) and [Realtime sync](docs/live-sync.md)). The function shapes are the same as the server API (`createServerApi`). It runs in both the browser and Node.js.

```ts
import { createClient, isClientError } from "@zodapp/zod-dynamodb-client";
import { endpoints } from "./shared/endpoints";

export const api = createClient(endpoints, {
  baseUrl: "/api",
  headers: () => ({ authorization: `Bearer ${getToken()}` }), // optional; may be async
  credentials: "include", // passed to fetch as is
  realtime: { url: "wss://example.com/api/realtime" }, // when using live()
});
```

## HTTP calls

```ts
const task = await api.tasks.get({ workspaceId: "ws1", taskId: "t1" }); // Item | null
const { item, token } = await api.tasks.get(key, { withToken: true });
await api.tasks.setStatus(key, { status: "done" }, { ifUnchanged: token });
const { items, cursor } = await api.tasks.byStatus(
  { workspaceId: "ws1", status: "todo" },
  { limit: 20, signal },
);
for await (const page of api.tasks.byStatus.pages({
  workspaceId: "ws1",
  status: "todo",
})) {
  /* up to the last page */
}
await api.tasks.remove(key); // the browser does not get the item before deletion (void)
```

- Arguments are positional. The last `options` takes `context`, `signal`, `headers` (headers for this call only), and per-operation options (`withToken`, `ifUnchanged`, `cursor`, `limit`, `fields`)
- Input is validated with the schema before sending. On failure, nothing is sent and a `ClientError` with `INVALID_INPUT` is thrown
- For `GET` operations, the JSON of the whole input goes into the `input` query parameter. URLs have a length limit, so use `POST` for long inputs
- Pass only the key fields as the key argument. Passing a whole item fails validation because of the extra fields

**Errors** are `ClientError`s, distinguished by `code`.

```ts
try {
  await api.tasks.setStatus(key, { status: "done" }, { ifUnchanged: token });
} catch (error) {
  if (isClientError(error, "CONFLICT")) {
    /* conflicted with another update */
  }
}
```

| `code`                                                                        | Meaning                                                                                          |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Codes from §7.5 (`INVALID_INPUT`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, etc.) | Server errors                                                                                    |
| `NETWORK`                                                                     | Communication failure                                                                            |
| `UNEXPECTED_RESPONSE`                                                         | A response not in the §7.5 shape (403 / 502 from a WAF or load balancer, etc.). `status` is kept |
| `INVALID_RESPONSE`                                                            | The output does not match the operation's schema (version mismatch, etc.)                        |
| `TOO_MANY_ITEMS`                                                              | Exceeded the item limit while fetching a whole list                                              |

Cancellation through an `AbortSignal` is thrown as an `AbortError`.

## Checking before sending (`can`)

Each function has `can`, which runs the check from the shared definitions synchronously without sending anything.

```ts
api.context.set(auth); // the authentication context in the browser (a global value)
api.tasks.setStatus.can(key, { status: "done" }, { item: task });
// { ok: true } | { ok: false, reason: "INVALID_INPUT" | "FORBIDDEN" | "CONDITION" | "NO_CONTEXT", issues? }

const bound = api.bind(auth); // an API with a fixed authentication context (for SSR or React's ApiProvider)
```

- It checks input validation, `authorize`, and `where` (only when `item` is passed), in that order
- `can` is an estimate based on the shared rules. Server overrides (`override()`) are not reflected, so even with `ok`, the server may reject by an override rule (`FORBIDDEN`, etc.). The final decision is made by the server
- The authentication context is taken from the explicit `{ context }`, the value given to `bind`, then the value of `api.context.set()`, in that order. `api.context.set()` can only be used in the browser (calling it on an SSR server is an error)
- Over HTTP, the authentication context is not sent. The server builds it from the request headers

## Code that runs on both sides

The browser API and the server API have the same shape, so functions that take `SharedApi<typeof endpoints>` work on either side.

```ts
import type { SharedApi } from "@zodapp/zod-dynamodb";

export const finishAll = async (
  api: SharedApi<typeof endpoints>,
  workspaceId: string,
) => {
  for await (const page of api.tasks.all.pages({ workspaceId })) {
    for (const task of page.items) {
      const key = { workspaceId: task.workspaceId, taskId: task.taskId };
      if (api.tasks.setStatus.can(key, { status: "done" }, { item: task }).ok) {
        await api.tasks.setStatus(key, { status: "done" });
      }
    }
  }
};
```

## List and item state (stores)

One-off fetches and realtime subscriptions share the same state shape. You can switch between them just by changing the source.

```ts
const recent = api.tasks.byStatus.live(
  { workspaceId: "ws1", status: "todo" },
  { pageSize: 100 },
);
const off = recent.subscribe(() => render(recent.getState()));
// getState(): { status: "loading" | "ready" | "error", items, hasMore, isFetchingMore, error? }
recent.fetchMore(); // read the next 100 items going back
recent.close();

const once = onceListStore(api.tasks.byStatus, {
  workspaceId: "ws1",
  status: "todo",
}); // an HTTP query
const task = onceItemStore(api.tasks.get, { workspaceId: "ws1", taskId: "t1" }); // { status, item, token? }
```

- With `pageSize`, it is progressive (reads that many items first and goes back with `fetchMore`); without it, it reads up to the last page
- **As a rule, handle large lists progressively.** The item limit for reading a whole list is `maxSnapshotItems` (default 10,000), and exceeding it is a `TOO_MANY_ITEMS` error

## Realtime subscriptions (`live`)

Only queries marked `live` in the registry have `live` (those exposed by the Gateway of `@zodapp/zod-dynamodb-realtime`). A subscription's name is "group.operation".

- The client holds a single connection, and closes it when there are no subscriptions. When disconnected, it reconnects with growing intervals and restarts every subscription from scratch. The previous list stays shown until it is read again
- The list is assembled on the client by matching pages and changes by `version`. Deleted items are remembered as tombstones so that they do not come back from stale pages
- In progressive mode, items are shown up to the boundary of the last page read. When new items arrive, the list simply grows. Changes beyond the boundary are remembered for 60 seconds, to fix pages read later that turn out to be stale
- Bulk writes apply individual changes by default. With `{ onBatch: "reload" }`, it waits until they finish and then reads again
- The browser's `WebSocket` cannot carry headers. Authenticate with cookies, or make `url` a function that includes the token (it is called on every connection)

```ts
realtime: {
  url: async () => `wss://example.com/api/realtime?token=${await getToken()}`,
},
```

## License

MIT ([`LICENSE`](../../LICENSE))
