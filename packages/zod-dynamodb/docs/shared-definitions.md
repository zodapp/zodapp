# Shared definitions, the registry, and authorization

[日本語](shared-definitions.ja.md)

## Shared definitions and server-only overrides

Table definitions and named operations are written as **one definition shared by the browser and the server**. Authorization (`authorize`), write conditions (`where`), and partial updates (`patch`) also go into the shared definitions as a rule. Only rules you do not want to expose to the browser, and logic that uses server-only modules, are **overridden** (`override()`) on the server.

```ts
// shared/context.ts (once per app)
export type Auth = { userId: string; workspaces: string[] };
export const { createOps, override, defineEndpoints } = defineContext<Auth>();

// shared/tasks.ts (shared; also runs in the browser)
export const taskOps = createOps(tasks, (o) => ({
  get: o.get({
    authorize: (ctx, { key }) => ctx.workspaces.includes(key.workspaceId),
  }),
  setStatus: o.mutation({
    params: z.object({ status: z.enum(["todo", "doing", "done"]) }),
    authorize: (ctx, { key }) => ctx.workspaces.includes(key.workspaceId),
    patch: (p) => ({ status: p.status }),
    where: (_p, ctx) => ({ assignee: ctx.userId }), // only the assignee can change it
  }),
  purge: o.delete(), // operations without authorize are server-only
}));

// server/overrides.ts (server only)
export const overrides = [
  override(taskOps.setStatus, {
    // Adds a server-only check to the shared check (shared). Synchronous functions only (put the data you need into the authentication context)
    authorize: (ctx, req, shared) =>
      shared(ctx, req) && !ctx.frozenWorkspaces.includes(req.key.workspaceId),
  }),
];
```

Sharing is the rule for these reasons:

- The browser can run the same check synchronously before sending (`can`. [Browser API](../../zod-dynamodb-client/docs/client-api.md)). Whether a button is enabled never disagrees with the server's decision
- The same function (`api.tasks.setStatus(key, params)`) can be called in both the browser and the server. You can write business logic that runs in both once (`SharedApi`. [Browser API](../../zod-dynamodb-client/docs/client-api.md))
- The definitions live in one place, and can be read without going back and forth between a contract and an implementation

| Definition                       | Shared definitions                                                                                                                                            | Server only                                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Table definition (`tableConfig`) | Physical layout, entity name, `item` / `create`, keys, indexes, `immutable`, hooks (`onCreate` / `onWrite`), `generateKey`, static assignment of vector slots | Runtime vector settings (`vectors` and `resolveVectorConfig` of `createRepository`. [Vector search](../../zod-dynamodb-node/docs/vector-search.md)) |
| Operations (`createOps`)         | Name, `params`, `authorize`, query conditions, mutation `patch` / `add` / `where`, delete `where`, search `partition` / `filters`                             | Overrides (`override()`): `authorize` (synchronous only), mutation and delete `patch` / `where`, search `queryVector` (required)                    |
| Registry (`defineEndpoints`)     | Groups, paths, HTTP methods, realtime (`live`), subscription `fields`                                                                                         | None                                                                                                                                                |

- An override function receives the shared function (`shared`) as its last argument. Calling it adds to the shared check; not calling it replaces it. Overrides are passed to `createRepository({ overrides })`. Passing two overrides for the same operation is an error
- Operations without `authorize` are **server-only**. They cannot have a path in the registry, and do not appear in the browser API. A query can have realtime (`live`), and the writing side publishes it, but the Realtime Gateway does not expose it (server code subscribes to it with `subscribeOnServer`. [Realtime Gateway](../../zod-dynamodb-realtime/docs/gateway.md))
- Hooks and `generateKey` are written in the table definition, but only the server (Repository) calls them. They live in a shared module, so do not make them depend on server-only modules. If you need such a dependency, make that logic a named mutation and write it as an override
- Tests check that shared modules do not depend on Node.js-only modules. Common utilities (ID format checks, `buildFilters`, etc.) may be included. The library's browser packages (`zod-dynamodb`, `zod-dynamodb-client`, `zod-dynamodb-react`) are checked by ESLint's `no-restricted-imports` and tests (`browser-safe.spec.ts`) not to import Node.js built-in modules (`node:*`), server packages, or `@aws-sdk/*`
- The [Repository](../../zod-dynamodb-node/docs/repository.md) is built from the table definitions and the overrides

**What `authorize` can see (the scope of authorization for Get and writes)**

- `authorize` of `get`, `create`, `set`, and `createWithGeneratedKey` can only see the key, the input (the values sent), and the authentication context, not the stored Item
- For writes that should be decided by stored values, use `where` on mutations and deletes. `where` is a DynamoDB conditional write (`ConditionExpression`), so it is only available on mutations and deletes. DynamoDB has no way to put a condition on a read (`get`)
- To protect reads, put the owner or workspace in the key so that `authorize` can decide by the key, or make the list a query and decide by its parameters
- Example: if you expose `set` on a table whose key is only `noteId`, someone can overwrite another person's note by rewriting `ownerId` in the input. Do not expose `set`; use a mutation's `where: (_p, ctx) => ({ ownerId: ctx.userId })` to write only when the stored owner is yourself

## The registry

The application writes the operations it exposes as a **registry** (`defineEndpoints`) in a shared module. The registry lists operations (made with `createOps`) in groups, with a path, an HTTP method, and realtime (`live`). The browser API ([Browser API](../../zod-dynamodb-client/docs/client-api.md)), the [server API](../../zod-dynamodb-node/docs/server-api.md) and the [router](../../zod-dynamodb-express/README.md), and the [Gateway](../../zod-dynamodb-realtime/docs/gateway.md) are all built from this registry.

