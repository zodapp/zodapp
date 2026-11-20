# Realtime Gateway

[日本語](gateway.ja.md)

## Frontend connection path

For data access, the standard path is the backend API behind a WAF.

Realtime communication also goes through the WAF and the backend Gateway. The frontend does not connect to the transport directly.

**A. Through the backend (standard)**

```text
Frontend
   │
   ▼
WAF
   │
   ▼
Realtime Gateway
   │
   ▼
Transport (MQTT)
```

**B. Connecting to the transport directly (not supported)**

```text
Frontend ── WAF ── Backend API
    │
    └──────── Transport (MQTT)
```

With WebSocket, the WAF mainly inspects the request that establishes the connection, but being able to block unauthenticated connections or connections from particular users at the entrance is well worth it. It also matches the design goal of concentrating public entry points at the WAF.

B is technically possible, but it splits the public entry points, so it is not supported.

## How the Gateway is provided

Realtime connections are also provided integrated into the Express application. However, they are not an Express middleware; instead, **a framework-independent Gateway is the core, with a helper that attaches it to a Node.js `http.Server`**.

```ts
import { createRealtimeGateway } from "@zodapp/zod-dynamodb-realtime";
import { mqttTransport } from "@zodapp/zod-dynamodb-mqtt";

const realtime = createRealtimeGateway({
  api: serverApi, // createServerApi(endpoints, { repository, context }). [Server API](../../zod-dynamodb-node/docs/server-api.md)
  transport: mqttTransport({ url: process.env.MQTT_URL }),
  maxPageSize: 1_000, // the maximum number of Items per page (default)
  origin: ["https://app.example.com"], // checks the Origin header of the upgrade. Not checked if omitted
  maxSubscriptionsPerConnection: 100, // the maximum number of subscriptions per connection (default)
});

const server = app.listen(3000);
realtime.attach(server, { path: "/api/realtime" });
```

