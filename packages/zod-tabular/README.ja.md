# @zodapp/zod-tabular

[English](README.md)

## 概要

`@zodapp/zod-tabular` は、Zod スキーマの値と、表の形のデータ（見出しの行を持つ 2 次元の配列）を行き来させます。CSV や Excel 向けです。

- `toTable(schema, rows)`：値 → 表。最初の行が見出し
- `fromTable(schema, table)`：表 → 値
- `tableToCsv(table)` / `csvToTable(csv)`：表 ↔ Excel で開ける CSV の文字列
- `formatCell(cell)`：1 つのセルを、CSV に書くときの文字にする

入れ子の object・配列・union は、列に平らに並べます。`@zodapp/zod-form-widget` の取り込みと書き出しのモーダルで使っています。

## インストール

```bash
pnpm add @zodapp/zod-tabular
```

## 要件

- Zod v4

## クイックスタート

```ts
import { z } from "zod";
import { toTable, fromTable, tableToCsv, csvToTable } from "@zodapp/zod-tabular";

const schema = z.object({
  name: z.string(),
  age: z.number().optional(),
  tags: z.array(z.string()).default([]),
  address: z.object({ city: z.string() }),
});

const table = toTable(schema, [
  { name: "Alice", age: 30, tags: ["a", "b"], address: { city: "Tokyo" } },
  { name: "Bob", tags: [], address: { city: "Osaka" } },
]);
// [
//   ["name", "age", "tags[0]", "tags[1]", "address.city"],
//   ["Alice", 30, "a", "b", "Tokyo"],
//   ["Bob", null, null, null, "Osaka"],
// ]

const csv = tableToCsv(table);
const rows = fromTable(schema, csvToTable(csv));
```

## 列

- object のフィールドは `親.子`、配列の要素は `items[0]`・`items[1]`…（いちばん長い配列の数だけ）の列になります
- union は、どの選択肢に合ったかを書く `.__TYPE__` の列を隣に足します（`u`・`u.__TYPE__`）
- 読むときは見出しの文字で列を探すので、列の順はスキーマと違ってもかまいません。スキーマに無い列は読みません
- オプションの `skip: (schema) => boolean` で、書くときも読むときも欄を表から外せます（`z.never()` の欄と同じ扱い）。`optional` などで包んだままの、欄の schema で呼びます

## 読むとき（`fromTable`）

- セルの値は、検証の前にスキーマの型に合わせます（数・真偽・日付・bigint）。合わせ方は、オプションの `numberConverter`・`booleanConverter`・`dateConverter`・`bigintConverter` で差し替えられます
- 行ごとに `schema.safeParse` で検証し、**通らない行はエラーにせず飛ばします**。見つけたいときは行の数を比べてください
- 空のセルは「値が無い」として読みます。必須の配列は、セルがすべて空だと通らないので、空になりうる配列には `.default([])` を付けてください（または optional にする）

## CSV

`tableToCsv` は、Excel でそのまま開ける CSV を書きます。BOM 付きの UTF-8、改行は CRLF、真偽は `TRUE` / `FALSE`、日付は `YYYY-MM-DD HH:mm:ss` です。`csvToTable` はそれを読みます（BOM の無い CSV も読めます）。

## エラー

表にできないスキーマでは、`toTable`・`fromTable` が `TabularError` を投げます。`code` は `ErrorCode` の `E_UNION_TYPE_COLLISION`（表の上で見分けられない union の選択肢）と `E_ID_OVERFLOW`（列が多すぎる）です。`.__TYPE__` のセルが壊れているとき（`E_INVALID_CONTROL_VALUE`）は投げず、その行をほかの通らない行と同じく飛ばします。

## API

- `toTable(schema, rows, options?)` / `fromTable(schema, table, options?)`
- `tableToCsv(table)` / `csvToTable(csv)` / `formatCell(cell)`
- `TabularError`、`ErrorCode`
- 型：`Table`、`TableCell`、`ToTableOptions`、`FromTableOptions`、`TableSchemaOptions`、`ToTableFn`、`FromTableFn`

## 関連

- `@zodapp/zod-form-widget`：このパッケージを使った取り込みと書き出しのモーダル

## ライセンス

MIT（[`LICENSE`](../../LICENSE)）
