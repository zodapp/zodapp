# Realtime sync

[日本語](live-sync.ja.md)

## Snapshots and subscriptions

Realtime sync needs both a Snapshot, which gets the current state, and a subscription, which receives subsequent changes.

Simply doing the following in order can miss changes:

```text
1. Take a Snapshot
2. Start a subscription
```

Changes that happen after the Snapshot is taken but before the subscription starts are not received.

Conversely, starting the subscription first does not by itself guarantee an accurate initial state.

## Initial sync procedure

The standard procedure is:

```text
1. Start the subscription, and remember arriving events per key as "the latest version and value (a Tombstone for deletions)"
2. Wait until the subscription is ready (ready: the transport accepted the subscription)
3. Fetch the Snapshot page by page (including each Item's version)
4. Compare the Items in each page with the remembered values by version, and keep the newer one
5. From then on, keep applying events
```

The client does this procedure. The server (Gateway) only provides the building blocks for subscriptions and pages ([Realtime Gateway](../../zod-dynamodb-realtime/docs/gateway.md)).

**Whole and progressive**

|                     | Whole subscription                                                                     | Progressive (with `pageSize`)                                                    |
| ------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Next page           | Requested automatically until there is no `cursor`. An error beyond `maxSnapshotItems` | Requested only on `fetchMore`                                                    |
| What the list shows | Everything that matches the condition                                                  | Only what is inside the window (up to the boundary of the last page read)        |
| Reconnection        | Starts over from step 1 (Tombstones are kept)                                          | Starts over from step 1, and re-reads up to the number of Items that were loaded |

- The list is ordered by the named query's Sort Key and direction (Items with the same Sort Key are in base table key order)
- The window is decided by a Sort Key boundary rather than a count, so the problem of being pushed out of the "top N" ([Subscription definitions](../../zod-dynamodb/docs/realtime.md)) does not occur. When new Items arrive, the list simply grows
- Changes outside the window are remembered for only 60 seconds and then dropped. GSIs are eventually consistent, so a page read back right after a change can be stale, and this lets `version` correct it
- While re-reading, the previous list stays displayed
- For batch writes ([Batch writes and events](../../zod-dynamodb/docs/realtime.md)), individual events are applied by default. With `onBatch: "reload"`, those events are not applied from start to end, and the list is re-read at the end

To make this procedure work, the following conditions apply:

- Snapshots include each Item's `version`. With an `ALL` slot, `_version` is obtained from the GSI. With `KEYS_ONLY` / `INCLUDE` slots, it is obtained when the body is read with strong consistency via BatchGetItem ([Named queries](../../zod-dynamodb-node/docs/queries.md)). So `INCLUDE` does not need to contain `_version`
- Deletions and exclusions from the subscription (`REMOVED`) also carry a `version`
- The client keeps an Item for which it received `REMOVED` in memory as a Tombstone with its `version`. It is kept for as long as the subscription lasts (for progressive lists, those inside the window; those outside for 60 seconds), and dropped when the subscription ends. A re-taken Snapshot can also be stale, so Tombstones are not dropped when the Snapshot is taken again. A Tombstone is only a key and a `version`, so the memory impact is small

Without Tombstones, a Snapshot fetched late because of GSI eventual consistency would bring back Items that have already been deleted.

Reads from a GSI are always eventually consistent and cannot be strongly consistent. The procedure above absorbs this delay by comparing `version`s.

With this procedure, **as long as no events are lost**, the client's state converges to the server's state.

## Item Version

A per-Item version is introduced.

```ts
{
  workspaceId: "ws1",
  taskId: "task1",
  version: 12,
  ...
}
```

`version` starts at 1 on creation and is incremented by 1 with `ADD` in `UpdateItem` on every update ([Writes](../../zod-dynamodb-node/docs/writes.md)). Change events also include the version.

`version` is metadata of the sync protocol, carried separately from the Item body in Snapshots and change events. It is not included in Repository read results ([Roles of each schema and type](../../zod-dynamodb/docs/table-definition.md)) or in data the client passes to the application. The example above shows the concept; it does not mean the Item body has a `version` field.

This lets the frontend tell:

- Duplicate events
- Events already applied
- Stale events
- Obvious gaps in versions

However, per-Item versions cannot detect lost events themselves. That would need per-topic sequence numbers.

## Reconnection and resync

The basic recovery method is **taking the Snapshot again on reconnection**, and the guarantees are stated as follows:

- While connected, the state converges as long as no events are lost
- If the connection drops, it recovers by re-taking the Snapshot after reconnecting
- Detection of events lost while connected (dropped by the transport, publish failures) is not guaranteed. Recover with periodic Snapshot re-takes if needed

Replay of change history and loss detection with per-topic sequence numbers are not done.

The client keeps only one connection. When it drops, the client reconnects with growing intervals (by default starting at 0.5 seconds and doubling, up to 30 seconds) and starts every subscription over from step 1. When there are no subscriptions left, it closes the connection.
