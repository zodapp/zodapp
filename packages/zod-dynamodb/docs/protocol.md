# Protocol input / output and errors

[日本語](protocol.ja.md)

## Requests and responses

| Operation | Input                                                   | Output                                                                                                            |
| --------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Get       | Key                                                     | `{ item: Item \| null, token? }` (the token is always returned. [Writes](../../zod-dynamodb-node/docs/writes.md)) |
| Create    | `{ key, input }` (`{ args, input }` for generated keys) | `{ item }`                                                                                                        |
| Set       | `{ key, input }` (`input` is the whole Item)            | `{ item }`                                                                                                        |
| Mutation  | `{ key, params, ifUnchanged? }`                         | `{ item }` (after)                                                                                                |
| Delete    | `{ key }`                                               | `{}`                                                                                                              |
| Query     | `{ params, cursor?, limit?, fields? }`                  | `{ items, cursor? }`                                                                                              |
| Search    | `{ params, fields? }`                                   | `{ results: { item, score }[] }`                                                                                  |

- The receiving side (the server) validates the input with the operation's schema. The client also validates with the same schema before sending
- The client converts the positional arguments of the browser API ([Browser API](../../zod-dynamodb-client/docs/client-api.md)) into this input shape before sending
- `ifUnchanged` is the token received from Get ([Writes](../../zod-dynamodb-node/docs/writes.md))
- The output `item` is `z.output<Item>`, and does not contain physical keys, the entity name, or `version` ([Roles of each schema and type](table-definition.md))
- `fields` (`{ pick }` or `{ omit }`) narrows the returned fields. Key fields are always returned. Middleware narrows the result, so the amount read from DynamoDB does not change. To read less, use index projection ([Physical layout](physical-layout.md))
- For results narrowed by projection (`select: "projection"`) or `fields`, the output schema is built from the item schema by keeping only the returned fields. With projection, only the key fields and the index key fields are required, and the others are optional. This can be built for item schemas written as objects, unions, and intersections

## Value conversion

JSON cannot represent `Date`, `bigint`, `Set`, or `Map`. HTTP input and output are converted with zodapp's `@zodapp/zod-transport-json`.

- `createJsonTransport(schema)` returns `encode` / `decode`, which convert between values and JSON following the schema, and a schema for the JSON shape (`transportSchema`). `Date` becomes an ISO string with a time zone, `bigint` a string, `Set` an array, and `Map` an object
- The library builds a transport per endpoint from its input and output schemas. The client `encode`s the input before sending and `decode`s the output. The server does the reverse
- Both `encode` and `decode` validate with the schema, so values returned by the server are validated too
- This is separate from the conversion for storing in DynamoDB ([Value conversion](physical-layout.md)). The storage representation (`Date` is a UTC ISO string, matching the key encoding) and the transport representation serve different purposes

## Errors

Errors are returned as an HTTP status and a body of `{ code, message, issues? }`, so that WAF, logs, and monitoring can decide by HTTP status.

| code              | HTTP | Original error                                                                                                                                                                                         |
| ----------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `INVALID_INPUT`   | 400  | Input validation failed (`ValidationError`). `issues` contains the Zod issues                                                                                                                          |
| `INVALID_CURSOR`  | 400  | `InvalidCursorError`                                                                                                                                                                                   |
| `UNAUTHENTICATED` | 401  | `UnauthenticatedError` (no authentication information, or it is invalid or expired. Thrown by `context` or `checkContext` of the server API. [Server API](../../zod-dynamodb-node/docs/server-api.md)) |
| `FORBIDDEN`       | 403  | `authorize` rejected the request                                                                                                                                                                       |
| `NOT_FOUND`       | 404  | `ItemNotFoundError` and `ConditionFailedError`. The message is "the Item does not exist or does not satisfy the condition" ([Writes](../../zod-dynamodb-node/docs/writes.md))                          |
| `ALREADY_EXISTS`  | 409  | `ItemAlreadyExistsError`                                                                                                                                                                               |
| `CONFLICT`        | 409  | `ConflictError` (retry limit) and an `ifUnchanged` mismatch                                                                                                                                            |
| `INTERNAL`        | 500  | Anything else. No message is returned                                                                                                                                                                  |

- Returning `FORBIDDEN` does not leak whether the Item exists, because `authorize` decides only from the parameters and the authentication context, without reading the Item ([Authentication and authorization](shared-definitions.md))
- Custom errors that the application throws inside `authorize` and the like are passed to the next Express error handler without conversion
