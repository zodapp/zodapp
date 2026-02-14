# @zodapp/zod-form-mantine

> この README は日本語版です。英語版は日本語レビュー・整合性チェック後に翻訳予定です。

## 概要

`@zodapp/zod-form-mantine` は、`@zodapp/zod-form-react` を **Mantine UI で使うための componentLibrary** を提供します。

- `componentLibrary`: フォーム描画用（Mantine）
- `tableComponentLibrary`: テーブル表示用（Mantine）
- `defaultMediaResolvers`: 画像/動画/音声 + `genericMediaResolver`（フォールバック）のプレビュー解決
- `DataBasedPreview`: URL からデータを取得して data-based preview コンポーネントに渡す中間コンポーネント
- `genericMediaResolver`: どの mimeType でも受けるフォールバック（ダウンロードリンク表示）

`@zodapp/zod-form` の `zf`（メタ付きスキーマ）と組み合わせて、スキーマから UI を自動生成します。

## インストール

```bash
pnpm add @zodapp/zod-form-mantine
```

## 要件

- React 18+ / 19+
- Zod v4
- `@tanstack/react-form`
- Mantine（`@mantine/core`, `@mantine/hooks`, `@mantine/dates`, `@mantine/dropzone`）

## クイックスタート（フォーム描画）

```tsx
import { z } from "zod";
import { Stack, Button } from "@mantine/core";
import { zf } from "@zodapp/zod-form";
import {
  componentLibrary,
  Dynamic,
  FormProvider,
  ZodFormContextProvider,
  ValidatePrecedingFieldsProvider,
  useZodForm,
} from "@zodapp/zod-form-mantine";

const schema = z
  .object({
    name: zf.string().register(zf.string.registry, { label: "名前" }),
  })
  .register(zf.object.registry, {});

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
        <ValidatePrecedingFieldsProvider>
          <Stack gap="md">
            <Dynamic fieldPath="" schema={schema} />
            <Button type="button" onClick={() => form.handleSubmit()}>
              送信
            </Button>
          </Stack>
        </ValidatePrecedingFieldsProvider>
      </FormProvider>
    </ZodFormContextProvider>
  );
};
```

## メディアプレビュー

ファイルフィールドのプレビューには `mediaResolvers` を渡します。Mantine 版のデフォルトは `defaultMediaResolvers` です。

### `DataBasedPreview` / `genericMediaResolver`

- `genericMediaResolver` は `mimeType: "*"` のフォールバックで、プレビューできないファイルでも **ダウンロードリンク**を表示できます。
- `DataBasedPreview` は、`fetch(url) -> ArrayBuffer` のように **URL から実データを取り出して**プレビューコンポーネントに渡したい場合に使います。

## 外部キー / ファイルResolver

外部キー（Firestore）やファイルアップロード（Firebase Storage）を使う場合は、`ZodFormContextProvider` に `externalKeyResolvers` / `fileResolvers` を渡します。

具体例は `@zodapp/zod-form-firebase` を参照してください。

## サブパス export

必要に応じて、次のサブパスからも import できます:

- `@zodapp/zod-form-mantine/componentLibrary`
- `@zodapp/zod-form-mantine/tableComponentsLibrary`
- `@zodapp/zod-form-mantine/mediaResolvers`

## apps/web での使用例

`apps/web` では `AutoForm` / `AutoTable` で、`componentLibrary` / `tableComponentLibrary` を `ZodFormContextProvider` に渡して `Dynamic` を描画しています。

- `apps/web/src/components/AutoForm.tsx`: `componentLibrary` + `useZodForm` + `FormProvider` + `ValidatePrecedingFieldsProvider`
- `apps/web/src/components/AutoTable.tsx`: `tableComponentLibrary` + `Dynamic`（computed は `defaultValue` に親オブジェクトを渡す）

## API（抜粋）

- `componentLibrary` / `tableComponentLibrary`
- `defaultMediaResolvers`
- `DataBasedPreview`, `genericMediaResolver`
- `Dynamic`, `ZodFormContextProvider`, `useZodForm`, `FormProvider`, ...

## 関連

- `@zodapp/zod-form`: `zf`（スキーマ拡張）
- `@zodapp/zod-form-react`: React 基盤（自前UIの場合）
- `@zodapp/zod-form-firebase`: Firestore / Storage resolver

## ライセンス

MIT（[`LICENSE`](../../LICENSE)）

