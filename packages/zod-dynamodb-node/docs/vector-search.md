# Vector search

[日本語](vector-search.ja.md)

## Vector search

DynamoDB's vector indexes (the `SearchVectors` API) are handled the same way as named queries. The library does not deal with which embedding model to use; the application decides.

### Assumptions about DynamoDB vector indexes

The specifications that affect the design are:

- Embedding vectors are kept as a list of numbers (`L` of `N`) in an ordinary Item attribute. The number of dimensions (up to 4096) and the distance function (`COSINE` / `DOT_PRODUCT` / `EUCLIDEAN`) are fixed per index and cannot be changed after creation
- Items without the vector attribute do not go into the index (sparse)
- `SearchSchema` can specify two kinds of attributes. The configuration cannot be changed after creation
  - `HASH` (the partition key of the vector index): one attribute per index. Every search must give its value with an equality condition. Items without this attribute do not go into the index. A type mismatch makes the write itself be rejected
  - `INLINE_FILTER`: up to 18 attributes per index. Currently equality only. Items without this attribute still go into the index
- Projection is one of `ALL` / `KEYS_ONLY` / `INCLUDE`. `KEYS_ONLY` includes the base table primary key, the vector, and the `HASH` and `INLINE_FILTER` attributes
- `SearchVectors` returns Items and a `Score` in order of similarity. It returns at most 100 Items at a time, has no pagination, and is eventually consistent. IAM FGAC does not apply
- Per-table constraints
  - A table with vector indexes is limited to the on-demand capacity mode for the whole table
  - The default limit is 5 vector indexes per table (up to 20 on request), and they count toward the GSI limit (20)
  - Indexes, together with GSIs, can only be created and deleted one at a time per table
  - Once the base table exceeds 600 GB, creating an index requires a request to AWS

### Where to put them

**The standard is to put vector indexes on the existing single table.** Vector indexes are sparse, so Items of other entities without the vector attribute are not affected.

Use a separate physical table only in cases like the following. Because this is abstracted by `physicalTable()`, the API is the same either way.

