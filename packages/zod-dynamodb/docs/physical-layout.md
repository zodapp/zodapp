# Physical layout and key encoding

[日本語](physical-layout.ja.md)

## Physical layout

### A single table and GSI slots

The standard is single-table design, with multiple entities in one DynamoDB table. Physical key attribute names are generic, and GSIs are used as "slots" shared by multiple entities.

| Index      | Partition Key attribute | Sort Key attribute |
| ---------- | ----------------------- | ------------------ |
| Base table | `PK`                    | `SK`               |
| GSI1       | `PK1`                   | `SK1`              |
| GSI2       | `PK2`                   | `SK2`              |
| GSI3       | `PK3`                   | `SK3`              |

The application defines the physical layout once with `physicalTable()`, and each table definition refers to it. Physical key attribute names appear only in this definition, and never in table definitions, the Repository, or the protocol.

- **Slots are assigned explicitly.** Each index in a table definition specifies something like `slot: "GSI1"`. With automatic assignment, adding a single index could shift the assignments and require migrating existing data.
- The same entity cannot use one slot twice. Different entities can share the same slot.
- Vector indexes are also defined as slots in the physical layout ([Vector search](../../zod-dynamodb-node/docs/vector-search.md)).
- DynamoDB's multi-attribute GSI keys are not used. Shared slots cannot use different attribute names per entity, so multiple fields are expressed as a concatenated string ("Key encoding").

### Projection

Projection is decided per physical GSI and cannot vary per entity. So **projection is chosen per slot**, and each entity picks, per index, a slot that suits how it is read. The library supports the following three kinds, and named query definitions are the same regardless of the kind.

| Projection  | How it is read                                                                                                              | Suited for                                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `ALL`       | `item.parse` the Query result as is                                                                                         | Lists of small Items that are read often                                                                                    |
| `KEYS_ONLY` | Decodes the logical keys from the physical keys and returns them. If the whole Item is needed, fetches it with BatchGetItem | Large Items, write-heavy data, rarely used indexes                                                                          |
| `INCLUDE`   | Returns the projected attributes and the decoded keys. If the whole Item is needed, fetches it with BatchGetItem            | Listing only attributes that many entities have with the same name and meaning (`createdAt` / `updatedAt` / `status`, etc.) |

Rough costs:

- Reads: Query is billed on the total size of the returned Items rounded up to 4 KB, and BatchGetItem rounds each Item up to 4 KB. The smaller the Items, the more `ALL` wins; for large Items the difference is small.
- Writes: with `ALL`, every write to the base table also writes the whole Item to the GSI. With `KEYS_ONLY`, writes to the GSI basically happen only when the GSI keys change. If `INCLUDE` contains attributes that change every time, such as `updatedAt` or `_version`, every write propagates to the GSI.
- Storage: with `ALL`, the whole Item is duplicated per GSI.

In a single table, `INCLUDE` is only usable in special cases. Each combination of projected attributes needs its own slot, which quickly hits the GSI limit, and there is also a limit of 100 projected non-key attributes across all indexes. Also, the attributes you want in a list are often the index keys themselves, which `KEYS_ONLY` can recover by decoding. So we recommend centering on `ALL` and `KEYS_ONLY`, and keeping `INCLUDE` to about one slot for a set of common attributes.

The library sets no default for the number of slots and the combination of projections. Decide them from the application's read and write patterns. For example, two `ALL` slots and two `KEYS_ONLY` slots.

**Caution: the number of GSI slots**: slots are shared between entities, so the number needed is not the total number of indexes over all entities, but **the maximum number of indexes of any one entity** (per projection, if you split projections). The upper limit is DynamoDB's GSI limit (20) minus the number of vector indexes in the same table ([Vector search](../../zod-dynamodb-node/docs/vector-search.md)).

The type for `INCLUDE` simply adds the projected attributes to the projection result type ([Named queries](../../zod-dynamodb-node/docs/queries.md)).

Attributes projected with `INCLUDE` are validated with each field's schema, the same as when `KEYS_ONLY` returns only the projection ([Named queries](../../zod-dynamodb-node/docs/queries.md)); validation across fields is not done. When the field schema differs per variant:

- If the discriminator field is in the projection, the schema of that variant is used
- If not, the value passes if it satisfies the schema of any variant

