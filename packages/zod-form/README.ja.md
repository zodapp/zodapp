# @zodapp/zod-form

> この README は日本語版です。英語版は日本語レビュー・整合性チェック後に翻訳予定です。

## 概要

`@zodapp/zod-form` は、**React 非依存**で Zod スキーマにフォーム用メタデータを付与できるようにするためのパッケージです。

- `zf.*`: Zod v4 registry を用いた拡張ファクトリ（`label` / `uiType` / `readOnly` 等のメタ）
- `getMeta(schema)`: スキーマから付与されたメタデータを取り出す
- `externalKey` / `file`: 外部キー選択・ファイルアップロードのための型/設定を扱う土台
- `createMockFileResolver`: ローカル開発用のモック（Data URL で保持）

実際のフォーム描画（React コンポーネント）は `@zodapp/zod-form-react` / `@zodapp/zod-form-mantine` を使います。

## インストール

```bash
pnpm add @zodapp/zod-form
```

## 要件

- Zod v4

## クイックスタート（スキーマ定義）

```ts
import { z } from "zod";
import { zf } from "@zodapp/zod-form";

const userSchema = z
  .object({
    name: zf.string().register(zf.string.registry, { label: "名前" }),
    email: zf
      .string()
      .email()
      .register(zf.string.registry, { label: "メール" }),
    age: zf.number().min(0).register(zf.number.registry, { label: "年齢" }),
  })
  .register(zf.object.registry, {});

export type User = z.infer<typeof userSchema>;
```

## メタデータの取得

```ts
import { zf, getMeta } from "@zodapp/zod-form";

const schema = zf
  .string()
  .register(zf.string.registry, { label: "パスワード", uiType: "password" });

const meta = getMeta(schema);
// meta?.typeName === "string"
// meta?.label === "パスワード"
// meta?.uiType === "password"
```

## 外部キー / ファイル（型と設定の土台）

このパッケージは **設定型**を提供します。実際の解決（Firestore/Storage など）は別パッケージで提供します。

- 外部キー: `@zodapp/zod-form-firebase`（Firestore resolver）
- ファイル: `@zodapp/zod-form-firebase`（Firebase Storage resolver）

## 開発・テスト用: `createMockFileResolver`

アップロード先が未確定な段階や、UI 開発時の動作確認向けに、**実アップロードを行わない** file resolver を提供しています。

```ts
import { createMockFileResolver } from "@zodapp/zod-form";

const fileResolvers = [createMockFileResolver()];
```

`apps/web/src/pages/form/detail.tsx` でも、フォームのデモページ用に `createMockFileResolver()` を使っています。

## API（抜粋）

- `zf` / `getMeta`
- `externalKey` 型: `ExternalKeyConfig`, `ExternalKeyResolverEntry`, `ExternalKeyResolvers`, `BaseExternalKeyConfig`, `RegisteredExternalKeyConfig`, ...
- `file` 型/関数: `FileConfig`, `FileResolverEntry`, `FileResolvers`, `BaseFileConfig`, `RegisteredFileConfig`, `parseMimeTypeFromUrl`, `createMockFileResolver`, ...

## 関連

- `@zodapp/zod-form-react`: React 依存の `Dynamic` / hooks / `zfReact`
- `@zodapp/zod-form-mantine`: Mantine UI の componentLibrary 実装
- `@zodapp/zod-form-firebase`: Firestore / Storage resolver

## ライセンス

MIT（[`LICENSE`](../../LICENSE)）

