# Realtime delivery

[日本語](realtime.ja.md)

## Purpose

Deliver DynamoDB Item changes to subscribed frontends.

Conceptually, there are three kinds of changes:

- `ADDED`: newly included in the subscription
- `MODIFIED`: an Item included in the subscription changed
- `REMOVED`: left the subscription

`REMOVED` does not only mean the Item was deleted. It also covers an update that makes the Item no longer match the subscription's conditions (including a soft-delete mutation).

## Subscription definitions

A subscription is defined as **subscribing to a named query in realtime**. The range of the subscription and the membership check come from the named query's declaration ([Named queries](../../zod-dynamodb-node/docs/queries.md)). Subscriptions that do not correspond to an index cannot be defined, because starting a subscription requires taking a Snapshot ([Realtime sync](../../zod-dynamodb-client/docs/live-sync.md)) with a Query, which is impossible without an index.

A subscription is exposed by putting `live` on a query in the registry ([Registry](shared-definitions.md)). The subscription name is "group name.operation name" (`tasks.byStatus`).

```ts
export const endpoints = defineEndpoints({
  tasks: [
    // Fields included in events and Snapshots ([Selecting fields to read](../../zod-dynamodb-node/docs/queries.md), "Delivery transport"). Use live: true to not narrow them
    {
      op: taskOps.byStatus,
      path: "/tasks/by-status",
      live: { fields: { omit: ["description"] } },
    },
  ],
});
```

Even when narrowed with `fields`, key fields, the discriminator of a discriminated union, and the key fields of the query's index are always included. The client uses the index key fields to sort the list and to decide the progressive window ([Initial sync procedure](../../zod-dynamodb-client/docs/live-sync.md)).

The required properties are:

