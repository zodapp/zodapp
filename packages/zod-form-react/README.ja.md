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
      .register(zf.message.registry, { content: "補足メッセージ" }),
  })
  .register(zf.object.registry, {});
```

### `computed`（apps/form-demo の例）

`computed` は、`{ value, parent, context }` を受け取って **表示用の値（ReactNode）**を計算できます。
値を持たない欄（`zfReact.computed()`）に付ければ表示専用、値を持つ欄に付ければその値の表示になります。
`parent` は `dependsOnParent: true` のときだけ入り、`context` は `contextId` を指定したときだけ入ります。

`apps/form-demo/src/pages/form/schemas/computed.ts` では次のように利用しています:

```ts
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";

export const schema = z.object({
  unitPrice: zf.number().min(0).register(zf.number.registry, { label: "単価" }),
  quantity: zf.number().min(0).register(zf.number.registry, { label: "数量" }),
  total: zfReact
    .computed()
    .register(zf.computed.registry, {
      label: "合計",
      dependsOnParent: true,
      compute: ({ parent }) => {
        const unitPrice = parent?.unitPrice ?? 0;
        const quantity = parent?.quantity ?? 0;
        return `¥${(unitPrice * quantity).toLocaleString()}`;
      },
    }),
});
```

## フック / Provider（よく使うもの）

- **コンテキスト**
  - `useZodFormContext()`: `componentLibrary` / resolvers / timezone などにアクセス
  - `useExternalKeyResolver(config)`: `externalKeyResolvers` から該当 resolver を取得して実行
  - `useExternalKeyDynamicMeta(schema)` / `useArrayExternalKeyDynamicMeta(schema)`（`@zodapp/zod-form-react/utils/externalKey`）: externalKey の単一選択・複数選択（`z.array(zf.externalKey ...)`）の欄から dynamic の meta を作る。`useDynamicSchema` に渡すと、選択肢から作った schema（既定は enum、`allowUnlisted` なら string + 選択式。複数選択なら、元の配列の制約と meta を引き継いだその配列）が届く。取得の失敗は dynamic の error になり、送信は止まる
  - `useExternalKeyOptions(schema)`（`@zodapp/zod-form-react/utils/externalKey`）: externalKey の選択肢を購読する。resolver が `onError` を呼ぶと `error` と `retry` を返す（zod-form-mantine-lite の欄は、これで「再試行」を出す）。同じ購読のまま選択肢が届けば戻り、`retry` は購読をやめて最初からやり直す
  - `useFileResolver(config)`: `fileResolvers` から該当 resolver を取得して実行
  - `useMediaResolvers()`: `mediaResolvers`（未指定なら `basicMediaResolvers`）を返す
- **フォーム/フィールド**
  - `useZodForm(...)`: TanStack Form ベースのフォーム作成
  - `useZodField(...)`, `useFormValues(...)`: フィールド/値参照のヘルパー
  - `useArray(fieldApi, fieldPath, discriminator?)`: 配列フィールドの insert/remove/append/move を扱うラッパー
- **実行時の schema / 編集の出どころ**
  - `useRunAsUserEdit()`: 渡した関数の中の値の変更を「利用者の編集」として記録する（下の「編集の出どころで変わること」を参照）
  - `useDynamicSchema(meta, fieldPath)`: dynamic の resolve を呼び、結果をフォームの登録先に登録する
  - `TableRowProvider` / `useTableRow()`: 表の行の値を渡す（表用の部品はここから `parent` を受け取る）
- **遅延ロード/検証**
  - `useLazyFactory()`: Dynamic の lazy ロード戦略（デフォルトは `React.lazy`）
  - `useValidatePrecedingFields({ name, ref })`: フォーカス時に「前のフィールド」をまとめて検証（Providerが必要）

### 編集の出どころで変わること（`useRunAsUserEdit`）

値の変更は、利用者の編集か、外から（アプリのコードの書き込み・`reset` など）かを記録します。部品からの入力は利用者の編集です。アプリのコードから利用者の編集として書くときは `useRunAsUserEdit()` で包みます。

出どころで変わるのは、dynamic が取り直した schema に**型が合わない値の prune** だけです。

- 利用者の編集で dynamic の key が変わったときは、値を新しい schema に合わせて削る（新しい schema に無い項目を消す）
- 外からの変更なら値に触らず、合わない値は検証のエラーとして残す
- 選択肢に無い値の `unlisted: "clear"` は、出どころに関係なく消す（消すのは利用者の編集として書くので、下の dynamic へ連鎖する）

Provider コンポーネント:

- `ZodFormContextProvider`: `componentLibrary` / resolvers / timezone を供給
- `FormProvider`: `useZodForm` で作った form を供給
- `LazyProvider`: `useLazyFactory` の実装を差し替える
- `ValidatePrecedingFieldsProvider`: `useValidatePrecedingFields` を有効化する

## 部品の props（`ZodFormProps`）

部品（`componentLibrary` に入れる React コンポーネント）は、`ZodFormProps` を受け取ります。

- `fieldPath` / `schema` / `defaultValue` / `readOnly` / `label`
- `optional`: 外側の `.optional()`（と `.default()`）の中の部品なら `true`。書かないときは必須として扱う
- `nullable`: 外側の `.nullable()` の中の部品なら `true`。`.optional().nullable()` のように重なると両方 `true`

ラベルの必須の印（Mantine の `required`）は、`!(optional || nullable)` で決めます。
値を空にするとき、部品は `optional` なら `undefined`、`nullable` だけなら `null` を書きます（両方なら `undefined`。どちらでもない必須の欄は `undefined` を書き、「必須」のエラーにする）。自作の部品は `emptyValueOf({ optional, nullable })` でこの値を得られます。

> 以前の `required?: boolean`（`false` で optional）は `optional?: boolean` に置き換えました。自作の部品は `required !== false` を `!(optional || nullable)` に、`required={false}` を `optional={true}` に読み替えてください。

### union の腕のエラーの置き場所

zod の `invalid_union`（どの腕にも合わない値の issue）は、欄のエラーに残ります。`wrapComponent` と配列の欄は `invalid_union` を表示しません。zf.union の部品が `invalid_union` を読み、選んだ腕のエラーを同じ欄（と object の腕の子の欄）の errorMap の `onDynamic` に足します。

`onDynamic` は、既定の検証の流れ（TanStack Form の `defaultValidationLogic`）では TanStack が読み書きしない枠です。`revalidateLogic` や欄ごとの `validators.onDynamic` を使うフォームでは、この枠がぶつかることがあります。

## `basicMediaResolvers`

`basicMediaResolvers` は Mantine 非依存の最小セット（image/video/audio）です。`ZodFormContextProvider` に渡すか、`useMediaResolvers()` のデフォルトとして使われます。

> Mantine 版のフォールバック（汎用プレビュー等）は `@zodapp/zod-form-mantine` で提供します。

## 文言の言語（i18n）

部品の文言（「読み込み中」など）は `@zodapp/i18n-messages` の辞書のキー（`zodFormReact.*`）で書いています。Provider が無いときは英語です。日本語にするときは、`@zodapp/i18n-messages-react` の `I18nMessagesProvider` に `./messages` の `ja` を渡します（zod のエラーの辞書 `zod.*` も含みます）。

```tsx
import { I18nMessagesProvider } from "@zodapp/i18n-messages-react";
import { ja } from "@zodapp/zod-form-react/messages";

