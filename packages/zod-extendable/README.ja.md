# @zodapp/zod-extendable

> この README は日本語版です。英語版は日本語レビュー・整合性チェック後に翻訳予定です。

## 概要

`@zodapp/zod-extendable` は、Zod v4 のスキーマに **メタデータを付与して、後から取り出せるようにする**ためのユーティリティです。
`extendCustom` で ファクトリー関数(例：z.stringを渡すと)、その返り値にはメタ用の registry（`@zodapp/zod-propagating-registry`）が付属します。これは、ZodRegistryを継承しているため、zod標準の文法でメタデータを付与できます。
z.string, z.number, z.boolean, z.date, z.array, z.object, z.union, z.enum, z.literal, z.tuple, z.record, z.set, z.bigintなど、標準的なファクトリに対する、拡張ファクトリをextendString, extendNumber, extendBoolean, extendDate, extendArray, extendObject, extendUnion, extendEnum, extendLiteral, extendTuple, extendRecord, extendSet, extendBigintなどが準備されています。

- **付与**: `schema.register(factory.registry, meta)`
- **取得（基本）**: `factory.registry.get(schema)`（`typeName` などの固定メタも合成されます）
- **取得（補助）**: `getMeta(schema)`（registry を手元に持っていない場面向け。内部キー `Symbol.for("zodExtendable")` 経由でメタを取得できます。型安全にする場合は registry 型を指定）

ほとんどの `extend*` は内部で `z.*` をそのまま呼ぶ薄いラッパーです。
ただし **`z.enum` だけは引数が「値の配列」**で、`z.literal(...)` に付けたメタを enum から辿れる形で持ち回るには工夫が必要です。
そのため `extendEnum()`（`e.enum` 相当）は「literal タプル → values へ変換」しつつ、option の literal スキーマへ辿れる `schemas` を自動登録します（後述）。

zodapp では、この仕組みを土台にしてフォーム生成用の `zf`（`@zodapp/zod-form`）を構築しています。

## インストール

```bash
pnpm add @zodapp/zod-extendable
```

## 要件

- Zod v4

## クイックスタート

### 1) 文字列スキーマにメタを付与する

```ts
import z from "zod";
import { extendString } from "@zodapp/zod-extendable";

// 付与したいメタ型を指定して「拡張ファクトリ」を作る
// exString() 自体は z.string() と同じスキーマを返す
const exString = extendString<{ label?: string }>();

const userSchema = z.object({
  name: exString().register(exString.registry, { label: "名前" }),
});

// registry からメタを取得（固定メタの typeName も合成される）
const meta = exString.registry.get(userSchema.shape.name);
// meta?.typeName === "string"
// meta?.label === "名前"
```

### `getMeta()` を直接使う

基本は `registry.get(schema)` ですが、registry を手元に持っていない場面では `getMeta()` でも同じメタデータを取得できます。

`@zodapp/zod-extendable` の `getMeta` は型推論のために registry 型を指定できるようになっています:

```ts
import { extendString, getMeta } from "@zodapp/zod-extendable";

const exString = extendString<{ label?: string }>();
const s = exString().register(exString.registry, { label: "名前" });

const meta1 = exString.registry.get(s);
const meta2 = getMeta<typeof s, typeof exString.registry>(s);
// meta1 と meta2 は同じ内容
```

### 2) enum（ラベル付きリテラル）を作る

```ts
import { extendEnum, extendLiteral } from "@zodapp/zod-extendable";

const exLiteral = extendLiteral<{ label?: string }>();
const exEnum = extendEnum<{ label?: string }>();

const roleSchema = exEnum([
  exLiteral("admin").register(exLiteral.registry, { label: "管理者" }),
  exLiteral("user").register(exLiteral.registry, { label: "一般ユーザー" }),
] as const).register(exEnum.registry, { label: "ロール" });

const roleMeta = exEnum.registry.get(roleSchema);
// roleMeta?.label === "ロール"

// 各 option のスキーマ（= literal）に辿れる
const adminLit = roleMeta?.schemas?.admin;
const adminMeta = adminLit ? exLiteral.registry.get(adminLit) : undefined;
// adminMeta?.label === "管理者"
```

### `extendEnum()`（`e.enum` 相当）の仕様

- **入力**: 文字列の `z.literal(...)` スキーマのタプル（`readonly [z.ZodLiteral<string>, ...]` / 最低 1 要素。順序を保持）
- **第2引数**: `params` は `z.enum(values, params)` の `params` と同じ
- **出力**: `z.enum(values, params)` と同じ `z.ZodEnum`（`parse()` の挙動も同等）
- **変換**: `literals[i].value` から `values: string[]` を作って `z.enum(values, params)` を呼び出す
- **自動登録**: 生成した enum スキーマに対して **常に** `{ schemas }` を `extendEnum()` が返す registry（上の例では `exEnum.registry`）へ登録する
  - `schemas` は `{ [value: string]: z.ZodLiteral<string> }` のマップで、元の literal スキーマを保持します
  - これにより、enum から各 option の literal へ辿り、`extendLiteral().registry.get(...)` で option 側メタを取得できます
- **2 段メタ**: メタは「option（literal）レベル」と「enum レベル」の両方に付与できます
  - option: `extendLiteral()` の registry へ登録（例: `{ label: "管理者" }`）
  - enum: `extendEnum()` の registry へ登録（例: `{ label: "ロール" }`）
  - enum レベルのメタ型は `Partial<TMeta> & { schemas?: ... }` です（`schemas` を自動登録するため、任意項目扱い）
- **注意**: `schemas` は `extendEnum()` が内部で使う予約キーです（自前メタでも同名キーを使うと衝突します）

## API（抜粋）

- `extendCustom(factory, typeName, metaSchema?)`
- `extendString(metaSchema?)` / `extendNumber(metaSchema?)` / `extendBigint(metaSchema?)` / `extendDate(metaSchema?)` / `extendBoolean(metaSchema?)`
- `extendArray(metaSchema?)` / `extendTuple(metaSchema?)` / `extendRecord(metaSchema?)` / `extendSet(metaSchema?)` / `extendObject(metaSchema?)` / `extendUnion(metaSchema?)`
- `extendEnum(metaSchema?)` / `extendLiteral(metaSchema?)`
- `schemaType()`（型推論用センチネル）
- `getMeta(schema)`（メタ取得）

## 関連

- `@zodapp/zod-propagating-registry`: registry 実装
- `@zodapp/zod-form`: `zf`（フォーム用の標準メタ）

## ライセンス

MIT（[`LICENSE`](../../LICENSE)）