- You want to run the main table in provisioned capacity mode
- You plan to rebuild vector indexes often (during a backfill, the main table's GSIs cannot be changed)

### How embedding vectors are kept

**Embedding vectors are kept as ordinary fields of the item.** The caller creates the embedding vector and then writes it like any other field. Creation, partial updates, and mutations all go through the same path as normal writes ([Writes](writes.md)). When the content changes, the caller also passes the new embedding vector.

The flow of creating the embedding vector asynchronously after a write and writing again is not used. It has only drawbacks: two writes, a window during which the vector is stale, and a mechanism needed to avoid version conflicts between the second write and other updates.

The library only maps attributes and validates.

- On write, it writes the value of the embedding vector field to the slot's attribute name (`V1` below, etc.). On read, it maps it back to the original field name
- Before writing, it validates that the number of dimensions matches the slot's setting (DynamoDB rejects writes with the wrong number of dimensions, but this gives a clearer error first)

Embedding vectors are several KB to over ten KB, so exclude them from read results and realtime events with the field selection ([Selecting fields to read](queries.md)).

### Vector slots

As with GSIs, the attribute names of a vector index (vector, `HASH`, `INLINE_FILTER`) are fixed per index and shared between entities. So vector indexes are also defined as "slots" in the physical layout.

```ts
export const appTable = physicalTable({
  name: "app",
  primary: { pk: "PK", sk: "SK" },
  indexes: {
    /* GSI slots ([Physical layout](../../zod-dynamodb/docs/physical-layout.md)) */
  },
  vectorIndexes: {
    VEC1: {
      vector: "V1",
      hash: "VH1",
      filters: ["VF1_01", "VF1_02", /* …, */ "VF1_18"],
      dimensions: 1536,
      distance: "COSINE",
      projection: "KEYS_ONLY",
    },
    VEC2: {
      vector: "V2",
      hash: "VH2",
      filters: ["VF2_01", /* …, */ "VF2_18"],
      dimensions: 1024,
      distance: "COSINE",
      projection: "KEYS_ONLY",
    },
  },
});
```

- **Multiple slots can be defined.** Each slot corresponds to a "dimensions × distance function" pair. The application decides how many to prepare; the limit is DynamoDB's limit on the number of vector indexes
- **One slot may be shared by multiple models with the same dimensions and distance function.** Comparing vectors from different models is meaningless, but a search always stays within one `HASH` value. So as long as each `HASH` value uses only one model, vectors from different models are never compared in the same search
- `INLINE_FILTER` attributes cannot be added after creation, so define as many as you are likely to use (up to 18) from the start
- The attribute type of both `HASH` and `INLINE_FILTER` is string (`S`) (below)

An entity fixes the slot it uses at definition time, or chooses it by runtime settings. Only the chosen slot's attributes are written to the Item; other slots' attributes are not.

### HASH

`HASH` corresponds to the Partition Key of a GSI. Its value is a string encoded in the same format as the Partition Key ([Physical layout](../../zod-dynamodb/docs/physical-layout.md) / [Key encoding](../../zod-dynamodb/docs/physical-layout.md)).

```text
VH1 = <entity>#<f1>#<f2>…
Example: Row#p1#ds1#v3        (projectId#dataSourceId#dataSourceVersionId)
```

- The entity name is prefixed, so entities do not mix even when they share a slot
- Multiple fields can be concatenated, and the value is never empty (an empty string cannot be written to `HASH`)
- The rule in [Key encoding](../../zod-dynamodb/docs/physical-layout.md) of not writing when a field is `undefined` matches DynamoDB's behavior that "Items without the `HASH` attribute do not go into the index" exactly
- The library always writes strings, so there are no accidents where a write is rejected for a type mismatch
- A search never goes beyond one `HASH` value. Align this boundary with a unit that searches never cross, such as a tenant or a data source version
- The number of possible values should be small to moderate. Too many (unique per Item, etc.) leaves no neighboring Items and lowers accuracy; too few (a boolean, etc.) concentrates load on one value

It is a separate attribute from the base table's `PK`, because `PK` is often close to per-Item granularity, which does not match the granularity `HASH` needs.

There is no equivalent of a GSI Sort Key. Results are ordered by similarity.

### INLINE_FILTER

`INLINE_FILTER` is additional narrowing with equality only. One attribute holds one or more fields, encoded as in [Key encoding](../../zod-dynamodb/docs/physical-layout.md) and concatenated into a string.

- Type collisions are avoided: attribute names are shared between entities, and their type is fixed at creation. Since the library always writes strings, types never collide between entities
- `null` can also be searched for by equality, as `$%`
- If even one of the fields that make it up is `undefined`, the attribute is not written. Such an Item does not match searches narrowed by that attribute, and appears in searches that do not narrow by it

The mapping between filters and fields can be given in two ways.

**Static filters**: the mapping between filter attributes and fields is fixed at definition time.

```ts
filters: { VF1_01: ["status"], VF1_02: ["category", "brand"] }
```

**Dynamic filters**: the meaning of filter attributes is kept as runtime data. For example, for each data source version, the user sets the combinations of fields to narrow by.

```text
Physical (fixed when the index is created)  VF1_01 … VF1_18 (attribute names and type S never change)
Meaning (set by the user per data source version)
  VF1_01 = [model number, category]
  VF1_02 = [category]
Values (assembled by the library on write)
  VF1_01 = "A100#appliances"
  VF1_02 = "appliances"
```

- The mapping belongs to a `HASH` range (in this example, the data source version). Items are written according to that mapping, so to change the mapping, write them again as a new `HASH` range (a new version)
- Only equality is available, so `VF1_01 = model number#category` only matches when both values are given. To narrow by category alone, set up `VF1_02 = category` separately. Use one attribute per commonly used combination of filters, up to 18. Multiple attributes are combined with AND
- **Caution**: one attribute can hold only one value. If you want one Item to be found by any of several values (an array of tags, etc.), write a copy of the Item per value, and deduplicate search results by the original Item's ID. Each copy takes a slot of `topK`
- Field types come from the schema decided at runtime. `encode(schema, value)` works the same with a Zod schema built at runtime, so this is handled by the same mechanism as static definitions
- Slot attribute names (`VF1_01`, etc.) can be type-checked, but their contents are decided at runtime, so they are not statically typed. A helper that builds the values from the same settings is provided for both writing and searching, so the written values and the searched values never drift apart

Embedding vectors are good at semantic closeness, but not at exact string matches such as model numbers. The split is: narrow by exact-match conditions with `INLINE_FILTER`, and look at semantic closeness with embedding vectors.

### Table definition

```ts
export const rows = tableConfig({
  table: appTable,
  entity: "Row",
  item: z.object({
    projectId: z.string(),
    dataSourceId: z.string(),
    dataSourceVersionId: z.string(),
    rowId: z.string(),
    modelNumber: z.string(),
    category: z.string(),
    embedding: z.array(z.number()),
    // ...
  }),
  create: /* ... */,
  key: { partition: ["projectId", "dataSourceId", "dataSourceVersionId"], sort: ["rowId"] },
  vectors: {
    // Static assignment of slots. To fix the slot at definition time, write slot: "VEC1"
    content: { field: "embedding", partition: ["projectId", "dataSourceId", "dataSourceVersionId"] },
  },
});

// server/repository.ts (server only): choose the slot and filters by runtime settings
const repository = createRepository({
  tables: { rows },
  vectors: {
    rows: {
      content: {
        slot: (_row, { vectorConfig }) => vectorConfig.slot,
        filters: (row, { vectorConfig }) => buildFilters(vectorConfig.filters, row),
      },
    },
  },
  resolveVectorConfig: ({ hash }) => loadVectorConfig(hash), // look up the settings from the HASH value
  dynamodb,
});
```

The `slot` and `filters` functions are server logic that uses runtime settings, so they are written in `vectors` of `createRepository` ([Shared definitions and server-only overrides](../../zod-dynamodb/docs/shared-definitions.md)). The shared table definition holds only the static assignment of slots (`field`, `partition`, static filters). If a vector whose slot is not fixed at definition time has no `vectors` setting, creating the Repository is an error.

`vectorConfig` is the runtime settings (the slot to use, the filter mapping, the embedding model, etc.). It is handled as follows:

- The settings are kept on an Item that represents the `HASH` range (in this example, the data source version Item). The application decides where to store them, and passes the library a function that looks up the settings from the values of the `HASH` fields (`resolveVectorConfig`)
- **The settings are immutable per `HASH` range.** Items are written according to the settings, so to change the settings, write them again as a new range (a new version). Even when the range does not change, as with `live`, changing the settings means rewriting all Items in the range
- Since they are immutable, the library may cache the settings keyed by the `HASH` value. There is no need to re-read the settings on every write and search. A way to explicitly invalidate the cache is provided for rewriting a range

### Named searches

Searches are also declared with names, like named queries ([Named queries](queries.md)), and the client can only specify the name and the parameters.

```ts
// shared/rows.ts (shared definition)
export const rowOps = createOps(rows, (o) => ({
  similar: o.search({
    vector: "content",
    params: z.object({
      projectId: z.string(),
      dataSourceId: z.string(),
      dataSourceVersionId: z.string(),
      text: z.string(),
      filterValues: z.record(z.string(), z.string()).optional(),
    }),
    topK: 20,
    select: "full",
    authorize: (ctx, { params }) => ctx.projects.includes(params.projectId),
    // values of the fields that make up HASH
    partition: (p) => ({
      projectId: p.projectId,
      dataSourceId: p.dataSourceId,
      dataSourceVersionId: p.dataSourceVersionId,
    }),
    // vectorConfig is the runtime settings looked up from partition
    filters: (p, _ctx, { vectorConfig }) =>
      buildFilters(vectorConfig?.filters, p.filterValues ?? {}),
  }),
}));

// server/overrides.ts (server only): the app creates the embedding vector for the search
override(rowOps.similar, {
  queryVector: (p) => embed(p.text),
});

// result: { item, score }[]
```

- `queryVector` often calls an external API, so it is not written in the shared definitions; it must always be given by a server override. Without an override, running the search is an error (`DefinitionError`)
- `partition` gives values for all fields that make up `HASH`. `filters` can be omitted
- `partition` and `filters` are separate functions because the runtime settings (`vectorConfig`) used by `filters` are looked up by the `HASH` value built from `partition`. The Repository calls `partition`, looks up the settings, and then calls `filters` and `queryVector`
- `filters` values are either strings built with `buildFilters`, or sets of field values (e.g. `{ VF1_01: { status: "active" } }`). The library encodes sets of field values. Attributes whose value is `undefined` are not narrowed by
- `select` means the same as in [Named queries](queries.md). With `"full"` on a `KEYS_ONLY` slot, the keys are decoded from the base table's `PK` / `SK`, and the body is fetched with BatchGetItem. With `"projection"`, the decoded keys and the projected attributes are returned
- Each result element is `{ item, score }`. `score` is metadata about the search result rather than data of the Item, so it is returned separately from item. What `score` means (closer when smaller, or closer when larger) depends on the distance function
- There is no pagination, and `topK` is at most 100
- Realtime subscriptions are not supported. Rankings change with changes to other Items, so for the same reason as subscriptions with `limit` in [Subscription definitions](../../zod-dynamodb/docs/realtime.md), comparing one Item before and after an update is not enough to decide
- Authorization is done on the search name and the parameters, the same as named queries ([Authentication and authorization](../../zod-dynamodb/docs/shared-definitions.md)). Narrowing by `HASH` is not an IAM boundary, but this is not a problem since requests go through the backend

### Batch writes

When writing a large number of Items that do not change afterwards, such as importing a data source, there is no need to write each Item conditionally. A path that writes in bulk with BatchWriteItem is provided.

- BatchWriteItem cannot write conditionally
- Write throughput has a limit per `HASH` value (10 MB/s)
- DynamoDB has no bulk delete, so old ranges (old versions, etc.) are deleted Item by Item or with TTL. Items deleted by TTL are also removed from the vector index
- If you switch the range searches refer to (the "current version", etc.) only after finishing writing the new range, searches never see data in the middle of being written
- Batch writes are also subject to realtime change events ([Batch writes and events](../../zod-dynamodb/docs/realtime.md))
