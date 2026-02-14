# @zodapp/zod-transform

> この README は日本語版です。英語版は日本語レビュー・整合性チェック後に翻訳予定です。

## 概要

`@zodapp/zod-transform` は、Zod スキーマの構造に沿って **値の前処理（preprocess）/後処理（postprocess）を行うユーティリティ**です。

- `preprocess`: `unknown -> (Zod 形状に正規化された値)`（Zod の `parse` 前の整形向け）
- `postprocess`: `(Zod 形状の値) -> unknown`（保存/送信前の整形向け）
- `$remove(options?)`: 親コンテナから値を取り除くためのセンチネル（配列/タプルの挙動はオプションで調整可能）

## インストール

```bash
pnpm add @zodapp/zod-transform
```

## 要件

- Zod v4

## クイックスタート

### 非正規的なデータを正規化しつつ変換を行う(`preprocess`)

利用例：データベースからのデータ取得時、デシリアライズ、デフォルト値の取得

```ts
import { z } from "zod";
import { preprocess } from "@zodapp/zod-transform";

const schema = z.object({
  count: z.number(),
});

// unknown を整形（数値は Number へ）
const normalized = preprocess({ count: "42" }, schema, {
  number: (v) => Number(v),
});

// バリデーション責務は Zod.parse に委ねる
const parsed = schema.parse(normalized);
```

### 正規化されたデータを変換して、非正規的なデータに変換する(`postprocess`)

利用例：データベースへの保存処理、シリアライズ処理

```ts
import { z } from "zod";
import { postprocess } from "@zodapp/zod-transform";

const schema = z.object({
  createdAt: z.date(),
});

const out = postprocess(
  { createdAt: new Date("2026-01-01T00:00:00.000Z") },
  schema,
  {
    date: (v) => v.toISOString(),
  },
);
// out は { createdAt: "2026-01-01T00:00:00.000Z" } のようになる
```

### （高度）`processor` について

`processor` は、スキーマ形状の **トラバース（走査）中**に呼ばれるフックです。通常のユースケースでは `preprocess` / `postprocess` だけで十分なことが多く、`processor` は次のような **挙動を変えたい場合**に使います（`TransformOption.processor` として渡します）。

- **トラバース仕様の変更**: object / array / tuple 等の走査方法を差し替えたい
- **走査中の変換**: ある型だけ独自の変換を入れたい（必要に応じて `context.transform(value, childSchema)` で再帰）
- **`$remove()` の利用**: 親コンテナから値を取り除きたい場合、該当ノードの `processor` から `$remove()` を返します

### 変換結果からフィールドを取り除く（`$remove()`）

`$remove()` は、親コンテナ（object / record / map / set 等）から値を取り除くためのプレースホルダです。
配列/タプルの場合は、`$remove({ array: null })` のようにオプションで「要素を消す/置き換える」を調整できます。

```ts
import { z } from "zod";
import { preprocess, $remove } from "@zodapp/zod-transform";

const schema = z.object({ a: z.string(), b: z.string().optional() });

const out = preprocess({ a: "keep", b: "drop" }, schema, {}, {
  processor: { string: (v) => (v === "drop" ? $remove() : v) },
});
// out は { a: "keep" } になる
```

## 運用上の注意事項（重要）

- **副作用禁止**: すべての処理は同一スキーマ・同一値に対して複数回実行され得ます。getter / setter / 外部状態参照 / 破壊的変更などの Side Effect を持つ処理を定義しないでください。
- **record のキー制約**: `z.record` のキーは変換しません（値のみが transform 対象）。キーは `string` かつ enumerable なもののみを対象とします。
- **object のキー制約**: `ZodObject` のキーは `string` かつ enumerable なもののみを対象とします。catchall を含め、`Symbol` キーは対象外です（`z.object` の仕様に準拠）。
- **intersection のマージ仕様**: intersection は left / right を独立して transform し、shallow merge（`{ ...left, ...right }`）します。そのため left 側で `$remove` が発生しても、right 側に同じキーが存在すれば復活します。
- **class instance は変換対象外**: `ZodObject` に class instance が与えられた場合、変換はせずそのまま通過します（enumerable なものも変換しません）。
- **getter の実行に注意**: object のキーに getter が定義されている場合、`Object.entries` 等により getter が実行されます。getter に副作用がある設計は避けてください。
- **`z.catch` の前提**: `z.catch` の `catchValue` は Zod の型契約上 `innerType` を満たす値を返すことが期待されています。本実装もそれを前提とし、これに違反する schema の挙動は保証しません。catch 対象に union が含まれる場合、union の全要素に当てはまらなければ catch が呼ばれますが、その際のエラー情報は本来の Zod のエラー情報と異なるので注意してください。
- **暗黙的な呼び出し**:
  - `"nullable"` で `null` の場合、`"null"` ハンドラを呼びます
  - `"optional"` で `undefined` の場合、`"undefined"` ハンドラを呼びます
  - ただし `z.default` の場合は、preprocess で `undefined` だった場合に追加で何も呼びません
- **`$remove` の挙動**: preprocess / postprocess は `$remove` を返せます。`$remove` は上位オブジェクトでその要素を取り除きますが、コンテクストによって挙動が異なります。
  - set / map / object / record: 要素を完全に取り除きます（変更不可）
  - array / tuple: `undefined` に変換します（オプションで挙動変更可能）
  - union: 最終的な戻り値の場合は `undefined` に変換します

## 設計上の方針

- preprocess / postprocess は `parse` の代替ではありません。バリデーション責務は `Zod.parse` に委ね、本ライブラリは「構造変換・値変換」にのみ責務を限定します。
- union / optional / nullable 等の判定のため内部的に `safeParse` を使用する場合がありますが、その結果を preprocess / postprocess の出力に直接混在させることはしません。
- preprocess は「`unknown -> z.infer<T>`」の変換、postprocess は「`z.infer<T> -> unknown`」の変換を行うものとします。

## API（抜粋）

- `preprocess(obj, schemaOrSchemas, preprocessor, transformOption?)`
- `postprocess(obj, schemaOrSchemas, postprocessor, transformOption?)`
- `$remove(options?)` / `$$remove`（配列要素の除去用センチネル）

## 関連

- `@zodapp/zod-searchparams`: URLSearchParams への変換（Zod スキーマ駆動）
- `@zodapp/zod-form`: フォーム入力の正規化で利用

## ライセンス

MIT（[`LICENSE`](../../LICENSE)）
