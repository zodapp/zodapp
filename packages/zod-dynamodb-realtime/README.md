# @zodapp/zod-dynamodb-realtime

[日本語](README.ja.md)

The Realtime Gateway. It accepts client subscriptions over WebSocket, subscribes to topics on the transport (MQTT, etc.), and sends clients only the changes that match the range conditions (the specifications are [Realtime Gateway](docs/gateway.md) and [Realtime delivery](../zod-dynamodb/docs/realtime.md)).

The exposed subscriptions are the queries marked `live` in the registry. A subscription's name is "group.operation" (`tasks.byStatus`).

```ts
// shared/endpoints.ts (can also be imported from the browser)
export const endpoints = defineEndpoints({
  tasks: [
    {
      op: taskOps.byStatus,
      path: "/tasks/by-status",
      live: { fields: { omit: ["description"] } },
    },
  ],
});
```

```ts
// server.ts
import type { IncomingMessage } from "node:http";
import { createRealtimeGateway } from "@zodapp/zod-dynamodb-realtime";
import { mqttPublisher, mqttTransport } from "@zodapp/zod-dynamodb-mqtt";

// Writer side: publishes the repository's changes to topics
const publisher = mqttPublisher({ url: process.env.MQTT_URL!, endpoints });
const repository = createRepository({ ..., listener: publisher });
const serverApi = createServerApi(endpoints, {
  repository,
  context: (req: IncomingMessage) => resolveAuth(req.headers), // the same function as for HTTP
});

const realtime = createRealtimeGateway({
  api: serverApi,
  transport: mqttTransport({ url: process.env.MQTT_URL! }),
  maxPageSize: 1_000, // upper limit of items per page (default)
  origin: ["https://app.example.com"], // checks the Origin header of the upgrade (not checked if omitted)
  maxSubscriptionsPerConnection: 100, // upper limit of subscriptions per connection (default)
});

const server = app.listen(3000);
realtime.attach(server, { path: "/api/realtime" });
// or server.on("upgrade", (req, socket, head) => realtime.handleUpgrade(req, socket, head))

// On shutdown
await realtime.close(); // closes connections, stops transport subscriptions, and closes the transport
```

- With `origin`, the Origin header of the upgrade is checked before building the authentication context, and the upgrade is rejected with 403 if it is not allowed. An array means exact match; a function is `(origin, req) => boolean`. Requests without an Origin header (non-browser clients) pass. For apps that authenticate with cookies, set it to prevent Cross-Site WebSocket Hijacking
- A single connection can hold up to `maxSubscriptionsPerConnection` (default 100) subscriptions at once. Subscriptions beyond that are rejected with `INVALID_INPUT`
- The authentication context is built from the upgrade request with the server API's `credential` and `context`. If they throw, the upgrade is rejected with 401. Express authentication middleware does not run on upgrades, so make it a function that builds the context from headers (Cookie or Authorization)
- Before starting a subscription, delivering a page, and delivering a change, it checks the server API's `expiresAt` (the expiry of the authentication context), `checkContext`, and `authorize` synchronously, every time. On an authentication failure, it sends `UNAUTHENTICATED` and closes the connection (code 4401; the client reconnects). On an authorization rejection, it stops only that subscription with `FORBIDDEN`

### Replacing credentials, and rebuilding

```ts
const realtime = createRealtimeGateway({
  api: serverApi,
  transport,
  // Turns the payload of an auth message into credentials (the same type as serverApi's credential)
  credentialOf: (payload) =>
    z.object({ token: z.string() }).parse(payload).token,
});

// When removing a member, etc.: rebuild the authentication context only for that user's connections
await realtime.revalidate((ctx: Auth) => ctx.email === email);
```

- In the browser, call `client.realtime.authenticate({ token })` after refreshing the token. The authentication context is replaced while the connection stays open
- Without `credentialOf`, `auth` messages are not accepted. With methods where the browser cannot send a value, such as cookies or certificates, the client reconnects when the context expires
- `revalidate` rebuilds from the last credentials received. Connections that cannot be rebuilt are closed, and subscriptions that no longer pass authorization are stopped with `FORBIDDEN`
- `revalidate` only affects that Gateway's connections. With two or more Gateways, write "whose permissions changed" as application data, and have each instance subscribe to it with `subscribeOnServer` (`@zodapp/zod-dynamodb`) and call `revalidate` (for example, the revocations in `apps/taskmanager`)
- Server-only queries in the registry (without `authorize`) are not exposed even with `live`

### Rebuilding before expiry

```ts
const serverApi = createServerApi(endpoints, {
  repository,
  credential: (req) => tokenOf(req),
  context: async (token) => loadAuth(token), // read the data needed for authorization, such as roles, here
  // Expiry of the authentication context. Keep it within the expiry of the credentials
  expiresAt: (ctx: Auth) =>
    Math.min(ctx.tokenExpiresAt, ctx.builtAt + 5 * 60_000),
});

const realtime = createRealtimeGateway({
  api: serverApi,
  transport,
  rebuildAt: 0.8, // at what fraction of the lifetime to rebuild (default)
  maxConcurrentRebuilds: 10, // upper limit of concurrent rebuilds (default)
});
```

- An authentication context that returns `expiresAt` is rebuilt from the last credentials received at the `rebuildAt` point of its lifetime. Changes such as roles are reflected by this point at the latest, even without calling `revalidate`
- If it cannot be rebuilt (the authentication was revoked, etc.), the connection is closed. If rebuilding from the same credentials does not extend the expiry, it stops rebuilding, and the connection is closed on the next operation once it expires
- Changes that arrive during a rebuild are delivered with the previous authentication context, which has not expired yet
- Rebuilds and `revalidate` are limited to `maxConcurrentRebuilds` at a time
- Subscriptions are authorized with the query's `authorize` (including overrides). This is the same check as for HTTP queries. If rejected, `FORBIDDEN` is returned to that subscription and it ends
- The Gateway has only two building blocks: "subscriptions" and "pages". Whether it is progressive or whole, and how far has been read, is managed by the client (`@zodapp/zod-dynamodb-client`)
- The same topic is subscribed on the transport only once across connections, with reference counting
- A liveness ping is sent every 30 seconds, and connections that do not respond are dropped (`pingInterval`)
- The message format is in [Realtime delivery](../zod-dynamodb/docs/realtime.md)

For tests and single-process development, the writer side and the Gateway can share `memoryTransport()` from `@zodapp/zod-dynamodb`.

## License

MIT ([`LICENSE`](../../LICENSE))
