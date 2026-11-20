# Browser API

[日本語](client-api.ja.md)

## Client

The Client imports the registry as a value and builds the browser API. The function shapes are the same as the server API ([Server API](../../zod-dynamodb-node/docs/server-api.md)).

```ts
import { createClient } from "@zodapp/zod-dynamodb-client";

export const api = createClient(endpoints, {
  baseUrl: "/api",
  credentials: "include",
  realtime: { url: "wss://example.com/api/realtime" }, // when using live()
});

const task = await api.tasks.get({ workspaceId: "ws1", taskId: "t1" });
const { item, token } = await api.tasks.get(key, { withToken: true });
await api.tasks.setStatus(key, { status: "done" }, { ifUnchanged: token });
const { items, cursor } = await api.tasks.byStatus({
  workspaceId: "ws1",
  status: "todo",
  minPriority: 0,
});
for await (const page of api.tasks.byStatus.pages(params)) {
  /* ... */
}
```

- Arguments are positional: `(key, options?)` for Get and delete, `(key, input, options?)` for create and set, `(args, input, options?)` for creating with a generated key, `(key, params, options?)` for mutations, and `(params, options?)` for queries and searches. `options` takes `context`, `signal` (abort), `headers` (headers for this call only), and per-operation options (`withToken`, `ifUnchanged`, `cursor`, `limit`, `fields`)
- Return values: Get returns `Item | null` (`{ item, token? }` with `withToken: true`), create, replace, and mutations return `Item`, delete returns `void` (the browser does not get the Item before deletion), queries return `{ items, cursor? }`, and searches return `{ item, score }[]`
- The Client gets paths, HTTP methods, and input and output schemas from the registry. Values are converted with the transport in [Value conversion](../../zod-dynamodb/docs/protocol.md)
- Input is validated with the schema before sending; on failure it is not sent and becomes `INVALID_INPUT`
- Errors are thrown as `ClientError`. `code` is one of the codes in [Errors](../../zod-dynamodb/docs/protocol.md), plus Client-only codes (`NETWORK`: a communication failure, `UNEXPECTED_RESPONSE`: a response not in the shape of [Errors](../../zod-dynamodb/docs/protocol.md), `INVALID_RESPONSE`: output validation failed, `TOO_MANY_ITEMS`: the list size limit was exceeded). `isClientError(error, "NOT_FOUND")` narrows by `code`. An abort with `AbortSignal` is thrown as an `AbortError` as is
- For `GET` endpoints, path parameters are filled in, and the JSON of the whole input goes into the `input` query string parameter. On the server, the router reads it ([Reading the input](../../zod-dynamodb-express/README.md))
- Query functions have `pages(params)`, which fetches page after page up to the last one, carrying the `cursor` along

**Checking before sending (`can`)**

Each function has `can`, which runs the check of the shared definitions ([Shared definitions and server-only overrides](../../zod-dynamodb/docs/shared-definitions.md)) synchronously, without sending. Use it for things like enabling or disabling buttons.

```ts
api.context.set(auth); // the authentication context in the browser (a global value)
const r = api.tasks.setStatus.can(key, { status: "done" }, { item: task });
// { ok: true } | { ok: false, reason: "INVALID_INPUT" | "FORBIDDEN" | "CONDITION" | "NO_CONTEXT", issues? }
```

- It checks input validation, then `authorize`, then `where` (only when `item` is passed). Without `item`, `where` is not checked
- `can` is a prediction under the shared rules, and does not reflect server overrides ([Shared definitions and server-only overrides](../../zod-dynamodb/docs/shared-definitions.md)). Even when `can` is `ok`, the server may reject with an override's rule (`FORBIDDEN`, etc.). The final decision is the server's; the server API's `can` also decides with the shared definitions only
- The authentication context is taken from an explicit `{ context }`, then a value fixed with `bind(ctx)`, then the global value from `api.context.set()`. If the `context` key is written, even a `null` / `undefined` value is treated as "no authentication context", without falling back to `bind` or the global value (the same rule as the [Server API](../../zod-dynamodb-node/docs/server-api.md)). The global value can only be used in the browser; setting it on an SSR server is an error (it would leak across requests). Use `bind` for SSR
- The authentication context is not sent over HTTP. The server builds it from the request headers ([Server API](../../zod-dynamodb-node/docs/server-api.md))

**Code that runs on both sides (`SharedApi`)**

The browser API and the server API have the same shape, so you can write business logic that runs on both once. Use `SharedApi<typeof endpoints>` for the argument type. It includes only operations callable from the browser (those with `authorize` and `path`), and not `live`.

```ts
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

await finishAll(api, "ws1"); // browser (HTTP)
await finishAll(serverApi, "ws1"); // server (inside an authentication context scope)
```

- Pass only the key fields as the key argument. Passing the Item as is fails key validation with extra fields

**List and Item state (stores)**

List state lives in a framework-independent store inside the Client. One-off fetches and realtime subscriptions ([Realtime sync](live-sync.md)) have the same state shape, and you can switch between them just by changing the source.

```ts
const live = api.tasks.byStatus.live(params, { pageSize: 100 }); // realtime (a query with live in the registry)
const once = onceListStore(api.tasks.byStatus, params, { pageSize: 100 }); // an HTTP query
// getState(): { status: "loading" | "ready" | "error", items, hasMore, isFetchingMore, error? }
live.subscribe(() => render(live.getState()));
live.fetchMore();
live.close();

const item = onceItemStore(api.tasks.get, { workspaceId: "ws1", taskId: "t1" }); // { status, item, token?, error? }
```

- With `pageSize`, the list is progressive (it reads that many Items first, and goes back the same number at a time with `fetchMore`); without it, it reads up to the last page (the whole list). The limit for the whole list is `maxSnapshotItems` (10,000 by default), and exceeding it is a `TOO_MANY_ITEMS` error
- The name of a `live` subscription is "group name.operation name" (`tasks.byStatus`)

**React**

React hooks are provided by `@zodapp/zod-dynamodb-react`. The hooks only read stores with `useSyncExternalStore` and hold no state of their own. Hooks that partially apply a function are created outside components.

```tsx
export const useTodos = createUseList(api.tasks.byStatus, { live: true });
export const useTask = createUseItem(api.tasks.get);

<ApiProvider api={api} context={auth}>
  <App />
</ApiProvider>;

// inside a component
const { items, fetchMore } = useTodos(params, { pageSize: 100 });
const { status, item, token } = useTask(key);
const api = useApi(); // the API with the authentication context bound (for can during rendering)
```

- A store is not created during rendering; it is created on subscription and closed when it has no subscribers. It is recreated only when `params` or `options` change by value
- `ApiProvider` passes the API with the authentication context bound to its children. Calling `useApi()` outside `ApiProvider` is an error
