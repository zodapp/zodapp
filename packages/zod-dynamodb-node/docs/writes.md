# Writes

[日本語](writes.ja.md)

## Updates

### Approach

As a rule, an update **writes only the changed fields with `UpdateItem`, and receives the Item before the update with `ReturnValues: ALL_OLD`**. It does not read the Item first and then write the whole thing.

```text
UpdateItem
  Update:    SET / REMOVE (the changed fields, and the physical keys of indexes to re-key)
             ADD _version 1
  Condition: attribute_exists(PK) AND (the mutation's where)
  Return:    ALL_OLD                  → Before
After = the same change applied to Before in JS
```

- **Before** is the whole Item before the update, returned by `ALL_OLD`. It comes from the same request as the write, so there is no room for another update between reading and writing
- **After** is made by applying the same change (SET / REMOVE / ADD) to Before in JS. It matches the result written to DynamoDB
- Change events ([Generating change events](../../zod-dynamodb/docs/realtime.md)) are made from this Before and After
- Other fields are not rewritten, so requests that update different fields at the same time do not affect each other

DynamoDB consumes write capacity on the larger of the Item sizes before and after the update, even with `UpdateItem`. Writing a diff does not reduce capacity, but does not increase it either.

### Partial updates

The input of a partial update is each variant of the item made `Partial` at the type level.

```ts
type PatchOf<T> = T extends unknown
  ? { [K in keyof T]?: T[K] | undefined }
  : never;

// For tasks:
//   { workspaceId?, taskId?, kind?, title?, status?, createdAt?, updatedAt? }
// | { workspaceId?, taskId?, kind?, title?, dueDate?, createdAt?, updatedAt? }
```

This is a type helper only; no partial schema is derived.

- Changes are made per top-level field. Fields with a value become `SET`, and fields whose value is `undefined` become `REMOVE`. The return value of `onWrite` is added to the change the same way
- **Validation is per field.** Each changed field is validated with that field's schema, taken from the item schema. When the field schema differs per variant, the same rule as `INCLUDE` in [Physical layout](../../zod-dynamodb/docs/physical-layout.md) applies: if the discriminator field is in the change, the schema of that variant is used; if not, the value passes if it satisfies the schema of any variant
- Validation across fields, such as a `superRefine` on the whole object, is not done on update. This differs from creation (where the whole value is validated with `item`)
- The key is given by the argument value. If the partial update contains a key field with a value different from the argument's key, it is an error (keys cannot change)
- Trying to change an `immutable` field ([Example definition](../../zod-dynamodb/docs/table-definition.md)) is also an error

