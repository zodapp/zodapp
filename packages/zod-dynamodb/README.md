# @zodapp/zod-dynamodb

[日本語](README.ja.md)

Shared definitions for working with DynamoDB in a type-safe way, starting from table definitions written in Zod. Usable in both the browser and the server (the specifications are in [docs/](docs/)).

- `physicalTable()`: the physical layout of a single table (GSI and vector index slots)
- `tableConfig()`: a table definition that keeps the item / create schemas as they are. Key and index fields are checked by type and at definition time. Hooks (`onCreate` / `onWrite`) and `generateKey` are also written here
- Key encoding: produces unique, reversible, order-preserving physical keys by prefixing non-string values with `$` and a type identifier. Decoding does not use the schema
- `defineContext<Auth>()`: declares the type of the authentication context once, and returns `createOps`, `override`, and `defineEndpoints`
- `createOps(table, (o) => ({ ... }))`: named operations (`o.get`, `o.create`, `o.createWithGeneratedKey`, `o.set`, `o.delete`, `o.mutation`, `o.query`, `o.search`). `authorize`, `where`, and `patch` are also written in the shared definitions
- `defineEndpoints({ ... })`: the registry of exposed operations, with groups, paths, HTTP methods, and realtime (`live`). When you use what `defineContext` returns, the types also check that no operations from another `defineContext` are mixed in. A `path` on a server-only operation, `live` on anything other than a query, and `GET` on a write are type errors, and overlapping `method + path` is an error at creation time
- `Api` / `ServerApi` / `SharedApi`: the types of the APIs determined by the registry, for the browser, the server, and both
- `classifyChange()`: decides `ADDED` / `MODIFIED` / `REMOVED` from the membership check of a named query
- `subscribeOnServer()`: lets server code subscribe to a query with `live` through the transport (`RealtimeTransport`). Server-only queries (without `authorize`) can also have `live`; the publisher publishes them, but the Realtime Gateway does not expose them to browsers

```ts
// shared/context.ts
export type Auth = { userId: string; workspaces: string[] };
export const { createOps, override, defineEndpoints } = defineContext<Auth>();

// shared/tasks.ts (shared by the browser and the server)
export const tasks = tableConfig({
  table: appTable,
  entity: "Task",
  item: taskKeyFields.and(taskBody).and(timestamps),
  create: taskBody,
  key: { partition: ["workspaceId"], sort: ["taskId"] },
  indexes: {
    byStatus: {
      slot: "GSI1",
      partition: ["workspaceId", "status"],
      sort: ["priority", "updatedAt", "taskId"],
    },
  },
  onCreate: ({ now }) => ({ createdAt: now, updatedAt: now }),
  onWrite: ({ now }) => ({ updatedAt: now }),
});

const inWorkspace = (ctx: Auth, workspaceId: string) =>
  ctx.workspaces.includes(workspaceId);

export const taskOps = createOps(tasks, (o) => ({
  get: o.get({
    authorize: (ctx, { key }) => inWorkspace(ctx, key.workspaceId),
  }),
  setStatus: o.mutation({
    params: z.object({ status: z.enum(["todo", "doing", "done"]) }),
    authorize: (ctx, { key }) => inWorkspace(ctx, key.workspaceId),
    patch: (p) => ({ status: p.status }),
    where: (_p, ctx) => ({ assignee: ctx.userId }), // only the assignee can change it
  }),
  byStatus: o.query({
    index: "byStatus",
    params: z.object({
      workspaceId: z.string(),
      status: z.enum(["todo", "doing", "done"]),
    }),
    authorize: (ctx, { params }) => inWorkspace(ctx, params.workspaceId),
    where: (p) => ({
      partition: { workspaceId: p.workspaceId, status: p.status },
    }),
  }),
  purge: o.delete(), // operations without authorize are server-only
}));

// shared/endpoints.ts
export const endpoints = defineEndpoints({
  tasks: [
    { op: taskOps.get, path: "/tasks/get" },
    { op: taskOps.setStatus, path: "/tasks/set-status" },
    { op: taskOps.byStatus, path: "/tasks/by-status", live: true },
    { op: taskOps.purge },
  ],
});
```

Only rules you do not want to expose to the browser, and logic that uses server-only modules, are overridden on the server ([Shared definitions and server-only overrides](docs/shared-definitions.md)).

```ts
// Server only. Pass to createRepository({ overrides })
export const overrides = [
  override(taskOps.setStatus, {
    authorize: (ctx, req, shared) =>
      shared(ctx, req) && !ctx.frozenWorkspaces.includes(req.key.workspaceId),
  }),
];
```

- `authorize` in the shared definitions is synchronous and returns a `boolean` (because it is also used by `can` in the browser). The override's `authorize` is synchronous only as well (returning a `Promise` is a `DefinitionError`), and it receives the shared check (`shared`) as the last argument. Read the data needed for authorization when building the authentication context
- The schemas of `item`, `create`, and operation `params` are limited to ones whose output passes when run through them again. `transform`, `pipe`, and `preprocess` are errors at definition time (`default` and `coerce` can be used). The library validates once before authorization, and uses that value for both authorization and the write ([Table definitions](docs/table-definition.md))
- `authorize` of `get`, `create`, and `set` can only see the key, the input, and the authentication context, not the stored item. For writes that should be decided by stored values, use `where` on mutations and deletes (DynamoDB conditional writes). `get` cannot take conditions, so for reads, put the owner or workspace in the key and decide with `authorize`, or make it a query and decide by its parameters
  - Example: if you expose `set` on a table whose key is only `noteId`, someone can overwrite another person's note by rewriting `ownerId` in the input. Do not expose `set`; prevent this with a mutation's `where: (_p, ctx) => ({ ownerId: ctx.userId })`
- Do not make shared modules depend on Node.js-only modules (this package itself checks this with ESLint's `no-restricted-imports` and tests)

## Subscribing on the server (`subscribeOnServer`)

Use this when server code wants to receive changes, including writes from other instances (to invalidate caches, rebuild the authentication context of connections, etc.).

```ts
// shared: queries without authorize are server-only. With live they are published, but not exposed to browsers
const revocationOps = createOps(revocations, (o) => ({
  recent: o.query({
    params: z.object({}),
    where: () => ({ partition: { scope: "all" } }),
  }),
}));
export const endpoints = defineEndpoints({
  revocations: [{ op: revocationOps.recent, live: true }],
});

// server
const sub = await subscribeOnServer({
  endpoints,
  transport: mqttTransport({ url }), // a connection separate from the Gateway is recommended
  prefix: "app", // match the writer side
  op: revocationOps.recent,
  params: {},
  onChange: ({ type, item }) => {
    /* ADDED / MODIFIED / REMOVED */
  },
});
await sub.close();
```

- It resolves once the transport has accepted the subscription (MQTT SUBACK)
- It does not read the first page; it only delivers changes made after the subscription starts. If you need the current state, read it with the repository
- It only delivers changes within the query's range (`matches`). `item` is the item after the change for ADDED / MODIFIED, and before the change for REMOVED, narrowed to the `fields` of `live`. Markers of bulk writes are not delivered
- No authorization is performed
- A transport can only have one handler per topic, so subscribing to the same topic twice on the same transport throws. Use a connection separate from the Realtime Gateway
