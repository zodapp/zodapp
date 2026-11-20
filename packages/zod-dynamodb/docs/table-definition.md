# Table definitions

[日本語](table-definition.ja.md)

## Purpose

A table definition is a data contract shared between the frontend and the backend. It upholds two things:

1. **Data is addressed by any number of fields, not by an ID.** A key can be a combination of several fields.
2. **DB-specific details are hidden, and data is read and written as a single object.** Physical key attribute names (`PK` / `SK` / `PK1`, etc.), the entity name, and library-managed attributes such as `version` appear neither in read results nor in write inputs.

A table definition expresses at least the following:

- The physical table to use ([Physical layout](physical-layout.md))
- The entity name
- The schema of the stored Item (item; includes the key fields)
- The input schema for creation (create)
- The keys (Partition Key / Sort Key, given as lists of item field names)
- Values the server adds on creation and on writes (lifecycle hooks; placed on the implementation side. [Shared definitions and server-only overrides](shared-definitions.md))
- Index definitions (the GSI slot to use and the key fields)
- Vector search definitions (the vector index slot to use, and the `HASH` and `INLINE_FILTER` fields. [Vector search](../../zod-dynamodb-node/docs/vector-search.md))

Named operations (Get, create, mutations, queries, search, etc.) are defined separately from the table definition with `createOps` ([Named queries](../../zod-dynamodb-node/docs/queries.md), [Writes](../../zod-dynamodb-node/docs/writes.md), [Vector search](../../zod-dynamodb-node/docs/vector-search.md)). Exposed operations are listed in the [registry](shared-definitions.md), and subscriptions are exposed by putting `live` on a query in the registry ([Subscription definitions](realtime.md)).

Table definitions and operations are written as one definition shared by the browser and the server, and only the rules you do not want to expose to the browser are overridden on the server ([Shared definitions and server-only overrides](shared-definitions.md)).

## Principles

`zod-dynamodb` treats **public schemas**, **internal-only schemas**, and **data conversion** separately.

### Public schemas: given by the user, returned as is

In this family of libraries, schemas are shared with `zod-form` and used for forms as they are. So it matters that the library returns the schemas the user wrote with their types unchanged, without restructuring them.

1. **The user gives the item and create schemas separately.** Item is not derived from create, nor the other way around. The user is responsible for how the two correspond.
2. **The item includes the key fields,** because edit forms and displays also handle keys. Keys are given by item field names.
3. **The library does not apply subtracting operations such as exclude / omit to public schemas.** It does not derive partial schemas for partial updates either.
4. Public types (read results, keys, partial update inputs, projection results) are made from the TypeScript types of the user's schemas, not by assembling schemas (`z.output<Item>`, `Pick<z.output<Item>, keys>`, per-variant `Partial` / `Pick`, etc.).

This lets each schema be not only a `ZodObject` but also a discriminatedUnion, intersection, union, and so on. The type of the schema you pass is kept as is, so schema-specific APIs such as `.options` of `ZodDiscriminatedUnion` or each side of a `ZodIntersection` can be used directly.

### Internal-only schemas: any type is fine

Schemas and converters that the library builds internally for runtime validation and conversion are not exposed. So their type can be `ZodType<unknown>`, and subtracting operations are allowed internally if needed.

The following are built internally, each by walking the item schema (object / intersection / union) and collecting the schemas of the relevant fields:

- **Key validation schema**: validates keys sent by the client (arguments of Get / Delete, etc.)
- **Key encoder**: converts to and from physical keys, as determined by the field schemas ([Key encoding](physical-layout.md))
- **Projection validation schema**: validates results of queries that return only the projection ([Named queries](../../zod-dynamodb-node/docs/queries.md))
- **Field validation schemas**: validate each field changed by a partial update ([Writes](../../zod-dynamodb-node/docs/writes.md))

Internal schemas and public types are built separately, so the types do not guarantee they match. Tests check that they match.

### Data conversion: handled by the library

- On creation: injecting the key, merging the create input with the hooks' return values
- Validation on creation (the whole merged result is validated with `item`)
- On update: diff updates of only the changed fields ([Writes](../../zod-dynamodb-node/docs/writes.md)), merging the hooks' return values, field-level validation, rejecting changes to key and `immutable` fields, assembling the After
- Adding and removing physical keys and library-managed attributes ([Physical layout](physical-layout.md))
- Encoding keys and decoding them back ([Key encoding](physical-layout.md))
- Converting to and from DynamoDB attribute values ([Value conversion](physical-layout.md))

Partial updates work without subtracting schemas because **instead of building a schema for partial updates, the library walks the item schema to pick out the schemas of the changed fields and validates each field**. On creation, the whole merged result is validated with `item`.

