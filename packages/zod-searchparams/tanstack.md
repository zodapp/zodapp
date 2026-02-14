# TanStack Router での zod-searchparams 利用ガイド

このガイドでは、`@zodapp/zod-searchparams` を TanStack Router と組み合わせて使用する方法を説明します。

## 概要

`zod-searchparams` は、Zod スキーマと URLSearchParams の双方向変換を行うライブラリです。TanStack Router と組み合わせることで、Date, Set, Map などの複雑な型を URL パラメータとして扱えます。

### エンコード/デコードの役割分担

| 処理       | 設定場所                            | 関数                               | スキーマ |
| ---------- | ----------------------------------- | ---------------------------------- | -------- |
| エンコード | `createRouter` の `stringifySearch` | `encodeSearchParams(obj)`          | 不要     |
| パース     | `createRouter` の `parseSearch`     | `searchParamsToParamsTree(params)` | 不要     |
| 型変換     | 各ルートの `validateSearch`         | `fromParamsTree(tree, schema)`     | 必要     |

この役割分担により:

- **navigate / Link**: 何も考えずにオブジェクトを渡すだけ（自動エンコード）
- **URL パース**: ネスト構造を自動復元（グローバル設定）
- **ルート定義**: スキーマによる型変換のみ（シンプル）

## セットアップ

### 1. Router 設定（グローバル）

`createRouter` に `stringifySearch` と `parseSearch` を設定します:

```typescript
// router.tsx
import { createRouter, type RouterHistory } from "@tanstack/react-router";
import {
  encodeSearchParams,
  searchParamsToParamsTree,
} from "@zodapp/zod-searchparams";

export const createAppRouter = (history: RouterHistory) =>
  createRouter({
    routeTree,
    history,
    // エンコード: オブジェクト → URL文字列（スキーマ非依存）
    stringifySearch: (search) => {
      return encodeSearchParams(search).toString();
    },
    // パース: URL文字列 → ParamsTree（スキーマ非依存）
    parseSearch: (searchStr) => {
      return searchParamsToParamsTree(new URLSearchParams(searchStr));
    },
  });
```

### 2. ルート定義（個別）

各ルートの `validateSearch` で、スキーマを使って型変換のみ行います:

```typescript
// tasks.route.ts
import { createRoute } from "@tanstack/react-router";
import { z } from "zod";
import { fromParamsTree, type ParamsTree } from "@zodapp/zod-searchparams";

// 検索条件スキーマ（Date 型を含む）
const searchSchema = z.object({
  status: z.enum(["todo", "doing", "done"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueAt: z
    .object({
      $gte: z.date().optional(),
      $lte: z.date().optional(),
    })
    .optional(),
});

export const tasksRoute = createRoute({
  getParentRoute: () => parentRoute,
  path: "tasks",
  // ParamsTree → 型付きオブジェクト（スキーマ依存）
  validateSearch: (paramsTree: ParamsTree) =>
    fromParamsTree(paramsTree, searchSchema),
  component: TasksPage,
});
```

## 使用方法

### ナビゲーション

`stringifySearch` でグローバル設定しているため、`navigate` や `Link` ではオブジェクトをそのまま渡すだけです:

```typescript
import { useNavigate, useSearch } from "@tanstack/react-router";

const TasksPage = () => {
  const search = useSearch({ from: tasksRoute.id });
  const navigate = useNavigate({ from: tasksRoute.id });

  // Date オブジェクトをそのまま渡せる（自動エンコード）
  const handleFilterChange = (status: string, from: Date, to: Date) => {
    navigate({
      search: {
        status,
        dueAt: { $gte: from, $lte: to },
      },
    });
  };

  return (
    // ...
  );
};
```

### Link コンポーネント

```typescript
import { Link } from "@tanstack/react-router";

// Date や複雑な型をそのまま渡せる
<Link
  to="/tasks"
  search={{
    status: "todo",
    dueAt: {
      $gte: new Date("2025-01-01"),
      $lte: new Date("2025-12-31"),
    },
  }}
>
  タスク一覧
</Link>
```

