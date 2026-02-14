# @zodapp/zod-propagating-registry

> この README は日本語版です。英語版は日本語レビュー・整合性チェック後に翻訳予定です。

## 概要

`@zodapp/zod-propagating-registry` は、**Zod v4 の registry 機構を使ってスキーマにメタデータを付与・取得するための薄いユーティリティ**です。

zodapp では、`label` や `uiType` などの UI 向けメタデータを Zod スキーマに付与する土台として使います（`@zodapp/zod-extendable` の内部実装で利用）。

## インストール

```bash
pnpm add @zodapp/zod-propagating-registry
```

## 要件

- Zod v4

## クイックスタート

```ts
import { z } from "zod";
import { zodPropagatingRegistry } from "@zodapp/zod-propagating-registry";

// 任意の名前（string または symbol）で registry を作る
const uiMeta = zodPropagatingRegistry<{ label?: string }>("uiMeta");

// Zod スキーマにメタを付与（Zod v4 の register を使用）
const nameSchema = z.string().register(uiMeta, { label: "名前" });

// 付与したメタを取り出す
const meta = uiMeta.getExtended(nameSchema);
// meta?.label === "名前"
```

### `getMeta` を使う場合

`getMeta(schema, metaIdKey)` は、**metaIdKey（Symbol）**を明示してメタを取得します。

```ts
import { z } from "zod";
import {
  zodPropagatingRegistry,
  getMeta,
} from "@zodapp/zod-propagating-registry";

const uiMeta = zodPropagatingRegistry<{ label?: string }>("uiMeta");

const schema = z.string().register(uiMeta, { label: "名前" });
const meta = getMeta(schema, Symbol.for("uiMeta"));
```

## API（抜粋）

- `zodPropagatingRegistry(name, fixedMeta?)`
- `getMeta(schema, metaIdKey)`
- `registry.add(schema, meta)` / `registry.getExtended(schema)`
- `type MetaOf<Registry>`

## 関連

- `@zodapp/zod-extendable`: メタ付与可能な Zod 拡張ファクトリ（zf の土台）
- `@zodapp/zod-form`: スキーマメタをフォーム用に標準化

## ライセンス

MIT（[`LICENSE`](../../LICENSE)）