- **Connection granularity**: there is one WebSocket endpoint, and multiple subscriptions are started and stopped over one connection. Subscribing to several lists on a screen does not add connections
- **Exposure and authorization**: the only subscriptions exposed are queries with `live` in the registry. Authorization uses the query's `authorize` (including overrides), giving the same decision as HTTP
- **Core**: the core of the Gateway is a framework-independent component with `handleUpgrade(req, socket, head)`. `attach` is a thin helper on top of it, so with frameworks other than Express (Fastify, plain Node.js, etc.) the application can wire it to the `upgrade` event itself
- **Why not a middleware**: a WebSocket connection starts with an HTTP upgrade and arrives at the `upgrade` event of `http.Server`. It does not go through Express routes or the middleware chain, so existing authentication middleware does not run either. Also, the Gateway holds state (the list of connections, the connection to the transport, the subscribed topics) and must start and stop together with the server
- **Authentication**: authentication middleware does not run on the upgrade request, so the Gateway builds the authentication context from the upgrade request with the server API's `context` ([Server API](../../zod-dynamodb-node/docs/server-api.md)). If it is a function that builds it from the request headers (Cookie or Authorization), it can be shared with HTTP. Subscriptions and page reads run inside the scope of that authentication context
- **Snapshots**: the Gateway has only two building blocks, "subscribe" and "page" ([Initial sync procedure](../../zod-dynamodb-client/docs/live-sync.md)). A page reads one page of the subscribed named query with the subscription's parameters and authentication context, and returns it with `version`s. The Gateway does not know whether the list is progressive or whole, or how far it has been read, and holds no buffer. The load on the server is bounded by the page size (`maxPageSize`)
- **Origin check**: when `origin` (an array of origins, or `(origin, req) => boolean`) is given, the Origin header is checked at the very start of the upgrade, before building the authentication context, and the upgrade is rejected with 403 if not allowed. Arrays are compared by exact match (a trailing `/` or a difference in case is not allowed). Requests without an Origin header pass (the function is not called either), because only browsers send Origin, and Cross-Site WebSocket Hijacking only happens in browsers. Not checked if omitted. Specify it for apps that authenticate with cookies
- **Authentication failure**: if `context` or `checkContext` throws at upgrade time, the upgrade is rejected with 401
- **Checks on every operation**: before starting a subscription, reading a page, and delivering a change, the expiry (`expiresAt`), `checkContext`, and the subscribed query's `authorize` are checked synchronously every time. On an authentication failure (`UNAUTHENTICATED`), an `error` without `id` is sent and the connection is closed (code 4401). The client reconnects and passes new credentials in the upgrade request. On an authorization rejection (`FORBIDDEN`), only that subscription stops, and the connection and other subscriptions continue. There is no intermediate state such as queuing messages while authentication has lapsed
- **Replacing credentials**: with short-lived tokens (5 minutes, etc.), reconnecting at every expiry is too much. So before expiry, the client can send new credentials with an `auth` message ([Messages between the Gateway and the client](../../zod-dynamodb/docs/realtime.md)) and replace the authentication context while keeping the connection. The Gateway's `credentialOf(payload)` turns `payload` into a credential, `context` rebuilds the context, and all open subscriptions are authorized again. If the context cannot be built, the connection is closed; subscriptions that are no longer authorized, and subscriptions whose range is decided by the authentication context and has changed, are stopped with `FORBIDDEN`. Without `credentialOf`, `auth` messages are not accepted (with methods where the browser cannot send the value, such as cookies or certificates, the client reconnects at expiry)
- **Rebuilding (`revalidate`)**: in urgent cases such as removing a member or suspending an account, `realtime.revalidate(filter?)` rebuilds the authentication context of the connections matching `filter` (all of them if omitted) from the last credential received. After that, it is handled the same as an `auth` message
- **Subscribing on the server (`subscribeOnServer`)**: server code subscribes to a query with `live` on the delivery topics (`@zodapp/zod-dynamodb`; does not depend on Node). Only changes within the query's range are passed, as `ADDED` / `MODIFIED` / `REMOVED`; the first page is not read, and there is no authorization. It is used to deliver `revalidate` to Gateways on several machines
- **Rebuilding before expiry**: an authentication context that returns `expiresAt` is rebuilt from the last credential received at `rebuildAt` of its lifetime (0.8 by default). Role changes and the like are reflected by then at the latest, even without calling `revalidate`. If it cannot be built, the connection is closed. If rebuilding from the same credential does not extend the expiry (the credential itself has expired), it is not rebuilt again. Changes that arrive while rebuilding are delivered with the previous authentication context, which has not expired yet. Rebuilds and `revalidate` are limited to `maxConcurrentRebuilds` (10 by default) at a time
- **Liveness check**: a WebSocket ping is sent every `pingInterval` (30 seconds by default), and connections that did not answer the previous ping are dropped. 0 sends none
- **Limit on subscriptions**: one connection can hold up to `maxSubscriptionsPerConnection` (100 by default) subscriptions at a time (including those still being authorized). A `subscribe` beyond that gets `INVALID_INPUT` (`too many subscriptions on this connection`) with its `id`. Unsubscribing lowers the count
- **Topic references**: the same topic is subscribed on the transport only once across connections, with a reference count. Unsubscribing and disconnecting lower it, and the subscription stops when it reaches 0
- **Delivery**: the Gateway subscribes on the transport to the topics of active subscriptions ([Topics and deciding destinations](../../zod-dynamodb/docs/realtime.md)), decides each arriving message per subscription, and forwards it to the matching connections
- Publishing on the writing side (the Repository's ChangeListener. [Generating change events](../../zod-dynamodb/docs/realtime.md)) is provided by the transport package (`zod-dynamodb-mqtt`). The topics to publish are decided from the queries with `live` in the registry (`mqttPublisher({ url, endpoints })`)
