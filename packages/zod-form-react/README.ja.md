# @zodapp/zod-form-react

> この README は日本語版です。英語版は日本語レビュー・整合性チェック後に翻訳予定です。

## 概要

`@zodapp/zod-form-react` は、`@zodapp/zod-form` のメタデータ付き Zod スキーマから **React でフォームUIを構築するための基盤**です。

- `Dynamic`: スキーマのメタ（`typeName` / `uiType`）からコンポーネントを解決して描画
- `ZodFormContextProvider`: `componentLibrary` / resolver などの依存を供給
- `useZodForm` / `FormProvider`: TanStack Form ベースのフォーム状態管理
- `zfReact`: `zf` に加えて、`message` / `computed`（表示専用）を提供
- `media`: 画像/動画/音声などのプレビュー解決（`MediaResolvers`）

Mantine UI をすぐ使う場合は `@zodapp/zod-form-mantine` が最短です。

## インストール

```bash
pnpm add @zodapp/zod-form-react
```

## 要件

- React 18+ / 19+
- Zod v4
- `@tanstack/react-form`

## クイックスタート（最小構成）

`Dynamic` は、`componentLibrary` のキーを `typeName`（例: `string`）または `typeName_uiType`（例: `string_password`）で解決します。

```tsx
import { z } from "zod";
import {
  Dynamic,
  FormProvider,
  ZodFormContextProvider,
  useZodForm,
  type ComponentLibrary,
} from "@zodapp/zod-form-react";
import { zf } from "@zodapp/zod-form";

const schema = z
  .object({
    name: zf.string().register(zf.string.registry, { label: "名前" }),
  })
  .register(zf.object.registry, {});

// 例: 自前の componentLibrary（実運用では各 typeName 分を実装します）
const componentLibrary: ComponentLibrary = {
  // key は `typeName` または `typeName_uiType`
  // value は `{ component }` を返す関数、またはその Promise を返す関数
  string: () => import("./components/stringField"),
  object: () => import("./components/objectField"),
};

export const MyForm = () => {
  const form = useZodForm({
    defaultValues: { name: "" },
    validators: {
      onChange: schema,
      onBlur: schema,
      onSubmit: schema,
    },
    onSubmit: ({ value }) => console.log(value),
  });

  return (
    <ZodFormContextProvider componentLibrary={componentLibrary}>
      <FormProvider form={form}>
        <Dynamic fieldPath="" schema={schema} />
      </FormProvider>
    </ZodFormContextProvider>
  );
};
```

## `zfReact`（message / computed）

`zfReact` は、`zf`（React 非依存）に加えて **表示専用のスキーマ型**を提供します。

```ts
import { z } from "zod";
import { zfReact } from "@zodapp/zod-form-react";

const schema = z
  .object({
    notice: zfReact
      .message()
      .register(zfReact.message.registry, { content: "補足メッセージ" }),
  })
  .register(zfReact.object.registry, {});
```

### `computed`（apps/web の例）

`computed` は、親オブジェクトの値を受け取って **表示用の値（ReactNode）**を計算できます。

`apps/web/src/pages/form/schemas/computed.ts` では次のように利用しています:

```ts
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";

export const schema = z.object({
  unitPrice: zf.number().min(0).register(zf.number.registry, { label: "単価" }),
  quantity: zf.number().min(0).register(zf.number.registry, { label: "数量" }),
  total: zfReact
    .computed()
    .register(zfReact.computed.registry, {
      label: "合計",
      compute: (parent) => {
        const unitPrice = parent?.unitPrice ?? 0;
        const quantity = parent?.quantity ?? 0;
        return `¥${(unitPrice * quantity).toLocaleString()}`;
      },
    })
    .optional(),
});
```

## フック / Provider（よく使うもの）

- **コンテキスト**
  - `useZodFormContext()`: `componentLibrary` / resolvers / timezone などにアクセス
  - `useExternalKeyResolver(config)`: `externalKeyResolvers` から該当 resolver を取得して実行
  - `useFileResolver(config)`: `fileResolvers` から該当 resolver を取得して実行
  - `useMediaResolvers()`: `mediaResolvers`（未指定なら `basicMediaResolvers`）を返す
- **フォーム/フィールド**
  - `useZodForm(...)`: TanStack Form ベースのフォーム作成
  - `useZodField(...)`, `useFormValues(...)`: フィールド/値参照のヘルパー
  - `useArray(fieldApi, fieldPath, discriminator?)`: 配列フィールドの insert/remove/append/move を扱うラッパー
- **遅延ロード/検証**
  - `useLazyFactory()`: Dynamic の lazy ロード戦略（デフォルトは `React.lazy`）
  - `useValidatePrecedingFields({ name, ref })`: フォーカス時に「前のフィールド」をまとめて検証（Providerが必要）

Provider コンポーネント:

- `ZodFormContextProvider`: `componentLibrary` / resolvers / timezone を供給
- `FormProvider`: `useZodForm` で作った form を供給
- `LazyProvider`: `useLazyFactory` の実装を差し替える
- `ValidatePrecedingFieldsProvider`: `useValidatePrecedingFields` を有効化する

## `basicMediaResolvers`

`basicMediaResolvers` は Mantine 非依存の最小セット（image/video/audio）です。`ZodFormContextProvider` に渡すか、`useMediaResolvers()` のデフォルトとして使われます。

> Mantine 版のフォールバック（汎用プレビュー等）は `@zodapp/zod-form-mantine` で提供します。

## API（抜粋）

- 描画/コンテキスト: `Dynamic`, `ZodFormContextProvider`
- フォーム状態: `useZodForm`, `FormProvider`, `useZodField`, `useFormValues`
- 追加フック/Provider: `useZodFormContext`, `useExternalKeyResolver`, `useFileResolver`, `useMediaResolvers`, `useArray`, `useLazyFactory`, `LazyProvider`, `ValidatePrecedingFieldsProvider`, `useValidatePrecedingFields`
- スキーマ拡張: `zfReact`, `getMetaReact`
- メディア: `MediaResolvers`, `basicMediaResolvers`, `imageMediaResolver` / `videoMediaResolver` / `audioMediaResolver`

## 関連

- `@zodapp/zod-form`: React 非依存の `zf`
- `@zodapp/zod-form-mantine`: Mantine UI 実装（`componentLibrary` 同梱）
- `@zodapp/zod-form-firebase`: Firestore / Storage resolver

## ライセンス

MIT（[`LICENSE`](../../LICENSE)）