## サポートされる型とエンコード形式

| Zod 型          | URL パラメータ形式   | 例                           |
| --------------- | -------------------- | ---------------------------- |
| `z.string()`    | そのまま             | `name=John`                  |
| `z.number()`    | 文字列化             | `count=42`                   |
| `z.boolean()`   | `"true"` / `"false"` | `active=true`                |
| `z.date()`      | `YYYYMMDDHHmmssSSS`  | `date=20250313005222213`     |
| `z.bigint()`    | 文字列化             | `big=12345678901234567890`   |
| `z.null()`      | `"null"`             | `value=null`                 |
| `z.undefined()` | `"undefined"`        | `value=undefined`            |
| `z.array()`     | インデックス記法     | `items.0=a&items.1=b`        |
| `z.tuple()`     | インデックス記法     | `pair.0=x&pair.1=42`         |
| `z.set()`       | インデックス記法     | `tags.0=a&tags.1=b`          |
| `z.map()`       | キー記法             | `map.key1=v1&map.key2=v2`    |
| `z.object()`    | ドット記法           | `user.name=John&user.age=30` |

## 実践的な使用例

### 日付範囲フィルター

```typescript
const dateRangeSchema = z.object({
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

// ナビゲーション（エンコードは自動）
navigate({
  search: {
    startDate: new Date("2025-01-01"),
    endDate: new Date("2025-12-31"),
  },
});

// URL結果: startDate=20250101000000000&endDate=20251231235959999
```

### 複雑なフィルター条件

```typescript
const filterSchema = z.object({
  status: z.set(z.enum(["active", "pending", "closed"])).optional(),
  assignees: z.array(z.string()).optional(),
  tags: z.map(z.string(), z.boolean()).optional(),
  dateRange: z
    .object({
      from: z.date().optional(),
      to: z.date().optional(),
    })
    .optional(),
});

// ナビゲーション（エンコードは自動）
navigate({
  search: {
    status: new Set(["active", "pending"]),
    assignees: ["user1", "user2"],
    tags: new Map([
      ["urgent", true],
      ["feature", false],
    ]),
    dateRange: {
      from: new Date("2025-01-01"),
      to: new Date("2025-12-31"),
    },
  },
});

// URL結果:
// status.0=active&status.1=pending&
// assignees.0=user1&assignees.1=user2&
// tags.urgent=true&tags.feature=false&
// dateRange.from=20250101000000000&dateRange.to=20251231235959999
```

### ページネーションとソート

```typescript
const paginationSchema = z.object({
  page: z.number().default(1),
  limit: z.number().default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

// ページ切り替え（エンコードは自動）
const handlePageChange = (page: number) => {
  navigate({
    search: { ...currentParams, page },
  });
};
```

## 注意点

### 1. transform を含むスキーマの扱い

`z.transform()` を使用したスキーマでは、変換が非可逆な場合にラウンドトリップで値が変わる可能性があります:

```typescript
// 注意: この例は非可逆な変換
const schema = z.object({
  doubled: z.string().transform((s) => Number(s) * 2),
});

// encode 前に parse() で値を正規化してから使用
const parsed = schema.parse({ doubled: "21" }); // { doubled: 42 }
```

### 2. ドットを含むフィールド名

フィールド名に `.` が含まれる場合、自動的にエスケープされます:

```typescript
const schema = z.object({
  "foo.bar": z.string(),
});

// エンコード結果: foo%2ebar=value
```

## API リファレンス

### エクスポートされる関数・型

```typescript
// 高レベルAPI（従来の使い方）
decodeSearchParams(searchParams, schema): T
encodeSearchParams(obj, schema?, validate?): URLSearchParams

// 低レベルAPI（TanStack Router 統合用）
searchParamsToParamsTree(searchParams): ParamsTree  // スキーマ非依存
fromParamsTree(paramsTree, schema): T               // スキーマ依存

// 型
type ParamsTree = { [key: string]: ParamsTreeItem }
```
