# @zodapp/zod-searchparams

> この README は日本語版です。英語版は日本語レビュー・整合性チェック後に翻訳予定です。

## 概要

`@zodapp/zod-searchparams` は、Zod スキーマに基づいて **URLSearchParams とオブジェクトを相互変換**するユーティリティです。

- `decodeSearchParams(searchParams, schema)`: URL → 型付きオブジェクト
- `encodeSearchParams(obj, schema?, validate?)`: オブジェクト → URL（スキーマなしでも変換可能）
- `searchParamsToParamsTree(searchParams)`: URL → `ParamsTree`（TanStack Router 統合向け）
- `fromParamsTree(paramsTree, schema)`: `ParamsTree` → 型付きオブジェクト（TanStack Router の `validateSearch` 向け）

Date / Set / Map / bigint など、URL に乗せにくい型も扱えるようにします。

## インストール

```bash
pnpm add @zodapp/zod-searchparams
```

## 要件

- Zod v4

## クイックスタート

### 直接使う（decode / encode）

```ts
import { z } from "zod";
import { decodeSearchParams, encodeSearchParams } from "@zodapp/zod-searchparams";

const schema = z.object({
  q: z.string().optional(),
  page: z.number().default(1),
  from: z.date().optional(),
});

// URL -> object
const params = decodeSearchParams(new URLSearchParams("page=2"), schema);
// params.page === 2

// object -> URL
const sp = encodeSearchParams({ q: "hello", page: 2, from: new Date("2025-01-01") }, schema);
// sp.toString() => "q=hello&page=2&from=20250101000000000"（例）
```

### TanStack Router で使う（推奨）

グローバル（Router）では **スキーマ非依存**の encode/decode を設定し、ルート単位で **スキーマによる型変換**だけを行うのがおすすめです。

```ts
import { createRouter, type RouterHistory } from "@tanstack/react-router";
import { encodeSearchParams, searchParamsToParamsTree } from "@zodapp/zod-searchparams";

export const createAppRouter = (history: RouterHistory) =>
  createRouter({
    routeTree,
    history,
    stringifySearch: (search) => {
      const str = encodeSearchParams(search).toString();
      return str ? `?${str}` : "";
    },
    parseSearch: (searchStr) => {
      return searchParamsToParamsTree(new URLSearchParams(searchStr));
    },
  });
```

各ルートでは `validateSearch` で `fromParamsTree` を呼びます:

```ts
import { z } from "zod";
import { fromParamsTree, type ParamsTree } from "@zodapp/zod-searchparams";

const searchSchema = z.object({
  dueAt: z
    .object({ $gte: z.date().optional(), $lte: z.date().optional() })
    .optional(),
});

validateSearch: (paramsTree: ParamsTree) => fromParamsTree(paramsTree, searchSchema)
```

## サポートされる型（主なもの）

- `z.string()` → そのまま
- `z.number()` → 文字列（`"42"`）
- `z.boolean()` → `"true"` / `"false"`
- `z.date()` → `YYYYMMDDHHmmssSSS`（UTC）
- `z.bigint()` → 文字列
- `z.array()` / `z.tuple()` / `z.set()` → インデックス形式（`items.0=...`）
- `z.map()` → キー形式（`map.key=value`）
- `z.object()` → ドット区切り（`user.name=...`）

### フィールド名に `.` が含まれる場合

`.` はパス区切りに使うため、フィールド名の `.` は `%2e` としてエスケープされます。

## API（抜粋）

- `decodeSearchParams(searchParams, schema)`
- `encodeSearchParams(obj, schema?, validate?)`
- `searchParamsToParamsTree(searchParams): ParamsTree`
- `fromParamsTree(paramsTree, schema)`

## 関連

- `@zodapp/zod-transform`: 変換エンジン（内部で利用）
- `@tanstack/react-router`: Router 統合例（このREADME参照）

## ライセンス

MIT（[`LICENSE`](../../LICENSE)）