<I18nMessagesProvider locale="ja" messages={ja}>
  <App />
</I18nMessagesProvider>;
```

- `FormRuntime`（`wrapValidator`・`validate`）は、zod のエラーを辞書のキーにして検証します。schema に書いた文言（`.min(3, "…")`）はそのまま出し、辞書のキーなら訳します。schema を validator に直接渡したときは zod の既定の文言のままです。
- meta の文言（`label`・`trueLabel`・`falseLabel`・`emptyMessage`・`selectorLabel`・`unselectedLabel`）が辞書のキーなら、部品で訳します（`useResolvedMeta`・`useResolveText`）。
- 部品を作るときは、`createUseMsg` で自分の辞書を既定にした `useMsg` を作ります。

## API（抜粋）

- 描画/コンテキスト: `Dynamic`, `ZodFormContextProvider`
- フォーム状態: `useZodForm`, `FormProvider`, `useZodField`, `useFormValues`
- 追加フック/Provider: `useZodFormContext`, `useExternalKeyResolver`, `useFileResolver`, `useMediaResolvers`, `useArray`, `useLazyFactory`, `LazyProvider`, `ValidatePrecedingFieldsProvider`, `useValidatePrecedingFields`
- スキーマ拡張: `zfReact`, `getMetaReact`
- メディア: `MediaResolvers`, `basicMediaResolvers`, `imageMediaResolver` / `videoMediaResolver` / `audioMediaResolver`

## 関連

- `@zodapp/zod-form`: React 非依存の `zf`
- `@zodapp/zod-form-mantine`: Mantine UI 実装（`componentLibrary` 同梱）
- `@zodapp/zod-form-dynamodb`: externalKey の選択肢を DynamoDB（`@zodapp/zod-dynamodb`）から読む resolver
- `@zodapp/zod-form-s3`: ファイル（`zf.externalFile`）を S3 に保存する resolver（サーバー側は `@zodapp/zod-form-s3-node`）

## ライセンス

MIT（[`LICENSE`](../../LICENSE)）