- The subscription parameters are validated with Zod (the named query's `params`)
- The frontend can specify what to subscribe to in a type-safe way
- The backend can derive the delivery destinations (topics; "Topics and deciding destinations") from an Item
- Membership is checked on the Items before and after an update, so entering and leaving the subscription can be detected

The library builds the delivery destinations from the query definition. The application never writes destination strings or functions that compute destinations from Items.

Conditions other than keys (FilterExpression) are not allowed in named queries ([Named queries](../../zod-dynamodb-node/docs/queries.md)), so subscriptions do not have them either.

Subscriptions with `limit` (top N, etc.) are not supported. Being pushed out of the top by changes to other Items cannot be decided just by comparing one Item before and after an update.

## Topics and deciding destinations

Change events are delivered per MQTT **topic**. A topic is built from:

```text
topic = {prefix}/{entity}/{index name}/{hash}
hash  = base64url(SHA-256(Partition Key value + values of the equality part of the Sort Key))
```

- Queries on the base table keys use the reserved name `_primary` instead of an index name. The values are physical key strings encoded as in [Key encoding](physical-layout.md), and the hash is computed with WebCrypto (the same function works in the browser)
- The index name is used rather than the query name, so multiple queries on the same index share topics. The Gateway knows which subscription a change belongs to, and `matches` is decided per subscription, so correctness is unchanged
- The length and characters are fixed, so the transport's constraints (256 bytes and at most 7 `/` on AWS IoT Core) need no attention. Hash collisions practically never happen, and even if they did, the Gateway decides by entity and `matches`, so nothing is misdelivered
- Example: subscribing to `byStatus` in [Named queries](../../zod-dynamodb-node/docs/queries.md) (the Partition Key is `workspaceId` and `status`, with a range condition on the Sort Key `priority`) with `{ workspaceId: "ws1", status: "todo", minPriority: 3 }` gives `Task#ws1#todo` and `Task` (no equality part) as the hash input
- The subscriber's topic is computed with `topicForSubscriber(subscription, params, ctx)` (`subscription` is the `subscription` of a registry entry), and an Item's topics with `topicsForItem(table, index, item)`. Property tests check that the two match
- In named queries, the Partition Key is always an equality condition. The first k fields of the Sort Key are also specified by equality ([Named queries](../../zod-dynamodb-node/docs/queries.md)). The values of the equality part are determined uniquely from both the subscription parameters and the Item's fields, so the two cannot disagree
- **Range conditions (the last, range part of the Sort Key) are not put into the topic,** because each subscriber has a different range. The Gateway ([Realtime Gateway](../../zod-dynamodb-realtime/docs/gateway.md)) decides range conditions per subscription with `matches`. In the example above, the Gateway does not forward changes to Items with `priority` below 3 to that subscriber
- For each named query exposed as a subscription, the writing side computes, from both Before and After, a topic for each length of the equality part (from 0 up to the number of Sort Key fields), and publishes to them. Sort Keys usually have few fields, so the number of publications is limited
- If too many changes arrive on one topic for a range subscription, the application adds a partitioning field such as the month to the equality part of the Sort Key, to make topics finer
- MQTT wildcard subscriptions are not relied on; topics are matched exactly

**The message sent over the transport** is the change (`ChangeRecord`) narrowed for the topic.

- Topics are shared per index, so the writing side publishes once per index per change (to the union of the Before and After topics, without duplicates)
- Before and After are narrowed to the union of the `fields` of the subscriptions that use that index, plus the key fields and the index key fields. If any of them uses all fields, they are not narrowed
- The Gateway decides `matches(Before)` / `matches(After)` per subscription, determines `ADDED` / `MODIFIED` / `REMOVED` ("Deciding by Before / After"), narrows to that subscription's `fields`, and then sends it to the client
- The start and end of a batch write ("Batch writes and events") are published, for indexes whose Partition Key is determined by the range (`scope`), to the topics up to the number of leading Sort Key fields that the range contains

**Authorization**

- The frontend does not connect to the transport directly ([Frontend connection path](../../zod-dynamodb-realtime/docs/gateway.md)). Topics are internal server names, not an authorization boundary
- Authorization is done when a subscription starts, by running the subscribed query's `authorize` (including overrides) on the parameters ([Authentication and authorization](shared-definitions.md)). It is the same check as the HTTP query
- Per-Item read authorization is not supported, the same as for named queries. If you need it, remove all fields with `fields` to get notifications without the body, and have the client fetch the body with an HTTP Get that authorizes per Item
- If permission is lost while connected, delivery is stopped by the Gateway's per-operation checks, `revalidate`, and rebuilding before expiry ([Realtime Gateway](../../zod-dynamodb-realtime/docs/gateway.md))

## Delivery transport

Delivery is separated behind the `RealtimeTransport` interface (`publish` and `subscribe`). The provided implementations are:

- **MQTT** (`mqttTransport` of `@zodapp/zod-dynamodb-mqtt`): Mosquitto or aedes locally, AWS IoT Core on AWS. Standard publish/subscribe, and easy to set up for local development
- **In-process** (`memoryTransport`): for tests and development in a single process. Publications reach subscribers on the same instance

The writing side publishes with a `ChangeListener` made by `createChangePublisher({ transport, endpoints })` (`mqttPublisher({ url, endpoints })` for MQTT).

AppSync Events has no local emulator and is a heavy burden for development, so it is not provided.

The transport only carries changes. This library is responsible for Snapshots, authorization, resync, and managing Item versions.

### Message size

Each transport has a different maximum message size (e.g. 128 KB on AWS IoT Core). DynamoDB Items can be larger.

The fields included in events can be narrowed in the subscription definition (e.g. leave out a large `payload` field). Whether the body is included is not switched by whether the size limit is exceeded, because branches where the shape changes per Item multiply the test conditions and tend to cause bugs.

- By default, the body (all fields) is included
- Each subscription can specify fields to leave out (`fields` in [Selecting fields to read](../../zod-dynamodb-node/docs/queries.md)). Removing all fields gives notifications without the body (for example when per-Item read authorization is needed; "Topics and deciding destinations"). Key fields are always included ([Selecting fields to read](../../zod-dynamodb-node/docs/queries.md))
- Events still over the limit after narrowing are recorded as delivery failures. The client recovers by resyncing ([Reconnection and resync](../../zod-dynamodb-client/docs/live-sync.md))

## Messages between the Gateway and the client

All messages are JSON, and Item, key, and parameter values are converted with the transport in [Value conversion](protocol.md). `id` is a subscription number assigned by the client, which distinguishes multiple subscriptions over one connection. The format lives in `realtime-protocol` of `zod-dynamodb`, together with Zod schemas.

```ts
// Client → Gateway
{ type: "subscribe", id: 1, name: "tasks.byStatus", params: { workspaceId: "ws1", status: "todo" } }
{ type: "page", id: 1, cursor?: "…", limit: 100 }
{ type: "unsubscribe", id: 1 }
{ type: "auth", payload: { token: "…" } } // Replaces the authentication information ([Realtime Gateway](../../zod-dynamodb-realtime/docs/gateway.md)). The app decides the shape of payload

// Gateway → Client
{ type: "ready", id: 1 }
{ type: "page", id: 1, items: [{ item, version }], cursor?: "…" }
{ type: "change", id: 1, change: "ADDED" | "MODIFIED" | "REMOVED", key, item?, version, origin }
{ type: "batch", id: 1, marker: { type: "BATCH_STARTED" | "BATCH_FINISHED", origin, count?, status? } }
{ type: "error", id?: 1, code, message }
```

- `REMOVED` omits `item` and sends only `key` and `version`
- If `error` has an `id`, that subscription has ended (`FORBIDDEN` for an `authorize` failure, `INVALID_CURSOR` for a bad page token, etc.). Without `id`, it is an error for the whole connection. After a connection-wide `UNAUTHENTICATED`, the Gateway closes the connection (code 4401)
- `auth` gets no success response. Only failures are reported, with the error above
- The kind of `change` is what the Gateway decided with `matches(Before)` / `matches(After)` (entering and leaving by range conditions). Entering and leaving the progressive window is decided by the client

## Basic approach

**Change events are generated from writes through the backend Repository (the wrapper approach).**

The exact Before and After obtained by the approach in [Writes](../../zod-dynamodb-node/docs/writes.md) are published to topics ("Topics and deciding destinations"). Membership is checked per subscription by the Gateway ([Realtime Gateway](../../zod-dynamodb-realtime/docs/gateway.md)) that receives them from the transport.

```text
UpdateItem (diff, where, ReturnValues: ALL_OLD)
       │
       ▼
Before (ALL_OLD)
       │
       ▼
After = apply the change to Before in JS
       │
       ▼
Compute topics from Before / After and publish (MQTT)
       │
       ▼
Gateway: matches(Before) / matches(After) per subscription
       │
       ▼
Send ADDED / MODIFIED / REMOVED to the client
```

Membership is checked with `matches`, obtained from the named query's declaration ([Named queries](../../zod-dynamodb-node/docs/queries.md)).

## Deciding by Before / After

| Before | After | Event         |
| ------ | ----- | ------------- |
| Out    | In    | ADDED         |
| In     | In    | MODIFIED      |
| In     | Out   | REMOVED       |
| Out    | Out   | Not delivered |

This decision is kept separate from the physical Create/Update/Delete of the Item.

The decision is made per subscription. For example, when `status` changes from `todo` to `done`, the change is published both to the `…/todo` topic computed from Before and to the `…/done` topic computed from After. `todo` subscribers receive `REMOVED`, and `done` subscribers receive `ADDED`. When only a range condition changes (such as a change to `priority`), `ADDED` / `MODIFIED` / `REMOVED` are decided on the same topic according to each subscription's range.

## Writes to DynamoDB and delivery are not atomic

Writing to DynamoDB and publishing to the transport do not form one atomic transaction.

```text
DynamoDB write succeeded
        │
        ▼
Event publish failed
```

This gap is handled within [Reconnection and resync](../../zod-dynamodb-client/docs/live-sync.md) (recovery by version and resync). Publish failures are passed to `onPublishError` (`console.error` by default) and are not retried. Messages over the size limit (`maxMessageBytes`, 128 KB by default) are not published and are passed the same way.

## Limits of the wrapper approach, and DynamoDB Streams

With the wrapper approach, writes that do not go through the library (migrations, admin scripts, operations from the console, etc.) produce no events.

If that is a problem, an alternative is to generate events from DynamoDB Streams. Streams provide the Items before and after the change, so in that case assembling the After in [Writes](../../zod-dynamodb-node/docs/writes.md) is not needed for event generation. The write approach (diff updates and `where` conditions) does not change.

The wrapper approach and the Streams approach are mutually exclusive. The Streams approach is not built; event publication is kept separate as the `ChangeListener` interface.

## Batch writes and events

Batch writes ([Vector search](../../zod-dynamodb-node/docs/vector-search.md)) are also subject to realtime change events.

- Each batch write gets an ID, and start and end events are delivered
- The change events of individual Items also include that ID
- Start and end events are delivered to the topics ("Topics and deciding destinations") determined by the range of the write (the range of `HASH`, etc.). So a batch write declares its range when it starts
- The end event includes the number of Items written, and whether it succeeded or was aborted

This lets clients choose between:

- Applying individual events as usual
- Waiting without applying individual events from start to end, and taking a new Snapshot when the end event arrives (no need to process a large number of events one by one)

Every change event, not only batch writes, carries the ID of its write origin.

```ts
{
  type: "ADDED" | "MODIFIED" | "REMOVED",
  key, item, version,
  origin: { kind: "single" | "transaction" | "batch", id: string },
}
```

`kind: "batch"` refers to a batch write ([Vector search](../../zod-dynamodb-node/docs/vector-search.md)). Writes through the runner's `createBatch` ([Writes](../../zod-dynamodb-node/docs/writes.md)) are `"transaction"`. Events from the same transaction also share an ID, which can be used for auditing or for handling related changes together.

Batch writes do not read the Items before the update ([Vector search](../../zod-dynamodb-node/docs/vector-search.md)). So they assume new Items are written (`ADDED`). To overwrite existing Items, use the normal write path ([Writes](../../zod-dynamodb-node/docs/writes.md)).