### Physical key format

```text
PK  = <entity>#<f1>#<f2>…
SK  = <entity>#<f1>#<f2>… (<entity> for entities without a Sort Key)
PKn = <entity>#<f1>#…
SKn = <entity>#<f1>#… (<entity> if the index has no Sort Key)
```

Each field value is encoded as described in "Key encoding" and joined with `#`.

- **The entity name is prefixed to both PK and SK.** Entities do not mix even when they share a slot. Prefixing SK as well means it never becomes an empty attribute, which DynamoDB does not allow, even when the values are empty.
- At definition time, the entity name is checked not to contain `#` or the characters escaped by "Key encoding".
- **Fetching multiple entities together in one Query (item collections) will not be supported in the future either.** This format was chosen deliberately to spread PKs by prefixing the entity name. If you need it, call the named queries of each entity in parallel.

Writing the following Item with the example definition in [Table definitions](table-definition.md):

```ts
{
  workspaceId: "acme corp", taskId: "01JBX6Q4M2", kind: "todo", title: "Design",
  status: "todo", assignee: null, priority: 7,
  createdAt: new Date("2026-10-28T00:00:00Z"), updatedAt: new Date("2026-10-28T00:00:00Z"),
}
```

stores these attributes:

```text
PK  = Task#acme$Pcorp         SK  = Task#01JBX6Q4M2
PK1 = Task#acme$Pcorp#todo    SK1 = Task#$*c01c000000000000#$+2026-10-28T00:00:00.000Z#01JBX6Q4M2
PK2 = Task#acme$Pcorp#$%      SK2 = Task#$+2026-10-28T00:00:00.000Z#01JBX6Q4M2     ← null goes into the index
(PK3 / SK3 are not written)                                                      ← variant without dueDate
_version = 1
workspaceId, taskId, kind, title, status, assignee, priority, createdAt, updatedAt
```

### Writes and reads

- **On write**: physical keys are built from the logical keys and added. On creation, all physical keys are added. On update, only the physical keys of indexes that use the changed fields are re-added, in the same `UpdateItem` ([Writes](../../zod-dynamodb-node/docs/writes.md)).
- **Sparse indexes**: if even one key field of an index is missing (the variant has no such field, or the value is `undefined`), that index's physical keys are not written for the Item. Even if only part of a composite key is missing, the whole Item is left out. `null` is treated as a value and goes into the index ("Key encoding").
- **On read**: physical key attributes and library-managed attributes are removed before `item.parse`. This is not left to `item.parse` dropping unknown fields, because validation fails if the user uses `z.strictObject`.

### Caution: multi-value search, and exact-match search that returns the content

