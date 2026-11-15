# @zodapp/zod-form-widget

> この README は日本語版です。英語版は日本語レビュー・整合性チェック後に翻訳予定です。

## 概要

`@zodapp/zod-form-widget` は、`@zodapp/zod-form-mantine` の上に作った、画面でそのまま使えるウィジェットの集まりです。

- `AutoForm` / `ReactiveAutoForm` / `AutoSearch`：スキーマからフォームや検索欄を作る
- `AutoTable`：スキーマから一覧の表を作る（列の並べ替え・幅の変更・列設定の保存）
- `useImportModal` / `useExportModal` / `ImportPanel`：CSV などの取り込みと書き出し（`@zodapp/zod-tabular`）
- `useDeleteModal` / `FetchMore`：削除の確認と、続きの読み込み
- `jaErrorMap`：zod v4 のエラーメッセージを日本語にする errorMap

UI の文言は、いまは日本語で固定されています。

## インストール

```bash
pnpm add @zodapp/zod-form-widget
```

## 要件

- React 18+ / 19+
- Zod v4
- `@tanstack/react-form`
- Mantine（`@mantine/core`, `@mantine/hooks`, `@mantine/dates`, `@mantine/dropzone`）

## スタイルの読み込み

`AutoTable` などの CSS は JS から読み込まれません。アプリの入口で、Mantine の CSS のあとに読み込んでください。

```ts
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/dropzone/styles.css";
import "@zodapp/zod-form-widget/styles.css";
```

Mantine の `styles.layer.css`（`@layer mantine`）を使っている場合は、`@layer zodapp` で包んだ版を使えます。
`@layer` の中に入るので、アプリの CSS（`@layer` の外）から上書きできます。

```ts
import "@mantine/core/styles.layer.css";
import "@zodapp/zod-form-widget/styles.layer.css";
```

背景色などは Mantine のテーマ変数（`--mantine-color-body` など）を使うので、ダークモードにも追従します。
CSS のクラス名は公開 API ではありません。名前に依存した上書きはしないでください。

## エラーメッセージを日本語にする

`jaErrorMap` は import しただけでは何も変えません。`z.config` に渡してください。

```ts
import { z } from "zod";
import { jaErrorMap } from "@zodapp/zod-form-widget/i18n/ja";

z.config({ customError: jaErrorMap });
```

## 送信が止まったとき（`AutoForm`）

送信が止まると、ボタンの行の近くに理由を出します（`data-testid="form-submit-blocked"`）。当てはまるものをすべて出し、次に送信を押すまで出したままにします。送信が通れば消えます。

- 読み込み中の欄がある：「読み込み中の欄があるため、送信できませんでした」
- 取得できなかった欄がある：「取得できなかった欄があるため、送信できませんでした」
- 入力の誤りがある：「入力に誤りがあるため、送信できませんでした」

## サブパス export

- `@zodapp/zod-form-widget`：下のすべてと、`extendSchema` などの再 export
- `@zodapp/zod-form-widget/form`：`AutoForm`、`ReactiveAutoForm`、`AutoSearch`
- `@zodapp/zod-form-widget/table`：`AutoTable`、列設定の controller
- `@zodapp/zod-form-widget/tabular`：取り込みと書き出しのモーダル
- `@zodapp/zod-form-widget/feedback`：`useDeleteModal`、`FetchMore`
- `@zodapp/zod-form-widget/i18n/ja`：`jaErrorMap`
- `@zodapp/zod-form-widget/styles.css`、`@zodapp/zod-form-widget/styles.layer.css`

## 使用例

- `apps/form-demo`：`AutoForm`
- `apps/survey`：`AutoTable`、`AutoSearch`、取り込みと書き出し、削除の確認
- `apps/taskmanager`：列設定の保存（`useColumnSettingsProfileController`）

## 関連

- `@zodapp/zod-form`: `zf`（スキーマ拡張）
- `@zodapp/zod-form-mantine`: Mantine の componentLibrary
- `@zodapp/zod-tabular`: CSV / Excel の変換

## ライセンス

MIT（[`LICENSE`](./LICENSE)）