## Example definition

```ts
// shared/tasks.ts (shared definition; also runs in the browser)
import { z } from "zod";
import { physicalTable, tableConfig } from "@zodapp/zod-dynamodb";

// Physical layout. Defined once per application
export const appTable = physicalTable({
  name: "app",
  primary: { pk: "PK", sk: "SK" },
  indexes: {
    GSI1: { pk: "PK1", sk: "SK1", projection: "ALL" },
    GSI2: { pk: "PK2", sk: "SK2", projection: "KEYS_ONLY" },
    GSI3: {
      pk: "PK3",
      sk: "SK3",
      projection: { include: ["createdAt", "updatedAt"] },
    },
  },
});

const taskKeyFields = z.object({
  workspaceId: z.string(),
  taskId: z.string(),
});

const taskBody = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("todo"),
    title: z.string(),
    status: z.enum(["todo", "doing", "done"]),
    assignee: z.string().nullable(),
    priority: z.int().min(0).max(9),
  }),
  z.object({
    kind: z.literal("milestone"),
    title: z.string(),
    dueDate: z.date(),
  }),
]);

const timestamps = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const tasks = tableConfig({
  table: appTable,
  entity: "Task", // Prefix of the physical keys. Changing it requires a data migration

  // What is stored. Includes the key fields; also used as is for the edit form
  item: taskKeyFields.and(taskBody).and(timestamps),

  // Used as is for the create form. Contains neither keys nor timestamps
  create: taskBody,

  // Keys are given as lists of item field names
  key: { partition: ["workspaceId"], sort: ["taskId"] },

  // Assign physical GSI slots explicitly
  indexes: {
    byStatus: {
      slot: "GSI1",
      partition: ["workspaceId", "status"],
      sort: ["priority", "updatedAt", "taskId"],
    },
    byAssignee: {
      slot: "GSI2",
      partition: ["workspaceId", "assignee"],
      sort: ["updatedAt", "taskId"],
    },
    byDue: {
      slot: "GSI3",
      partition: ["workspaceId"],
      sort: ["dueDate", "taskId"],
    },
  },

  // Lifecycle hooks. They return values to merge. The library does the merging and validation
  onCreate: ({ now }) => ({ createdAt: now, updatedAt: now }),
  onWrite: ({ now }) => ({ updatedAt: now }),
});
```

`onCreate` / `onWrite` are **hooks that return values to merge**. Hooks are written in the table definition, but only the server (Repository) calls them ([Shared definitions and server-only overrides](shared-definitions.md)).

Whether the data on creation satisfies `item` is checked by types. The check only looks at whether "the output type of `create` & the key type & the return type of `onCreate`" is assignable to "the input type of `item`", without subtracting schemas. In the example above, forgetting to return `updatedAt` is a compile error. If `create` and `item` are the same apart from the keys, `onCreate` is not needed.

Doing this check on the arguments of `tableConfig()` would break type inference for the return value of `onCreate`, so the check is done on the return type of `tableConfig()`, and the error appears when it is passed to the Repository.

Key and index fields have the following constraints, checked by types and at runtime at definition time:

| Target                         | Type check                                                                                                                                                | Runtime check at definition time                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `key.partition` / `key.sort`   | A field **common to all variants** of the item, whose value is never `undefined`, and whose output type can be a key ([Key encoding](physical-layout.md)) | The schema is of a kind that can be encoded. It is not `.optional()` |
| `indexes.*.partition` / `sort` | A field present in **any variant**, whose output type can be a key                                                                                        | Same as above                                                        |
| `indexes.*.slot`               | A slot that exists in the physical layout. The same entity does not use the same slot twice                                                               | Same as above                                                        |

`keyof` of a union gives the common fields, so the base table keys can only be fields that every Item has. Putting a field that only some variants have into an index makes a sparse index that holds only Items of those variants ([Physical layout](physical-layout.md)).

### Tie breakers

When Items with the same index `sort` value line up, DynamoDB does not define their order among themselves. It is not necessarily the primary key order. Live lists ([Realtime sync](../../zod-dynamodb-client/docs/live-sync.md)), on the other hand, order by "Sort Key, then primary key when equal" and use that to decide how far they have read. For indexes where the order should be unique, put primary key fields (those not already in `partition` and `sort`) at the end of `sort`. `taskId` in the example above is one.

Unlike Firestore, the library does not add the primary key automatically, so that the Sort Key does not grow when `sort` already ends with a unique value (a natural key). If you forget it, when Items with the same Sort Key straddle a page boundary, some loaded items in a live list are hidden (they appear with "load more"). Always add it to indexes used by live lists.

