# @zodapp/zod-form-widget

[English](README.md)

## 概要

`@zodapp/zod-form-widget` は、`@zodapp/zod-form-mantine` の上に作った、画面でそのまま使えるウィジェットの集まりです。

- `AutoForm` / `ReactiveAutoForm` / `AutoSearch`：スキーマからフォームや検索欄を作る
- `AutoTable`：スキーマから一覧の表を作る（列の並べ替え・幅の変更・列設定の保存）
- `useImportModal` / `useExportModal` / `ImportPanel`：CSV などの取り込みと書き出し（`@zodapp/zod-tabular`）
- `useDeleteModal` / `FetchMore`：削除の確認と、続きの読み込み
- `en` / `ja`（`./messages`）：UI の文言と zod のエラーの辞書

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

## 文言の言語（i18n）

Provider が無いときの文言は英語です。日本語にするときは、アプリのルートを `@zodapp/i18n-messages-react` の `I18nMessagesProvider` で包み、`./messages` の `ja` を渡します。`ja` には、依存するパッケージ（zod-form-mantine・zod-form-mantine-lite・zod-form-react）と zod のエラー（`@zodapp/i18n-messages-zod`）の辞書も含まれます。

```tsx
import { I18nMessagesProvider } from "@zodapp/i18n-messages-react";
import { ja } from "@zodapp/zod-form-widget/messages";

<I18nMessagesProvider locale="ja" messages={ja}>
  <App />
</I18nMessagesProvider>;
```

一部だけ変えるときは、辞書を重ねて渡します（後ろの辞書が勝ちます）。props で文言を渡したとき（`submitLabel` など）は、props が辞書より優先します。

```tsx
<I18nMessagesProvider
  locale="ja"
  messages={[ja, { "zodFormWidget.autoForm.submit": "登録" }]}
>
```

`AutoForm`・`AutoSearch` は、zod のエラーを辞書のキー（`zod.*`）にして検証するので、`z.config` で errorMap を設定する必要はありません。schema に書いた文言（`.min(3, "…")`）はそのまま出ます。辞書のキーを書けば訳されます（`@zodapp/i18n-messages` の README を参照）。

表の列の見出し（meta の `label`）、保存先の名前（`groupLabel`・`label`）も、辞書のキーなら訳します。

`parseDynamicTabularFile` は、CSV を読めないとき `TabularImportError`（`code`: `"emptyFile" | "noHeader" | "noRows"`）を投げます。`message` は辞書のキーです。

## 開くときの値（`AutoForm`）

`AutoForm` は、受け取った `defaultValues` を `getDefaultValue(schema, defaultValues)` に通してから使います（`defaultValues` が無ければ `getDefaultValue(schema)`）。

- 値が無いところを schema の既定値で補います：`.default()`・`.prefault()` の値、空の配列・object・Set・Map、値が 1 つの literal、`z.nan()` の NaN、`z.undefined()`・`z.void()` のキーなど。渡した値はそのまま使い、無いキーだけを補います
  - NaN は JSON にすると null になります。サーバーへの送信や DynamoDB への保存では NaN のまま届かないので、`z.nan()`・`z.literal(NaN)` はフォームの中だけで使ってください
- 補った値は既定値に入るので、開いただけでは「変更あり」になりません
- 必須の object・intersection・配列は `{}`・`[]` で始まります（空で始めることはできません）
- `onSubmit`・`onCancel` に渡る値にも、補ったキー（空の配列など）が入ります
- 補えない schema（optional の付かない `z.lazy` の再帰など）では、補わずに渡された値を使い、`console.error` を出します
- `AutoSearch` と `ReactiveAutoForm` は補いません

## 送信が止まったとき（`AutoForm`）

送信が止まると、ボタンの行の近くに理由を出します（`data-testid="form-submit-blocked"`）。当てはまるものをすべて出し、次に送信を押すまで出したままにします。送信が通れば消えます。

- 読み込み中の欄がある：「読み込み中の欄があるため、送信できませんでした」（`zodFormWidget.autoForm.blocked.loading`）
- 取得できなかった欄がある：「取得できなかった欄があるため、送信できませんでした」（`zodFormWidget.autoForm.blocked.failed`）
- 入力の誤りがある：「入力に誤りがあるため、送信できませんでした」（`zodFormWidget.autoForm.blocked.input`）

## 表の並べ替え（`AutoTable`）

見出しを押すと、列の種類ごとに次の基準で並べます。

- 数・日付・文字・真偽：値で並べる（suggestions 付きの文字も、表示名ではなく値の文字で並べる）
- externalKey：保存している値（ID）で並べる。表示名（ラベル）では並べない
- enum：選択肢を定義した順。選択肢に無い値は最後
- computed：計算した値で並べる（文字・数・真偽・日付のとき。link・badge などのオブジェクトは、画面に出る文字（label）で並べる。それ以外は最後）
- dynamic：並べ替えない（行ごとに意味が変わるため）

## サブパス export

- `@zodapp/zod-form-widget`：下のすべてと、`extendSchema` などの再 export
- `@zodapp/zod-form-widget/form`：`AutoForm`、`ReactiveAutoForm`、`AutoSearch`
- `@zodapp/zod-form-widget/table`：`AutoTable`、列設定の controller
- `@zodapp/zod-form-widget/tabular`：取り込みと書き出しのモーダル
- `@zodapp/zod-form-widget/feedback`：`useDeleteModal`、`FetchMore`
- `@zodapp/zod-form-widget/messages`：文言の辞書 `en`・`ja`
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
