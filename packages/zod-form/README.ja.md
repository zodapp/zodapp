# @zodapp/zod-form

> この README は日本語版です。英語版は日本語レビュー・整合性チェック後に翻訳予定です。

## 概要

`@zodapp/zod-form` は、**React 非依存**で Zod スキーマにフォーム用メタデータを付与できるようにするためのパッケージです。

- `zf.*`: Zod v4 registry を用いた拡張ファクトリ（`label` / `uiType` / `readOnly` 等のメタ）
- `getMeta(schema)`: スキーマから付与されたメタデータを取り出す
- `externalKey` / `file`: 外部キー選択・ファイルアップロードのための型/設定を扱う土台（config はただのデータ。親や context で変えるときは `zf.dynamic` で包む。選択肢を取り直すかどうかは config を文字列にしたものと context の値で決まるので、関数だけが違う config に差し替えるときは config に `key` を書く）
- `computed` / `dynamic`: `{ value, parent, context }` を受け取る関数で、表示や実際に使う schema を実行時に決める
- `valueAction`: 選んだ値に対する操作（リンクで開くなど）の型
- `zf.time`: 時刻だけを持つ値（`z.iso.time()` と、0 時からの経過量を持つ `z.number()`）
- `createMockFileResolver`: ローカル開発用のモック（Data URL で保持）
- `createMockTopic` / `createMockExternalKeyResolver`: ローカル開発用の externalKey のモック。topic に入れた選択肢を届け、topic が変わるたびに届け直す。config の `filter(option, context)` で、`contextId` の resolverContext を使って絞れる

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

`apps/form-demo/src/pages/form/detail.tsx` でも、フォームのデモページ用に `createMockFileResolver()` を使っています。

## 選択肢に無い値（`unlisted`）

`zf.enum` / `zf.externalKey` の `unlisted` で、値が選択肢に無いときの扱いを決めます。

- `clear`（既定）: 値を消す
- `keep`: 値を残し、欄に「（不正な値）」と出してエラーにする。選択肢が戻れば元の表示に戻る

`clear` は、欄を表示した時点で消します。利用者が何も触らなくても、保存されていた値が選択肢に無ければ消え、そのまま保存すると消えた値で保存されます。選択肢を購読しているときは、編集中のフォームでも、誰かが選択肢からその値を外した時点で消えます。あとで選択肢が戻っても、消えた値は戻りません。値を失いたくないときは `keep` を使います。

フォームを開いただけで値が変わるかどうかは、仕組みによって違います。

- `z.preprocess`（`union` など）: 開いたときに値を整える
- `unlisted: "clear"`: 開いたときに、選択肢に無い値を消す
- 日付・時刻の精度: 開いただけでは書き換えない（利用者が編集したときだけ、欄の精度に合わせる）

## API（抜粋）

- `zf` / `getMeta`
- 関数を受け取る meta: `FnInput`, `FnSourceMeta`, `ComputedMetaDef`, `DynamicMetaDef`, `SchemaResolver`, `asRegistrySchemaResolver`, `defineDynamicMeta`
- 値の調整: `pruneValueToSchema`, `adaptValueToSchema`
- `valueAction` 型: `BaseValueActionConfig`, `ValueActionRegistry`, `RegisteredValueActionConfig`
- `externalKey` 型: `ExternalKeyResolverEntry`, `ExternalKeyResolvers`, `BaseExternalKeyConfig`, `RegisteredExternalKeyConfig`, ...
- `file` 型/関数: `FileResolverEntry`, `FileResolvers`, `BaseFileConfig`, `RegisteredFileConfig`, `parseMimeTypeFromUrl`, `createMockFileResolver`, ...

## 関連

- `@zodapp/zod-form-react`: React 依存の `Dynamic` / hooks / `zfReact`
- `@zodapp/zod-form-mantine`: Mantine UI の componentLibrary 実装
- `@zodapp/zod-form-firebase`: Firestore / Storage resolver

## ライセンス

MIT（[`LICENSE`](../../LICENSE)）

