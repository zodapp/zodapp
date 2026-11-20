# @zodapp/zod-form-mantine-lite

[English](README.md)

## 概要

`@zodapp/zod-form-mantine-lite` は、zod-form の Mantine の部品のうち、**TanStack Form に依存しない**ものの集まりです。`@zodapp/zod-form-mantine` と `@zodapp/zod-form-widget` はこの上に作っています。フォームの状態のライブラリなしで部品を使いたいときに、直接使います。

- `baseComponents`：どの componentLibrary でも使う部品（`optional`・`nullable`・`default`・`pipe`・`lazy`・`hidden` など）
- `tableComponentLibrary`：表のセルに値を出すための componentLibrary（読み取り専用）
- `reactiveComponentLibrary` / `ReactiveFormContextProvider`：送信のボタンを持たず、欄ごとに確定したらすぐ保存する「reactive」なフォームの componentLibrary
- `defaultMediaResolvers` / `DataBasedPreview` / `genericMediaResolver`：ファイルのプレビュー（画像・動画・音声と、それ以外はダウンロードのリンク）
- `./utils`：`BadgeSelect`・`ColorBadge`・`computeBadgeColors`・`ReadonlyText` などの部品と、enum の選択肢の補助
- `./messages`：文言の辞書 `en`・`ja`

送信のボタンのあるふつうのフォームには、`@zodapp/zod-form-mantine` か、`@zodapp/zod-form-widget` の `AutoForm` を使います。

## インストール

```bash
pnpm add @zodapp/zod-form-mantine-lite
```

## 要件

- React 18+ / 19+
- Zod v4
- Mantine 8 か 9（`@mantine/core`, `@mantine/hooks`, `@mantine/dates`）

## reactive なフォーム

`reactiveComponentLibrary` の欄は、編集のあいだは自分で値を持ち、確定したとき（変えた欄の横に出る確定のボタンか、Ctrl+Enter）に `ReactiveFormContextProvider` へ知らせます。Escape で編集を取り消します。

```tsx
import { Dynamic, ZodFormContextProvider } from "@zodapp/zod-form-react";
import {
  reactiveComponentLibrary,
  ReactiveFormContextProvider,
} from "@zodapp/zod-form-mantine-lite";

<ZodFormContextProvider componentLibrary={reactiveComponentLibrary}>
  <ReactiveFormContextProvider
    onConfirm={async ({ fieldPath, value }) => save(fieldPath, value)}
    onBlur={({ value, previousValue }) =>
      value === previousValue ? false : undefined
    }
  >
    <Dynamic fieldPath="" schema={schema} value={item} />
  </ReactiveFormContextProvider>
</ZodFormContextProvider>;
```

- `onConfirm({ fieldPath, value, previousValue })`：変えた欄を確定したときに呼びます
- `onBlur(...)`：確定していない変更のある欄からフォーカスが外れたときに呼びます。`true` を返すと確定、`false` なら元に戻し、`undefined` なら編集中のまま残します
- 確定していない変更が無いあいだは、親からの `value` の変更に追従します

`@zodapp/zod-form-widget` の `ReactiveAutoForm` は、これにレイアウトを付けたものです。

## 文言の言語（i18n）

文言は辞書のキー（`zodFormMantineLite.*`）で書いていて、Provider が無いときは英語です。日本語にするときは、`./messages` の `ja` を `@zodapp/i18n-messages-react` の `I18nMessagesProvider` に渡します（`@zodapp/zod-form-mantine` と `@zodapp/zod-form-widget` の `ja` には含まれています）。

## サブパス export

- `@zodapp/zod-form-mantine-lite`：上のすべて
- `@zodapp/zod-form-mantine-lite/baseComponents`・`/tableComponents`・`/reactiveComponents`：それぞれの componentLibrary と、個々の部品（`/baseComponents/*` など）
- `@zodapp/zod-form-mantine-lite/mediaResolvers`
- `@zodapp/zod-form-mantine-lite/utils`
- `@zodapp/zod-form-mantine-lite/messages`

## 関連

- `@zodapp/zod-form-react`：`Dynamic` と componentLibrary の仕組み
- `@zodapp/zod-form-mantine`：TanStack Form を使うフォームの componentLibrary
- `@zodapp/zod-form-widget`：`AutoForm`・`ReactiveAutoForm`・`AutoTable` など

## ライセンス

MIT（[`LICENSE`](../../LICENSE)）
