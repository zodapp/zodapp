# @zodapp/zod-transport-json

[English](README.md)

## 概要

`@zodapp/zod-transport-json` は、Zod スキーマに沿って、値と JSON を行き来させます。JSON に乗らない型（`Date`・`bigint`・`Set`・`Map`）は、送るときに JSON の値にし、受け取るときに戻します。

`createJsonTransport(schema)` が返すもの：

- `domainSchema`：渡したスキーマ（コードの中で使う形）
- `transportSchema`：そこから作った、JSON の形のスキーマ（受け取った値の検証や、API の文書を作るときに使えます）
- `encode(value, context?)`：値 → JSON にできる値
- `decode(input, context?)`：JSON の値 → スキーマの値

zodapp では、`@zodapp/zod-dynamodb` の HTTP とリアルタイムの通信で使っています。

## インストール

```bash
pnpm add @zodapp/zod-transport-json
```

## 要件

- Zod v4

## クイックスタート

```ts
import { z } from "zod";
import { createJsonTransport } from "@zodapp/zod-transport-json";

const schema = z.object({
  createdAt: z.date(),
  size: z.bigint(),
  tags: z.set(z.string()),
  counts: z.map(z.string(), z.number()),
});

const transport = createJsonTransport(schema);

const json = transport.encode({
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  size: 10n,
  tags: new Set(["a", "b"]),
  counts: new Map([["x", 1]]),
});
// { createdAt: "2026-01-01T00:00:00.000Z", size: "10", tags: ["a", "b"], counts: { x: 1 } }

const value = transport.decode(JSON.parse(JSON.stringify(json)));
// value.createdAt は Date、value.size は bigint、value.tags は Set、value.counts は Map
```

## 変換の決まり

| スキーマ | JSON |
| --- | --- |
| `z.date()` | オフセット付きの ISO 8601 の文字列。既定は UTC（`toISOString()`）。`context.timeZone` を渡すと、そのタイムゾーンで書く（`2026-01-01T09:00:00.000+09:00`） |
| `z.bigint()` | 文字列 |
| `z.set()` | 配列 |
| `z.map()` | object。キーが文字列のもの（string、文字列の literal・enum、それらの union）だけを扱い、それ以外は transport を作るときに例外を投げる |
| `z.object()`・`z.array()`・`z.tuple()`・`z.record()`・`z.union()`・`z.intersection()`・`optional`・`nullable`・`default`・`catch`・`readonly`・`pipe`・`lazy` | 構造を保ったまま、中を再帰で変換する |
| それ以外 | そのまま |

- `encode` は、値をスキーマで検証してから変換し、結果を `transportSchema` で検証します。`decode` は、入力を `transportSchema` で検証してから値を戻し、スキーマで検証します。どちらも失敗すると `ZodError` を投げます
- object の、値が `undefined` のフィールドは取り除きます
- スキーマの `description`（またはオプションの `descriptionResolver` の結果）を `transportSchema` に写します

## オプション

```ts
createJsonTransport(schema, {
  allowLocalDateTime: true, // decode で、オフセットのない日時も受け付ける
  descriptionResolver: (schema) => labelOf(schema), // transportSchema の description
});

transport.decode(input, { timeZone: "Asia/Tokyo" });
```

- `allowLocalDateTime`：`decode` で、オフセットのない日時（`2026-01-01T09:00:00`）を受け付けます。`context.timeZone` のタイムゾーンとして読むので、そのときは `context.timeZone` が要ります（無ければ例外を投げます）
- `context.timeZone`：IANA のタイムゾーン名。`encode` で日時を書くときと、`decode` でオフセットのない日時を読むときに使います

## API

- `createJsonTransport(domainSchema, options?)`
- 型：`JsonTransport`、`JsonTransportOptions`、`JsonTransportContext`

## 関連

- `@zodapp/zod-transform`：変換の土台（内部で利用）
- `@zodapp/zod-dynamodb`：通信でこのパッケージを使う

## ライセンス

MIT（[`LICENSE`](../../LICENSE)）
