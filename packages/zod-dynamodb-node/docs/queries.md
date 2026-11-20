# Named queries and reads

[日本語](queries.ja.md)

## Named queries

DynamoDB does not let you search freely on arbitrary fields.

So **all queries are declared with names, and the client can only specify the name and the parameters**. No API for assembling arbitrary conditions is exposed.

```ts
export const taskOps = createOps(tasks, (o) => ({
  byStatus: o.query({
    index: "byStatus",
    params: z.object({
      workspaceId: z.string(),
      status: z.enum(["todo", "doing", "done"]),
      minPriority: z.int(),
    }),
    authorize: (ctx, { params }) => ctx.workspaces.includes(params.workspaceId),
    where: (p) => ({
      partition: { workspaceId: p.workspaceId, status: p.status },
      sort: { priority: { gte: p.minPriority } },
    }),
    direction: "desc",
  }),

  byAssignee: o.query({
    index: "byAssignee",
    params: z.object({
      workspaceId: z.string(),
      assignee: z.string().nullable(),
    }),
    authorize: (ctx, { params }) => ctx.workspaces.includes(params.workspaceId),
    select: "projection", // return only the projection
    where: (p) => ({
      partition: { workspaceId: p.workspaceId, assignee: p.assignee },
    }),
  }),
}));
```

Operations are received through the `createOps` builder (`o.query`, etc.) so that type inference from `params` is closed per operation. The operation name is the key of the returned object. `where` can also receive the authentication context (`where: (p, ctx) => ...`).

### Conditions

Query conditions are **declarative, limited to equality on the Partition Key and conditions on the Sort Key**. They are not functions that return DynamoDB expressions.

- `partition`: gives values for all Partition Key fields of the index
- `sort`: specifies k fields of the index's Sort Key **in order from the first** by equality, and can put a range condition (`gt` / `gte` / `lt` / `lte` / `beginsWith`) on the next one. Skipping leading fields is a compile error
  - Internally, the equality part becomes `begins_with(SK, "<entity>#v1#…#vk#")` and range conditions become `BETWEEN` and the like. The upper bound uses the character after the separator. Both work because of the order-preserving requirement of [Key encoding](../../zod-dynamodb/docs/physical-layout.md)

Being declarative, the same definition gives both:

- Running the Query on DynamoDB
- A membership check in JS, `matches(doc, params)` (used for the ADDED / REMOVED decision of realtime delivery. [Generating change events](../../zod-dynamodb/docs/realtime.md))

The membership check only compares attribute values, so it works even when the item is a union.

### Result types and how results are read

The result type is narrowed to the variants that go into the index, with `undefined` removed from the index fields. For example, the result of `byStatus` contains only the `kind: "todo"` variant.

`select` chooses whether to return the whole Item or only the projection. The default is the whole Item.

| Slot projection | `select: "full"` (default)                         | `select: "projection"`                                |
| --------------- | -------------------------------------------------- | ----------------------------------------------------- |
| `ALL`           | Returns the Query result as is                     | Same as full                                          |
| `KEYS_ONLY`     | Fetches the body with BatchGetItem after the Query | Returns the decoded base table keys and index keys    |
| `INCLUDE`       | Fetches the body with BatchGetItem after the Query | Returns the decoded keys and the projected attributes |

When only the projection is returned, the type is the per-variant `Pick` of the item.

```ts
type ProjectedOf<T, K> = T extends unknown ? Pick<T, K & keyof T> : never;
```

A plain `Pick<A | B, K>` can only take keys common to all variants, so it is applied per variant. This is a TypeScript type operation only, not assembling a public schema.

When only the projection is returned, only the per-field schemas validate. Validation across fields, such as a `superRefine` on the whole object, cannot run.

When the body is fetched with BatchGetItem, note that:

