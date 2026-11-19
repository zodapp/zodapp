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

外部キーやファイルアップロードを使う場合は、`ZodFormContextProvider` に `externalKeyResolvers` / `fileResolvers` を渡します。

具体例は、外部キーは `@zodapp/zod-form-dynamodb`（DynamoDB から選択肢を読む）、ファイルは `@zodapp/zod-form-s3`（S3 に保存する）を参照してください。

## サブパス export

必要に応じて、次のサブパスからも import できます:

- `@zodapp/zod-form-mantine/componentLibrary`
- `@zodapp/zod-form-mantine/tableComponentsLibrary`
- `@zodapp/zod-form-mantine/mediaResolvers`
- `@zodapp/zod-form-mantine/messages`（文言の辞書 `ja`・`en`）

## apps/form-demo での使用例

`apps/form-demo` では `AutoForm` / `AutoTable` で、`componentLibrary` / `tableComponentLibrary` を `ZodFormContextProvider` に渡して `Dynamic` を描画しています。

- `apps/form-demo/src/components/AutoForm.tsx`: `componentLibrary` + `useZodForm` + `FormProvider` + `ValidatePrecedingFieldsProvider`
- `apps/form-demo/src/components/AutoTable.tsx`: `tableComponentLibrary` + `Dynamic`（行の値は `TableRowProvider` で渡し、computed / dynamic はそこから `parent` を受け取る）

## 文言の言語（i18n）

部品の文言は辞書のキー（`zodFormMantine.*`・`zodFormMantineLite.*`）で書いています。Provider が無いときは英語です。日本語にするときは、`@zodapp/i18n-messages-react` の `I18nMessagesProvider` に `./messages` の `ja` を渡します。`ja` には zod-form-mantine-lite・zod-form-react と zod のエラーの辞書も含まれ、import すると dayjs の ja ロケールも読み込みます。日付の欄のロケールは `I18nMessagesProvider` の `locale` に従います。

```tsx
import { I18nMessagesProvider } from "@zodapp/i18n-messages-react";
import { ja } from "@zodapp/zod-form-mantine/messages";

<I18nMessagesProvider locale="ja" messages={ja}>
  <App />
</I18nMessagesProvider>;
```

一部だけ変えるときは、辞書を配列で重ねて渡します（後ろが勝ちます）。

## フォームで使えないキー

フォームの欄はフィールドパス（`a.b[0].c`）で指すため、`.`・`[`・`]` を含むキーと空文字のキーは欄にできない。

- `z.object` の shape や、キーの決まった record（`z.record(z.enum([...]), …)`）のキーにあれば、その欄の場所に「このキー名は使えません」と出し、`console.error` にも理由を出す
- record の entries の見た目では、そのキーを入れるとエラーにし、値に入れない
- record に保存されていた値にあれば、その要素は編集できない行（キー・注記・その要素のエラー・消すボタン）として出す。値は表示せず、変えずにそのまま送る
- 注意：値が object の record で、キー `a` と `a.b` が同時にあると、エラーの名前が重なり、どちらの要素のエラーかを見分けられない

## API（抜粋）

- `componentLibrary` / `tableComponentLibrary`
- `defaultMediaResolvers`
- `DataBasedPreview`, `genericMediaResolver`
- `Dynamic`, `ZodFormContextProvider`, `useZodForm`, `FormProvider`, ...

## 関連

- `@zodapp/zod-form`: `zf`（スキーマ拡張）
- `@zodapp/zod-form-react`: React 基盤（自前UIの場合）
- `@zodapp/zod-form-dynamodb`: externalKey の選択肢を DynamoDB（`@zodapp/zod-dynamodb`）から読む resolver
- `@zodapp/zod-form-s3`: ファイル（`zf.externalFile`）を S3 に保存する resolver（サーバー側は `@zodapp/zod-form-s3-node`）
- 仕様の詳細：[object の入れ物](docs/object.ja.md)、[zf.intersection](docs/intersection.ja.md)、[zf.union](docs/union.ja.md)、[バッジで出す選択](docs/badge.ja.md)、[zod の型ごとの描き方](docs/schema-types.ja.md)

## ライセンス

MIT（[`LICENSE`](../../LICENSE)）