Deep merges that change only part of a nested object (Firestore's `merge: true`) are not done. Changing a field holding a nested object replaces the whole object. To change only part of it, read it and pass the whole object.

### Re-keying index physical keys

If a changed field is used in an index key (including `HASH` / `INLINE_FILTER` of vector slots), that index's physical keys are re-`SET` in the same `UpdateItem`. If the change makes an index key field `undefined`, the physical keys are `REMOVE`d and the Item leaves the index (sparse index in [Physical layout](../../zod-dynamodb/docs/physical-layout.md)).

Building the physical keys needs the values of all fields that make up that index's key.

- The fields in the change and the base table key fields are known on the spot
- `immutable` fields keep the value read earlier, so they may be read first and used without a `version` condition
- If other fields are involved, the Item is read first with strong consistency and written with a matching `_version` as the condition. If it does not match, it is read again and retried. Updates with no missing values still take one `UpdateItem`, as before
- For vectors whose slot or filters are chosen by runtime settings ([Vector search](vector-search.md)), which fields are used is decided at runtime, so updates to such Items are always read first in the same way

### The no-read path and the read path

Updates take one of two paths, depending on whether what will be written is known in advance. The library decides the path from the table definition and the changed fields.

- **No-read path**: when what is written is determined only by the change, the base table keys, and `immutable` fields. As described above, it writes with one `UpdateItem` and `ALL_OLD`
- **Read path**: otherwise. It reads first with strong consistency, decides what to write from Before, and writes with a matching `_version` as the condition. If it does not match, it reads again and retries

The read path is taken when:

- Only part of an index key changes, and the values of the remaining fields are needed (above)
- The discriminator field changes and switches the variant. Fields only in the previous variant, and physical keys of indexes the new variant does not go into, are `REMOVE`d. If the change does not include a field required by the new variant, it is an error

On either path, Before and After are exact, and `where` conditions work as they are.

Search entities built from values ([Physical layout](../../zod-dynamodb/docs/physical-layout.md)) are not kept up to date by the library automatically. If they need to be rewritten together with the original Item, the application writes them in a runner transaction (below).

### Named mutations

Functions that build a partial update from parameters are declared with names.

```ts
// shared/tasks.ts (shared definition)
export const taskOps = createOps(tasks, (o) => ({
  setStatus: o.mutation({
    params: z.object({ status: z.enum(["todo", "doing", "done"]) }),
    authorize: (ctx, { key }) => ctx.workspaces.includes(key.workspaceId),
    patch: (p) => ({ status: p.status }),
  }),
  rename: o.mutation({
    params: z.object({ title: z.string() }),
    authorize: (ctx, { key }) => ctx.workspaces.includes(key.workspaceId),
    patch: (p) => ({ title: p.title }),
    // only the assignee can change it
    where: (_p, ctx) => ({ assignee: ctx.userId }),
  }),
  bumpPriority: o.mutation({
    params: z.object({ delta: z.int() }),
    authorize: (ctx, { key }) => ctx.workspaces.includes(key.workspaceId),
    add: (p) => ({ priority: p.delta }),
    where: (p) => ({ priority: { between: [0, 9 - p.delta] } }),
  }),
}));
```

`patch` and `where` can be overridden on the server when you do not want to expose them to the browser, or when they use server-only modules ([Shared definitions and server-only overrides](../../zod-dynamodb/docs/shared-definitions.md)). The override's `patch` / `where` may be asynchronous.

The library validates and writes the mutation's return value (a partial update), the same as for partial updates.

As a rule, updates exposed to clients are named mutations ([Server API](server-api.md)). `params` can also be used as the edit form's schema. Which fields may be updated is determined by the fields the mutation writes.

### Atomic increments

Besides `patch`, a named mutation can return increments to numeric fields (`add`). They are converted to `ADD` in `UpdateItem` and incremented atomically without reading.

- The After value is the Before value plus the increment
- Only fields not used in any index key (including vector slot attributes) can be targets, because index keys need their values fixed before writing. `add` is a function that returns values, so the target fields are not known until it is called; this constraint is checked when the mutation runs
- The value after incrementing cannot be validated with the field schema in advance. If the range must be kept, put a condition on the value before incrementing with `where`

### `where` conditions

Named mutations and deletes can have a write condition (`where`). The condition is converted to a `ConditionExpression`, which DynamoDB evaluates in the same request as the write.

- Compared values are converted with the field's codec ([Value conversion](../../zod-dynamodb/docs/physical-layout.md)). Conditions on index key fields are also evaluated against the stored attribute values
- The available operators are equality and comparison (`eq` / `ne` / `gt` / `gte` / `lt` / `lte`), `between`, `in`, `exists` / `notExists`, `beginsWith`, `contains`, and `size`. All are within `ConditionExpression`; arithmetic between fields and regular expressions are not available
- If the condition does not hold, nothing is written and it is an error. `ReturnValuesOnConditionCheckFailure: ALL_OLD` distinguishes whether the Item does not exist or the condition does not hold

Authorization that depends on the previous state ("only the assignee can change it", "completed ones cannot be changed", etc.) is expressed with this `where` ([Authentication and authorization](../../zod-dynamodb/docs/shared-definitions.md)). The check and the write happen in one request, so the state cannot change between the check and the write.

`where` is a function that receives the parameters and the authentication context (a delete's `where` gets an empty object as parameters, written `where: (_p, ctx) => ...`). Write static conditions as functions that do not use their arguments.

The Repository distinguishes an Item that does not exist (`ItemNotFoundError`) from a condition that does not hold (`ConditionFailedError`). Over HTTP, they are returned as the same error without distinction, so as not to reveal the existence of Items to unauthorized clients. The error message mentions both possibilities: "the Item does not exist or does not satisfy the condition" ([Errors](../../zod-dynamodb/docs/protocol.md)).

### `version`

`version` is stored as the library-managed attribute `_version`, and is not included in read results ([Roles of each schema and type](../../zod-dynamodb/docs/table-definition.md)). Every update increments it by 1 with `ADD _version 1`. Realtime sync uses this value to decide which events are newer ([Item Version](../../zod-dynamodb-client/docs/live-sync.md)).

By default, updates have no `_version` condition. With diff updates, simultaneous updates to different fields do not conflict. Simultaneous updates to the same field are last-write-wins. On the read path (above), the library adds a `_version` condition internally.

### Detecting updates by others while editing (`ifUnchanged`)

When the library reads and writes right away, changes in between are not broken by diff updates. A `_version` condition only matters when comparing against the point at which the client read the data. So instead of exposing `version`, an opaque token is used.

```ts
const { item, token } = await repository.tasks.get(key, { withToken: true });
// …edit in a form…
await repository.tasks.mutate(taskOps.rename, key, params, {
  ifUnchanged: token,
});
```

- The token contains `version` and is signed with HMAC, like cursors ([Pagination](queries.md))
- Writes with `ifUnchanged` are conditioned on a matching `_version`. If it does not match, a dedicated error is returned, so the screen can show "someone else updated this"
- A setting that makes the token required can be placed at several levels, with the finer level taking precedence. With `"required"`, writes without a token are errors

```ts
tableConfig({ ..., ifUnchanged: "required" })   // table default. "optional" if not specified
o.mutation({ ..., ifUnchanged: "required" })   // per mutation
```

### Whole replacement (`set`)

`set(key, input)`, which replaces the whole Item with a new value, is provided both inside runners and on the normal accessors. The normal accessor's `set` is implemented as a runner with a single Item (it reads with strong consistency and `Put`s with a matching `_version` as the condition).

Whether to expose `set` to clients is up to the application, like any other operation ([Server API](server-api.md)). The library does not restrict which operations are exposed.

### Caution: incrementing fields in nested objects

Updating a field inside a nested object, such as `ADD` or `SET a.b = a.b + :n`, requires the parent object to exist in the Item. If it does not, DynamoDB rejects the write.

- We recommend keeping counters to increment as top-level fields. A top-level field is incremented from 0 by `ADD` even if it does not exist
- If you put one in a nested position, create the parent object on creation

### Transactions

DynamoDB has no interactive transactions that combine reads and writes. Also, `TransactWriteItems` does not return `ALL_OLD`.

Accessors are bound to a unit of execution (a runner) with `withContext({ runner })`, and the following two kinds are handled with the same accessor shape. Both buffer the writes and commit them atomically at the end as one `TransactWriteItems`.

```ts
// Reads and writes (equivalent to a Firestore transaction)
await repository.runTransaction(async (tx) => {
  const parent = await repository.parents
    .withContext({ runner: tx })
    .get(parentKey);
  await repository.versions
    .withContext({ runner: tx })
    .create(versionKey, input);
  await repository.parents
    .withContext({ runner: tx })
    .update(parentKey, { latest: versionId });
});

// Writes only (equivalent to a Firestore batch)
const batch = repository.createBatch();
await repository.rows.withContext({ runner: batch }).set(rowKey, row);
await repository.rowIndexes.withContext({ runner: batch }).delete(oldIndexKey);
await batch.commit();
```

The operations available on accessors bound to a runner, and their conversion to `TransactWriteItems`:

| Operation                        | Conversion                                              | Before          |
| -------------------------------- | ------------------------------------------------------- | --------------- |
| `create(key, input)`             | Put (`attribute_not_exists`)                            | None (`null`)   |
| `set(key, input)`                | Put (replace). The whole value is validated with `item` | Read beforehand |
| `update(key, patch)` / mutations | Update (the diff update in "Writes")                    | Read beforehand |
| `delete(key)`                    | Delete                                                  | Read beforehand |
| `check(key, where)`              | ConditionCheck. Does not write                          | Not read        |
| `get(key)` (transaction only)    | Items not written become ConditionCheck (`_version`)    | What was read   |

- **Before / After**: the library reads the targets of `set` / `update` / `delete` beforehand with strong consistency, and conditions them on that `_version`. The Before of the change event is this read result, and the After is the change applied to it in JS (for `set`, exactly what is written). `create` is conditioned on the Item not existing, so its Before is `null`
- **Reads in a transaction**: every Item `get` inside `runTransaction` is recorded. Written Items get a `_version` condition, and Items that were only read become `ConditionCheck` (matching `_version`). If any condition fails, `fn` is rerun from the start. This gives the same meaning as a Firestore transaction: "if what you read has changed, start over". Reads come before writes
- **batch**: the user does not read, but the library reads internally beforehand, so it can conflict with other updates. In that case the library reads again and retries. A Firestore batch does not fail on conflicts, so the behavior the user sees is the same
- **Conditional updates**: inside a runner, `update` / mutations / `delete` can also have `where` ("Writes"). It goes into each operation's `ConditionExpression`, together with the `_version` condition. When you do not need to decide from the values read and the state alone is enough, expressing it with `where` instead of reading takes fewer round trips and retries
- **`check`**: puts only a condition on an Item that is not written. It becomes a `ConditionCheck` without reading the Item, so preconditions such as "a setting matches" can be checked atomically without a read round trip
- **Failure**: if a `where` / `check` condition does not hold, it is an error without retrying. Only failures from `_version` mismatches are retried, with the retry limit as an option. Which condition failed is distinguished from `CancellationReasons`

DynamoDB's constraints impose these limits:

- One commit can handle up to 100 Items, including Items only read (`ConditionCheck`) and `check`, and 4 MB in total
- The same Item cannot be operated on twice in one commit. The library detects operations on the same key and errors
- If a query is used inside a transaction, changes to the returned Items can be detected with `ConditionCheck`, but newly added Items that match the condition (phantoms) cannot
- The write origin of change events ([Batch writes and events](../../zod-dynamodb/docs/realtime.md)) is `kind: "transaction"` for both runners, with a shared ID per commit

### Creation and deletion

- Creation: the library merges `{ ...create input, ...onCreate(...), ...onWrite(...), ...key }` and validates the whole value with `item`. It adds the physical keys, writes conditionally with `attribute_not_exists` (PutItem), and sets `_version = 1`. The After is exactly what was written
- Deletion: `DeleteItem` gets the `where` condition, and Before is obtained with `ReturnValues: ALL_OLD`. Before is used to generate the `REMOVED` event
- `delete` always deletes physically. There are no deletion hooks (delete notifications, or replacing with a soft delete)

### Caution: soft deletes, and recording who deleted

Soft deletes are not a library feature; write them as ordinary named mutations (writing `deletedAt` / `deletedBy`, etc.).

- To exclude soft-deleted Items from named queries, have that mutation keep them out of the index, for example by clearing a field used in the index key (sparse index. [Physical layout](../../zod-dynamodb/docs/physical-layout.md)). They no longer match the subscription's conditions, so realtime delivery sends `REMOVED` ([Purpose](../../zod-dynamodb/docs/realtime.md))
- If they must be physically removed, remove them after the soft delete with TTL or similar
- Callers that delete choose between `delete` and the soft-delete mutation per entity

In Firestore, `onNotifyDelete` wrote a marker and the updater just before deletion, so that onSnapshot and triggers could tell "this is a deletion" and "who deleted it". In this library, the library generates change events ([Generating change events](../../zod-dynamodb/docs/realtime.md)), a missing After shows a deletion, and the write origin can be carried in the event, so it is not needed. With DynamoDB Streams, deletions also arrive as `REMOVE`. To keep a permanent record of who deleted, combine `delete` and the `create` of an audit Item into one commit with a runner ("Writes").