- It takes two round trips. BatchGetItem handles up to 100 keys at a time, and unprocessed keys (`UnprocessedKeys`) are retried
- The body is read with strong consistency, but which Items are in the result is decided by the GSI (eventually consistent). A fetched Item may no longer match the condition or may have been deleted, so it is checked again with `matches` and excluded. As a result, a page may have fewer Items than `limit`, which is accepted

### Other policies

- Scan is not exposed
- Ordering is expressed only by the index's Sort Key and direction
- Conditions other than keys (FilterExpression) are not allowed, because they are applied after reading and shift the meaning of `limit`
- Authorization is done on the query name and the parameters ([Authentication and authorization](../../zod-dynamodb/docs/shared-definitions.md)). Thinning out results after fetching is not done

There is no concept of paths, so the equivalent of Firestore's Collection Group Query is simply a named query that uses an index.

## Selecting fields to read

To avoid returning large fields such as embedding vectors every time, reads can specify which fields to return.

```ts
await repository.tasks.get(key, { fields: { pick: ["title", "status"] } });
await repository.rows.get(key, { fields: { omit: ["embedding"] } });
```

- There are two ways to specify: `pick` (fields to return) and `omit` (fields to exclude)
- Key fields are always returned, so that whichever is used, the result never loses "which Item it is"
- The result type is the per-variant `Pick` / `Omit` of the item (a TypeScript type operation only, like the projection result in "Named queries")
- It applies to Get, named queries, named searches, and subscriptions (Snapshots and change events). Named queries and searches can have a default in their definition, which can be overridden at call time

Implementation:

- DynamoDB's `ProjectionExpression` can only list the attributes to return. For `omit`, the library collects field names from the item schema internally, excludes the omitted ones, and converts the rest into a `ProjectionExpression`. If the item has parts whose field names cannot be listed, such as `z.record()`, the whole Item is read and the fields are excluded in memory
- Even with `ProjectionExpression`, the read capacity consumed is decided by the size of the whole Item. What it reduces is traffic, response size, and realtime message size ([Delivery transport](../../zod-dynamodb/docs/realtime.md))
- When only some fields are read, only the per-field schemas validate, like the projection in "Named queries"; validation across fields is not run
- The Before received as `ALL_OLD` in updates ([Writes](writes.md)) is always the whole Item

## Handling schema changes

When a schema changes, existing data may fail to parse with the new schema. How this is handled in the results of named queries and searches can be chosen with a Repository option (`invalidItems`). The default is an error (`"throw"`), and `"skip"` excludes such Items from the results. `get` always errors.

For key and index fields:

- Physical keys can be decoded without the schema ([Key encoding](../../zod-dynamodb/docs/physical-layout.md)). Changing, for example, the range of a key field's schema does not change the encoding, and existing Items can still be read
- If narrowing a range leaves existing values outside it, they can still be decoded, but fail key validation or `item.parse`. This is treated the same as changing the schema of a non-key field
- Changing the entity name, the composition of key or index fields, or slot assignments requires a data migration
- We recommend specifying integer ranges used in keys with room to spare

## Pagination

DynamoDB's `LastEvaluatedKey` is not returned to the client as is.

Returning it as is causes these problems:

- The key values of the last Item (including the index's Sort Key) reach the client. If a value not returned at the field level is used as an index key, it leaks through the token
- The physical key structure becomes part of the public API, and changing an index breaks the tokens held by clients
- Nothing ties a token to its query, so a token from one query could be passed to another

So `{ query name, hash of the key condition, start key }` is made into an opaque token signed with HMAC. The start key contains physical keys ([Physical layout](../../zod-dynamodb/docs/physical-layout.md)), but they never leave the token. A received token is used only after verifying its signature and that the query and key condition match. If the key values themselves are sensitive, they are also encrypted.

The key condition is the physical condition (index, Partition Key value, Sort Key condition) computed with `where(params, ctx)` from the parameters and the authentication context. Since the token is bound to the key condition rather than the parameters, it cannot be used with the same parameters under a different authentication context (another user, etc.).
