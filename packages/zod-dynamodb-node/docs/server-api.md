# Server API and the authentication context

[日本語](server-api.ja.md)

## Usage

```ts
import type { IncomingMessage } from "node:http";
import express from "express";
import { createRepository, createServerApi } from "@zodapp/zod-dynamodb-node";
import { router } from "@zodapp/zod-dynamodb-express";
import { endpoints } from "../shared/endpoints";

const repository = createRepository({ tables: { tasks }, overrides, dynamodb });

// The server API. Pass how to get the authentication context here, once
export const serverApi = createServerApi(endpoints, {
  repository,
  context: (req: IncomingMessage) => resolveAuth(req.headers), // builds the authentication context from the request
});

const app = express();
app.use(express.json());
app.use("/api", router(serverApi, { onError: (e) => logger.error(e) }));
```

- `router()` returns an Express `Router` that registers the registry operations that have a `path`, with their HTTP method and path. Server-only operations and operations without `path` are not registered
- Each request is processed in this order: build the authentication context with `context(req)`, validate the input, run `authorize` (including overrides. [Shared definitions and server-only overrides](../../zod-dynamodb/docs/shared-definitions.md)), call the Repository
- The type of the authentication context is determined by `defineContext<Auth>()` ([Shared definitions and server-only overrides](../../zod-dynamodb/docs/shared-definitions.md)), and is shared by `authorize`, `where`, `patch`, and overrides
- Passing `onError` lets you receive errors that were turned into `INTERNAL` (500) (for logging). By default they are logged
- We recommend writing `context` as a function that builds the authentication context from the request headers (Cookie or Authorization), because realtime connections can use the same function ([Realtime Gateway](../../zod-dynamodb-realtime/docs/gateway.md)). We recommend returning a value that represents an anonymous user for unauthenticated requests instead of throwing. An `UnauthenticatedError` thrown in `context` becomes 401 (`UNAUTHENTICATED`), and other errors are passed to Express's `next(error)`

**Credentials, and checking the authentication context**

The authentication context can be built in two steps: take the "credential" from the request, then build the context from it. This lets a realtime connection replace the credential while staying connected, or have the server rebuild it ([Realtime Gateway](../../zod-dynamodb-realtime/docs/gateway.md)).

```ts
export const serverApi = createServerApi(endpoints, {
  repository,
  // Takes the credential from the request. The app decides its type (a token string, a session ID, certificate information, etc.)
  credential: (req: IncomingMessage) => bearerTokenOf(req),
  // Builds the authentication context from the credential. UnauthenticatedError if it is invalid
  context: async (token: string | undefined) =>
    token ? await verify(token) : anonymous,
  // When the authentication context expires (a time in milliseconds). Checked before every operation's authorization; the Gateway rebuilds before expiry
  expiresAt: (ctx: Auth) => ctx.expiresAt,
  // Checks other than expiry (account suspension, etc.). Optional
  checkContext: (ctx: Auth) => {
    if (ctx.suspended) throw new UnauthenticatedError("suspended");
  },
});
```

Authentication has three stages.

| Stage                            | How it is made                                                                                                                              | Expiry                                                       | Replacing / rebuilding                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Credential                       | Obtained synchronously or asynchronously from what the user sent (`credential(req)`, the Gateway's `credentialOf`)                          | Yes (long)                                                   | Replaced with the Gateway's `auth` message. Only methods where the browser cannot send the value (HttpOnly cookies) reconnect |
| Authentication context (context) | Built synchronously or asynchronously from the credential (`context(credential)`). Data needed for authorization (roles, etc.) is read here | Yes (`expiresAt`). Built so as not to outlive the credential | The Gateway rebuilds it from the credential before expiry. `revalidate` also rebuilds it                                      |
| Authorization (authorize)        | Checks `expiresAt` and `checkContext`, and the operation's `authorize`                                                                      | —                                                            | Called synchronously for every operation. Does not read the database                                                          |

- To revoke authorization only, rebuild the authentication context with `revalidate` ([Realtime Gateway](../../zod-dynamodb-realtime/docs/gateway.md)). To revoke authentication (sign a user out, suspend an account), make the app's `context(credential)` fail. JWTs are only verified by signature, so checking revocation state (the session store, a revocation list) is the app's responsibility
- Keeping the authentication context short-lived (say 5 minutes) limits how stale permissions can get, even if `revalidate` is forgotten
- `revalidate` only affects that Gateway's connections. When the Gateway runs on several machines, the library has no dedicated mechanism to distribute revocations. The app writes "whose permissions changed" as ordinary data (a server-only query with `live`), and each machine subscribes with `subscribeOnServer` and calls `revalidate`

- If `credential` is omitted, the request itself is passed to `context` (the `context: (req) => ctx` style)
- The library does not look inside the credential. For methods that do not use a string token (HttpOnly cookies, client certificates), use a type that suits that method
- `expiresAt` and `checkContext` are checked before every operation's authorization, both over HTTP and in the Gateway. If expired, or if `checkContext` throws `UnauthenticatedError`, the result is `UNAUTHENTICATED`. Neither reads the database; they decide only from the values in the authentication context. `can` only decides, so it does not check them

**The server API**

The server API has functions of the same shape as the browser API ([Browser API](../../zod-dynamodb-client/docs/client-api.md)), and also includes server-only operations. It calls the Repository in the same process, without going through HTTP.

```ts
await serverApi.tasks.setStatus(key, { status: "done" }, { context: auth });
await serverApi.tasks.purge(key); // a server-only operation (no authorize, so no context needed)

// Sets up an authentication context scope for the request. Inside it, context can be omitted
app.use(serverApi.scope());
app.post("/api/tasks/finish-all", async (req, res) => {
  await finishAll(serverApi, req.body.workspaceId); // code that runs on both sides ([Browser API](../../zod-dynamodb-client/docs/client-api.md))
  res.json({});
});
```

- The authentication context is taken from an explicit `{ context }`, then from the scope (`serverApi.scope()` or `runWithContext(ctx, fn)`; AsyncLocalStorage). If none is found for an operation with `authorize`, it is a `MissingContextError`
- If the `context` key is written (`"context" in options`), even a `null` / `undefined` value does not fall back to the scope and is treated as "no authentication context". This prevents running with the permissions of the user of the current request when a lookup failed (`bobAuth` in `{ context: bobAuth }` is `undefined`). To let users who are not logged in through, the app passes a value that represents them (such as an authentication context without roles)
- On the server, delete returns the Item before deletion
- Inside the router and the Gateway, a scope is set up per request, so code called from there can also omit `context`
- `serverApi.contextOf(req)` returns the first result for the same request (object). Even if you use both `app.use(serverApi.scope())` and the router, `credential` and `context` are called only once per request. Expiry (`expiresAt` and `checkContext`) is checked for every operation, so expiry is not missed even with the remembered value
- A server API without `context` is for use only inside the server (pass values with an explicit `context` or `runWithContext`). Building `router()`, `handle()`, or `createRealtimeGateway()` from it while exposing operations with `authorize` is a `DefinitionError` at creation time (so a missing setting is not carried over to the first request)
- The server API also has `endpoints`, `contextOf(req)`, `credentialFromRequest(req)`, `contextFromCredential(credential)`, `checkContext(ctx)`, `expiresAt(ctx)`, `scope()`, `execute(entry, request)`, `authorize(entry, request)`, and `repository`. These names cannot be used as group names
