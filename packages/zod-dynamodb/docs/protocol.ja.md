# 通信の入出力とエラー

[English](protocol.md)

## リクエストとレスポンス

| 操作     | 入力                                                       | 出力                                                                                                          |
| -------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Get      | キー                                                       | `{ item: Item \| null, token? }`（トークンは常に返す。[書き込み](../../zod-dynamodb-node/docs/writes.ja.md)） |
| Create   | `{ key, input }`（生成するキーの場合は `{ args, input }`） | `{ item }`                                                                                                    |
| Set      | `{ key, input }`（`input` はItem全体）                     | `{ item }`                                                                                                    |
| Mutation | `{ key, params, ifUnchanged? }`                            | `{ item }`（After）                                                                                           |
| Delete   | `{ key }`                                                  | `{}`                                                                                                          |
| Query    | `{ params, cursor?, limit?, fields? }`                     | `{ items, cursor? }`                                                                                          |
| Search   | `{ params, fields? }`                                      | `{ results: { item, score }[] }`                                                                              |

- 入力は、受け取った側（サーバー）で操作のSchemaで検証する。Clientも、送る前に同じSchemaで検証する
- ブラウザの API の位置引数（[ブラウザの API](../../zod-dynamodb-client/docs/client-api.ja.md)）は、Clientがこの入力の形に直して送る
- `ifUnchanged` は、Getで受け取ったトークン（[書き込み](../../zod-dynamodb-node/docs/writes.ja.md)）である
- 出力の `item` は `z.output<Item>` であり、物理キー、エンティティ名、`version` を含まない（[各Schemaと型の役割](table-definition.ja.md)）
- `fields`（`{ pick }` か `{ omit }`）は、返すフィールドを絞る。キーのフィールドは常に返す。絞り込みはミドルウェアが結果に対して行うので、DynamoDBから読む量は変わらない。読む量を減らしたい場合は、Indexの射影（[物理レイアウト](physical-layout.ja.md)）を使う
- 出力のSchemaは、射影（`select: "projection"`）や `fields` で絞った結果では、itemのSchemaから返すフィールドだけを残して組み立てる。射影では、キーとIndexのキーのフィールドだけが必須で、それ以外は省略できる。組み立てられるのは、オブジェクト、union、intersectionで書いたitemのSchemaである

## 値の変換

JSONでは `Date`、`bigint`、`Set`、`Map` を表せない。HTTPの入出力の変換には、zodappの `@zodapp/zod-transport-json` を使う。

- `createJsonTransport(schema)` が、Schemaに沿って値とJSONを相互に変換する `encode` / `decode` と、JSONでの形を表すSchema（`transportSchema`）を返す。`Date` はタイムゾーン付きのISO文字列、`bigint` は文字列、`Set` は配列、`Map` はオブジェクトになる
- ライブラリは、エンドポイントごとに入力と出力のSchemaからtransportを作る。Clientは入力を `encode` して送り、出力を `decode` する。サーバーはその逆を行う
- `encode` / `decode` はどちらもSchemaで検証するので、サーバーが返す値も検証される
- DynamoDBへの保存の変換（[値の変換](physical-layout.ja.md)）とは別のものとする。保存の表現（`Date` はUTCのISO文字列。キーのエンコーディングと揃える）と、通信の表現は、目的が異なるためである

## エラー

エラーは、HTTPステータスと、bodyの `{ code, message, issues? }` で返す。WAF、ログ、監視がHTTPステータスで判断できるようにするためである。

| code              | HTTP | 元のエラー                                                                                                                                                                                        |
| ----------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INVALID_INPUT`   | 400  | 入力の検証の失敗（`ValidationError`）。`issues` にZodのissueを入れる                                                                                                                              |
| `INVALID_CURSOR`  | 400  | `InvalidCursorError`                                                                                                                                                                              |
| `UNAUTHENTICATED` | 401  | `UnauthenticatedError`（認証の情報がない、正しくない、期限が切れている。サーバーの API の `context` や `checkContext` が投げる。[サーバーの API](../../zod-dynamodb-node/docs/server-api.ja.md)） |
| `FORBIDDEN`       | 403  | `authorize` が拒否した                                                                                                                                                                            |
| `NOT_FOUND`       | 404  | `ItemNotFoundError` と `ConditionFailedError`。メッセージは「Itemが存在しないか、条件を満たしていない」とする（[書き込み](../../zod-dynamodb-node/docs/writes.ja.md)）                            |
| `ALREADY_EXISTS`  | 409  | `ItemAlreadyExistsError`                                                                                                                                                                          |
| `CONFLICT`        | 409  | `ConflictError`（再試行の上限）と、`ifUnchanged` の不一致                                                                                                                                         |
| `INTERNAL`        | 500  | それ以外。メッセージは返さない                                                                                                                                                                    |

- `FORBIDDEN` を返しても、Itemの有無は漏れない。`authorize` はItemを読まずに、パラメーターと認証コンテキストだけで判定するためである（[認証と認可](shared-definitions.ja.md)）
- アプリケーションが `authorize` などの中で投げた独自のエラーは、変換せずにExpressの次のエラーハンドラーに渡す