### Fields that do not change (`immutable`)

Fields other than keys can be declared as not changing after creation.

```ts
immutable: ["ownerId"],
```

- Trying to change such a field in an update (partial update, mutation, return value of `onWrite`) is an error
- Since the value does not change, it is safe to use in write conditions (`where`. [Writes](../../zod-dynamodb-node/docs/writes.md)) and index keys. When re-keying an index, the value read earlier can be used as is ([Writes](../../zod-dynamodb-node/docs/writes.md))

**Guideline**: for entities in a parent-child relationship, if authorization uses a parent's field (such as the owning organization), give the child the same field as `immutable`. Authorization of updates and deletes of the child can then be expressed with the child's `where` alone, without reading the parent.

### One table definition per entity

There is only one table definition per entity. Multiple table definitions with the same entity name are an error when the Repository is created.

- Access restrictions are expressed by the exposed operations, authorization ([Authentication and authorization](shared-definitions.md)), and `where`, not by definitions, so a separate unrestricted definition is not needed
- To read fewer fields (such as a list without large fields), use the field selection (`pick` / `omit` of `fields`. [Selecting fields to read](../../zod-dynamodb-node/docs/queries.md)) or index projection (`KEYS_ONLY` / `INCLUDE`. [Physical layout](physical-layout.md))

## Roles of each schema and type

| Name                                                           | Kind                                     | Content                                                                               | Main uses                                                                                |
| -------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `item`                                                         | Public schema (given by the user)        | The stored data. Includes the keys                                                    | Read results, whole validation on creation, field-level validation on update, edit forms |
| `create`                                                       | Public schema (given by the user)        | The data the client passes on creation                                                | Create input, create forms                                                               |
| Key type                                                       | Public type                              | `Pick<z.output<Item>, key fields>`                                                    | Arguments of Get / Update / Delete                                                       |
| Partial update type                                            | Public type                              | Per-variant `Partial` of item                                                         | Partial update input                                                                     |
| Projection result type                                         | Public type                              | Per-variant `Pick` of item ([Named queries](../../zod-dynamodb-node/docs/queries.md)) | Results of queries that return only the projection                                       |
| Key validation schema / encoder / projection validation schema | Internal only (`ZodType<unknown>`, etc.) | Built from the field schemas collected from item                                      | Input validation, conversion to and from physical keys                                   |

### Schema requirement: the output passes when run through again

The library `parse`s the same value several times. It validates with the item schema after adding the hook values and keys, and on reads it validates the stored value (the output of the item schema) with the item schema again to detect broken data with `CorruptedDataError`. So the schemas of `item`, `create`, and operation `params` are limited to ones **whose output passes when run through the same schema again**.

- `transform` and `pipe` (`preprocess` and `codec` are also `pipe` inside) have different input and output types, so they cannot be used. They are a `DefinitionError` at definition time (for all fields, not only key fields)
- `default`, `prefault`, `catch`, `coerce`, `trim`, and the like pass when their output is run through again, so they can be used. However, even `default` cannot be used on key fields ([Key encoding](physical-layout.md))
- The definition-time check covers the schema tree of objects, unions, intersections, optionals, arrays, and so on; it cannot see inside things like `z.custom`
- Shared-definition operations (`execute`, the server API, the router, the Gateway) validate once before authorization and use that result for both `authorize` and the write. Even with schemas that produce a different value each time, such as `default(() => randomUUID())`, the authorized value and the stored value are the same. When you call Repository accessors directly, the accessors validate

### Read results

A read result is `z.output<Item>` itself and includes the keys. It does not include physical key attributes or library-managed attributes.

```ts
const task = await repository.tasks.get({
  workspaceId: "ws1",
  taskId: "task1",
});
// task: z.output<typeof tasks.item> | null
```

`version` is not included in read results either. The library increments `version` ([Writes](../../zod-dynamodb-node/docs/writes.md)), and update conditions are expressed with `where` on fields rather than `version`, so users never need to handle `version`. Realtime sync uses `version`, but only inside the sync protocol and the client library ([Item Version](../../zod-dynamodb-client/docs/live-sync.md)).

To detect updates by others while editing in a form, use an opaque token (`ifUnchanged`) instead of exposing `version` ([Writes](../../zod-dynamodb-node/docs/writes.md)).

### Working with forms

- Create forms use `create` as is
- Edit forms use `item` as is. To make key fields read-only, use `readOnlySchemaFields` of `zod-form`. It returns the same type as the schema it receives, so it does not spoil the types of the public schema
- The only constraint on values used in key fields ([Key encoding](physical-layout.md)) is a maximum length, so no special schema is usually needed