A DynamoDB index can hold one Item under only one key value. There is no index that searches by each element of an array (like Firestore's `array-contains`). GSIs are also eventually consistent.

If you want to look up one Item by multiple values, or need strong consistency and the content returned for an exact-match search, **define a separate search entity with one Item per value**.

```text
Partition Key = [search scope, kind of search, value]
Sort Key      = [ID of the original Item]
Others        = the content returned as the search result
```

- One Query on the base table returns the results and their content with strong consistency
- When a value of the original Item changes, delete the Item for the old value and write an Item for the new value. Use a transaction ([Writes](../../zod-dynamodb-node/docs/writes.md)) if you rewrite them together with the original Item, or a batch write ([Vector search](../../zod-dynamodb-node/docs/vector-search.md)) for data that does not change after it is written
- It does not use up GSIs

### Reserved names

Physical key attribute names (those given in the physical layout) and library-managed attributes (`_version`) are reserved. The entity name can be read from the start of PK and SK, so there is no attribute for the kind of entity. Types check that item field names do not collide with them.

## Key encoding

### Requirements

A physical key is a string that satisfies the following:

1. **Unique**: different combinations of values never become the same string. Without escaping the separator, `("a#b", "c")` and `("a", "b#c")` collide.
2. **Reversible**: the original values can be recovered from the string (used by `KEYS_ONLY` / `INCLUDE`).
3. **Order-preserving**: DynamoDB compares strings in UTF-8 byte order. To order composite keys by their tuple of values, every character used in each encoded value must be greater than the separator.
4. **Decodable without the schema**: encoding and decoding depend only on the value and the string, not on the Zod schema (see below). So existing data can still be read after changing, for example, the range constraints of the schema.

### Type identifiers

Encoding and decoding are decided by the value and the string only, without the Zod schema (`encode(value)` / `decode(string)`). Non-string values take the form `$` + a type identifier (one character) + type-specific data, and strings get no type identifier. Decoded values are validated with the internal key validation schema, as before. Users do not need to choose an encoding.

| Type                               | Encoding                                                       | Example                                           |
| ---------------------------------- | -------------------------------------------------------------- | ------------------------------------------------- |
| `null`                             | `$%`                                                           |                                                   |
| `false`                            | `$(`                                                           |                                                   |
| `true`                             | `$)`                                                           |                                                   |
| Number (all integers and decimals) | `$*` + order-preserving IEEE 754 as 16 hex digits (lower case) | `7→$*c01c000000000000`, `-1.5→$*4007ffffffffffff` |
| `Date`                             | `$+` + `toISOString()` (UTC, 24 characters)                    | `$+2026-10-28T00:00:00.000Z`                      |
| Empty string                       | `$/`                                                           |                                                   |
| String                             | Escaping (below)                                               | `"t1"→t1`, `"Bob Smith"→Bob$PSmith`               |

Values of different types are ordered **null < false < true < number < Date < string** (the same order as Firestore).

The character after `$` is assigned as follows:

| Character               | Use                                        |
| ----------------------- | ------------------------------------------ |
| `%` (0x25)              | null                                       |
| `&` (0x26)              | Reserved                                   |
| `'` (0x27)              | Not used (awkward in shells and logs)      |
| `(` `)` (0x28, 0x29)    | false / true                               |
| `*` (0x2A)              | Number                                     |
| `+` (0x2B)              | Date                                       |
| `,` `-` `.` (0x2C–0x2E) | Reserved (for future types such as bigint) |
| `/` (0x2F)              | Empty string                               |
| `0`–`T` (0x30–0x54)     | String escapes                             |
| `U` and above           | Unused                                     |

Type identifiers are symbols smaller than `/` so that every non-string type sorts before every string (including the empty string and strings that start with an escape). With letters, `" a"` (`$Pa`) would sort before numbers and `"a"` after them, splitting the range of strings with other types. Every identifier is greater than the separator `#` (0x23), so requirement 3 holds.

Decoding looks at the one character after `$`. A type identifier means the type-specific data follows, `/` means the empty string, `0`–`T` means a string escape, and anything not starting with `$` is read as a string.

### Schemas usable as keys

Since the type is known from the value, unions and unions of literals (`"true"` and `true`, etc.) can also be keys, as long as each member is a kind usable as a key.

The following are errors at definition time:

- transform, pipe, default (it would be ambiguous whether the input or the output is encoded)
- Kinds not in the table above, such as object and array

Types only check that the output type of key fields fits in `string | number | boolean | Date | null`. The kind of schema is checked at runtime at definition time, because picking out a field's schema at the type level is impractical when the item is a union or intersection.

### Strings

Only characters at or below `$` (0x24) are replaced by two characters: `$` and the character at "the original code + 0x30". These are control characters, space, `!`, `"`, `#`, and `$`. All other characters (UUIDs, ULIDs, ISO date-times, Japanese, etc.) stay as they are.

| Value          | Encoded      |
| -------------- | ------------ |
| `"w1"`         | `w1`         |
| `"01JBX6Q4M2"` | `01JBX6Q4M2` |
| `"東京"`       | `東京`       |
| `"100%"`       | `100%`       |
| `"a#b"`        | `a$Sb`       |
| `"Bob Smith"`  | `Bob$PSmith` |
| `"hi!"`        | `hi$Q`       |
| `"$5"`         | `$T5`        |
| `""`           | `$/`         |

Every replacement character is greater than the separator `#`, and the order among the original characters is kept. Non-ASCII characters are 0x80 or above in UTF-8, so they satisfy the requirements as they are.

```text
Order: ""=$/  "a"=a  "a b"=a$Pb  "a!"=a$Q  "a#"=a$S  "a$"=a$T  "a%"=a%  "ab"=ab  "b"=b
```

So there is no restriction on the characters usable in string keys. The only remaining constraint is the maximum encoded length (2048 bytes for a Partition Key, 1024 bytes for a Sort Key; the same for GSIs).

### Numbers

Integers and decimals are not distinguished; every `z.number()` is expressed as order-preserving IEEE 754. Separate identifiers for integers and decimals would break the order of 1 and 1.5 in the same field.

- Conversion: for positive values (including 0), set the sign bit; for negative values, invert all bits. Express the result as an unsigned 64-bit integer in 16 hex digits. Using the IEEE 754 bits as they are would sort negative values after positive ones, and reverse the order among negative values
- Decoding: if the top bit is 1, clear the sign bit; if it is 0, invert all bits

With IEEE 754, values and physical keys correspond one to one, and floating-point rounding causes no drift. Fixed-point decimals are not used. `z.number().multipleOf(0.01)` accepts `0.1 + 0.2` (= `0.30000000000000004`) as a valid value, so rounding to fixed point could map different values to the same key, or make the decoded value differ from the stored one. For amounts that need a readable form, we recommend storing integers (cents, etc.).

```ts
const view = new DataView(new ArrayBuffer(8)); // big-endian by default
const hex8 = (u: number) => u.toString(16).padStart(8, "0");

const encodeNumber = (n: number): string => {
  view.setFloat64(0, n === 0 ? 0 : n); // normalize -0 to 0
  let hi = view.getUint32(0),
    lo = view.getUint32(4);
  if (hi & 0x8000_0000) {
    hi = ~hi >>> 0;
    lo = ~lo >>> 0;
  } // negative: invert all bits
  else hi = (hi | 0x8000_0000) >>> 0; // positive: set the sign bit
  return "$*" + hex8(hi) + hex8(lo);
};
```

- Sharing a buffer with `Float64Array` makes the byte order depend on the runtime, so `DataView` is used
- `-0` and `0` have different bits, so without normalizing, the same value would become different keys
- NaN and Infinity are not considered, because zod v4's `z.number()` does not accept them
- The client may also decode, so the Node-only `Buffer` is not used

Verified values: -max `0010000000000000`, -1 `400fffffffffffff`, -5e-324 `7ffffffffffffffe`, 0 `8000000000000000`, 5e-324 `8000000000000001`, 1 `bff0000000000000`, +max `ffefffffffffffff`.

### Date

- No time zone. Always the UTC form of `toISOString()` (`YYYY-MM-DDTHH:mm:ss.sssZ`, a fixed 24 characters). A JS `Date` only represents a point in time and has no time zone, so no information is lost. If you need a time zone, keep it in a separate field
- A `Date` whose year is outside 0000–9999 is an error on write (the ISO string would take the form `+010000-…` / `-000001-…` and break the order)
- Date-times with an offset kept as strings (`z.iso.datetime({ offset: true })`, etc.) are encoded as strings. They do not sort in time order

### null and undefined

- **`null`**: encoded as `$%`. `null` is treated as a value and goes into indexes (so you can search for "no assignee").
- **`undefined`**: has no encoding rule.
  - For base table keys, `.optional()` fields are an error at definition time.
  - For index keys, if even one field is `undefined`, the Item is not put into that index ("Physical layout").
  - For named queries on that index, `undefined` is removed from the parameter types (`null` is kept).

There is no mechanism to change this default behavior, or for users to define their own encoding.

### Where checks happen

- **At definition time**: the kind of schema, the entity name, duplicate slots
- **On write**: validating values with the internal key validation schema, the year range of `Date`, the maximum encoded length
- **On decode**: decoded values are also run through the internal key validation schema. The entity name prefix is matched, and broken data or Items of another entity are errors

## Value conversion

DynamoDB has no date type, and has its own handling of Set types, numeric precision, and so on. For attributes other than keys, the library converts between Zod schemas and DynamoDB attribute values as a codec layer. The codec is `zod-transform`, which converts values following the schema.

- `Date` becomes a UTC ISO string (the same representation as in key encoding)
- `Set` / `Map` become arrays / objects (because an empty Set cannot be stored)
- `bigint` becomes a string

**Caution: fields without a type**: the codec converts values using the schema as a guide. In untyped parts such as `z.unknown()` or `z.record(z.string(), z.unknown())`, put only values that JSON can represent (strings, numbers, booleans, `null`, arrays, objects). A `Date` put there changes into another form when stored and does not come back when read.