```ts
// shared/endpoints.ts (shared; written by the application)
import { defineEndpoints } from "./context"; // returned by defineContext<Auth>() ("Shared definitions and server-only overrides")

export const endpoints = defineEndpoints({
  tasks: [
    { op: taskOps.get, path: "/tasks/get" },
    {
      op: taskOps.getByPath,
      path: "/tasks/:workspaceId/:taskId",
      method: "GET",
    },
    { op: taskOps.create, path: "/tasks/create" },
    { op: taskOps.remove, path: "/tasks/delete" },
    { op: taskOps.setStatus, path: "/tasks/set-status" },
    {
      op: taskOps.byStatus,
      path: "/tasks/by-status",
      live: { fields: { omit: ["description"] } },
    },
    { op: taskOps.purge }, // server-only (no authorize). Appears only in the server API
  ],
  rows: [{ op: rowOps.similar, path: "/rows/similar" }],
});
```

- The kinds of operations are Get, Create (including creating with a generated key), Set (whole replacement. [Writes](../../zod-dynamodb-node/docs/writes.md)), Delete, Mutation (named mutation), Query (named query), and Search (named search. [Vector search](../../zod-dynamodb-node/docs/vector-search.md)). The application decides which to expose
- Function names are the operation names given in `createOps` (`api.tasks.setStatus`). Overlapping names in the same group, or registering the same operation in two groups, is an error at creation time
- The application decides paths and HTTP methods. The library does not define a path structure. The default HTTP method is `POST`, with the input in the body. Operations without `path` are not exposed over HTTP (used only for realtime, or only on the server)
- If you choose `GET` and the path contains parameters, the client fills the path with the fields of the same name in the input. How the server reads them is in the [zod-dynamodb-express README](../../zod-dynamodb-express/README.md)
- `live` can only be put on queries. It is `live: true`, or an object specifying the subscription's `fields` ([Subscription definitions](realtime.md))
- Operations without `authorize` (server-only; "Shared definitions and server-only overrides") cannot have `path`. They can have `live`, but the Realtime Gateway does not expose them
- Only read operations (Get, Query, Search) can have `GET`
- Overlapping `method` and `path` pairs are an error at creation time. Express parameters (`:name`) are compared as the same regardless of name (`/a/:id` and `/a/:key` overlap). Paths exposed individually with `handle()` ([zod-dynamodb-express](../../zod-dynamodb-express/README.md)) are outside the registry, so they are not compared
- All operations in the registry must be made with `createOps` of the same `defineContext`. We recommend the `defineEndpoints` returned by `defineContext`. It checks in the types that the Auth type is the same, and at runtime accepts only operations of that `defineContext`. The `defineEndpoints` taken directly from `@zodapp/zod-dynamodb` checks only at runtime that all operations were made from the same `defineContext`. Overrides (`override()`) are the same: overriding an operation of another `defineContext`, or passing to `createRepository` overrides of a `defineContext` different from the registry's, is an error
- These checks are `DefinitionError`s at creation time. A `path` on a server-only operation, `live` on anything other than a query, `GET` on a write, and operations with another Auth are also type errors (shown on the property in question). Overlapping names and overlapping `method + path` are checked only at runtime
- The input and output schemas of each operation are determined by the operation definition. The application does not need to rewrite schemas
- There is no generic endpoint that exposes a whole table definition. Write each exposed operation one by one
- Group names cannot be the reserved names used by the browser API and the server API (`context`, `endpoints`, `bind`, `execute`, etc.)
- `buildPath(path, inputJson)` is provided to help fill path parameters. It looks for a field of the same name directly in the input, then in `key`, then in `params`

## Authentication and authorization

The application does authentication, and the library checks authorization per operation. Being logged in does not mean you may read Items of another workspace.

Only operations with `authorize` are exposed to the browser. Operations without `authorize` are server-only, and giving them a path in the registry is an error at creation time (they can have `live`, but the Realtime Gateway does not expose them). There is no design where missing authorization means unconditional access. For operations that allow everything, write `authorize: () => true` explicitly.

Both the shared `authorize` and the server-only override's `authorize` are synchronous and return a `boolean` (because the browser uses them in `can`, and the Realtime Gateway calls them for every change it delivers). An override returning a `Promise` is a `DefinitionError`. Read the data needed for authorization when building the authentication context ([Server API](../../zod-dynamodb-node/docs/server-api.md)). `false` returns `FORBIDDEN` ([Errors](protocol.md)). Throwing `ForbiddenError` inside an override does the same. The reason for rejection is not returned to the client. If you want to keep the reason, the application logs it inside `authorize`.

The `request` of `authorize(ctx, request)` depends on the kind of operation:

| Operation      | `request`                                                                   |
| -------------- | --------------------------------------------------------------------------- |
| Get            | `{ key }`                                                                   |
| Create         | `{ key, input }` (`{ args, input }` for generated keys)                     |
| Set            | `{ key, input }`                                                            |
| Named mutation | `{ key, params }`                                                           |
| Delete         | `{ key }`                                                                   |
| Named query    | `{ params }`                                                                |
| Named search   | `{ params }`                                                                |
| Subscription   | The subscribed query's `{ params }` (the query's `authorize` is used as is) |

Queries are authorized on their parameters, because thinning out Items after fetching would break pagination and limits.

Authorization functions decide without reading the Item. Authorization that depends on the previous state (only the assignee can change it, finalized ones cannot be changed, etc.) is written as a `where` condition on mutations and deletes ([Writes](../../zod-dynamodb-node/docs/writes.md)). The condition is evaluated in the same request as the write, so the state cannot change between the check and the write. Authorization that uses a parent's fields is expressed by giving the child that field as `immutable` and using `where` (`immutable` in [Table definitions](table-definition.md)).

Field-level restrictions (which fields may be updated) are expressed by the fields a named mutation writes.
