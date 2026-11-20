# form を使わない部品の表示値を `value` で渡す

## 1. 背景

`ZodFormProps` の `defaultValue` には、二つの意味が混ざっている。

- form を使う部品（zod-form-mantine の components）：新しく値を作るときの初期値。たとえば union の腕を選んだときの値
- form を使わない部品（mantine-lite の reactiveComponents・tableComponents）：表示する値そのもの

`docs/plans/same-path-experiment.md` の案F の第2段（`value`・`parent` を props で渡す）のうち、この名前の食い違いを直す部分だけを行う。
`parent` を props で渡すことと、form を使う部品も `value` で読むことは、今は理由が無いので行わない（§6）。
npm に公開する前に直す。公開したあとでは破壊的変更になるため。互換のための別名は残さない。

## 2. 決まり

- `ZodFormProps` に `value?: unknown` を足す。form を使わない部品が表示する値。
- form を使わない部品は `value` だけを読む。`defaultValue` は読まない。
- form を使う部品には `value` を渡さない。form の中の object・array・record・tuple・union は、子に `value` を渡さない。
  form の中では `value` はいつも undefined になる。値は今までどおり `useField` で store から読む。
- `defaultValue` は「新しく値を作るときの初期値」の意味だけにする。form を使う部品だけが使う。
- 同じ path の包み（optional・nullable・default・lazy・pipe・passthrough・PreprocessSwitch・dynamic など）は、`value` を `{...props}` でそのまま渡す。
  `innerDefaultValue` の決まり（default の x で埋める、nullable だけなら null）は `defaultValue` にだけかけ、`value` にはかけない。
- `.default("x")` などの既定値は、AutoForm と同じく、外から値が来たときに一度だけ `getDefaultValue` で補う（§2.1）。部品は描くたびに補わない。
- `ZodFormProps` の説明に「`value` は form を使わない部品にだけ渡される」と書く。

### 2.1 既定値の補い

AutoForm は、外からデータ（`defaultValues`）が来たときに一度だけ `getDefaultValue` で補い、あとは補ったあとの値を持つ。
今の form を使わない部品は、描くたびに default の包みが `defaultValue` を x で埋めていて、AutoForm と形が違う。
`value` に移すのに合わせて、AutoForm と同じ時に補う形にそろえる。

- `ReactiveAutoForm`：外から `values` が来たとき（最初と、DB の購読などで変わったとき）だけ、`getDefaultValue(schema, values)` で補って、内の state に持つ。
  補えないとき（optional の付かない z.lazy の無限の再帰など）は、AutoForm と同じく補わずに使う（AutoForm の `fillDefaultValues` を共通にして使う）
- 確定したときは、補ったあとの state に、その欄の値を書き込む（今の `setNestedValue` と同じ）。外へ書くのは今までどおり、利用者が確定した欄だけ。
  保存されている値が undefined の欄は、触らなければ undefined のまま
- 補ったあとの値は、根の Switch の `value` と、`TableRowProvider` の行（computed などの parent）に渡す
- 部品と包みは `value` に手を付けない。default の部品を form 用と分ける必要もない
- 作り直すのは外から値が来たときだけなので、確定のたびに全部の欄を描き直すことはない
- 確定していない変更のある欄は、親から来る値で上書きしない（`useConfirmableState` の今の動き）ので、補い直しで編集中の値は消えない
- 触っていない default の欄の `previousValue`（`onConfirm`・`onBlur`）は、undefined ではなく x になる。表示と合う
- `AutoTable` は補わず、行の値をそのまま見せる（今の決まりのまま）
- 今後の決まり：reactive に dynamic や union（実行時に schema や腕が決まる部品）を入れるときは、その部品が schema の決まったときに
  `getDefaultValue(決まった schema, 受け取った value)` で補って子に渡す（結果は覚えておき、描くたびには作り直さない）。
  今の reactive の部品の一覧には dynamic・union が無いので、今回は実装しない

## 3. 変えるところ

### 3.1 zod-form-react

- `utils/type.ts`：`value?: unknown` を足し、`defaultValue` の説明を「新しく値を作るときの初期値（form を使う部品）」に直す
- `common/switch.tsx` の PreprocessSwitch：今 `defaultValue` に行っている preprocess のそろえを、`value` にも行う
- `common/fnInput.tsx` の `useTableFnInput`：呼ぶ側が `value` を渡すようにする（引数は今のまま）

### 3.2 値を渡す側

- `ReactiveAutoForm`（zod-form-widget）：props の `defaultValues` を `values` に変える（中身は表示する値で、外から変わると追従するため。部品の `defaultValue` と同じ食い違い）。
  §2.1 のとおり補った値を、根の Switch に `value` で渡す（今は `defaultValue`）。apps（form-demo・survey・taskmanager）の呼び出しも直す
- `AutoTable`（zod-form-widget）：セルに `value` を渡す（今は `defaultValue`）
- `array_table`（zod-form-mantine）：readOnly のとき、セルは tableComponents で描くので、セルの表示値を `value` で渡す。
  readOnly でないとき（form の部品で描く）は渡さない
- reactiveComponents の object・record：子に `value` の一部を渡す
- tableComponents の union：選んだ腕に `value` を渡す（array は自分で描くので子に渡さない。object は何も描かない）

### 3.3 値を受け取る側（`defaultValue` → `value`）

- reactiveComponents：boolean・computed・date・enum・externalKey・literal・number・object・record・string・string_multiline
- `reactiveComponents/utils/confirmable.tsx`：引数名と説明を `value` にする（「確定していない変更が無いあいだは、親からの `value` の変更に追従する」）
- tableComponents：array・boolean・computed・date・dynamic・enum・externalKey・literal・number・string・time・union

### 3.4 ドキュメント

- zod-form-mantine-lite の README（英・日）：例の `<Dynamic ... defaultValue={item} />` を `value={item}` にし、「親からの `value` の変更に追従します」に直す
- zod-form-react の README（英・日）の「部品の props」：`value` と `defaultValue` の意味を書く。
  ついでに、案F の第1段で消えた `optional`・`nullable` の props の説明が残っているので、`outer` と `emptinessOf(outer)` の説明に直す
- zod-form-mantine の `docs/intersection.ja.md`：子に渡すものに `value` を足す

## 4. テスト

- 既存の reactiveComponents・tableComponents・ReactiveAutoForm・AutoTable のテストで、`defaultValue` で値を渡しているところを `value` に直す
- 足すテスト
  - form を使わない部品で、`.optional()`・`.nullable()`・`.default()` の包みを通っても `value` がそのまま届く
  - preprocess の欄で、`value` がそろえられて表示される
  - ReactiveAutoForm：値が undefined の `.default("x")` の欄に x が出る。外の `values` が変わると補い直す。
    確定しても、触っていない default の欄は `onConfirm` に出ない
  - ReactiveAutoForm：補えない schema（optional の付かない z.lazy の再帰）でも描ける
  - form の中の object の子に `value` が渡らない（undefined）
- `pnpm check-types`・`pnpm build`・単体テスト・form-demo の e2e を通す。apps（form-demo・survey・taskmanager）の型も確かめる

## 5. 決めたこと

- `ReactiveAutoForm` の `defaultValues` は `values` に変える
- 既定値は、AutoForm と同じく外から値が来たときに `getDefaultValue` で補う（§2.1）。描くたびに部品が埋める形はやめる。
  zod の `.default("x")` は undefined を x にするので、form を使わない部品でも x を表示する
- 別のスレッドの `dynamic-validate-parse.md`（FormRuntime の validate と parse を 1 つの評価にそろえる）とは重ならない。
  あちらは form の検証と送信する値の話で、ReactiveAutoForm は FormRuntime を使わない

## 6. 行わないこと

- `parent` を props で渡すこと。フォームの中は `useFnInput` が store から読み、表は `TableRowProvider` が行を渡していて、困っていない。
  入れ子のフォーム（実験 2）が入るときに、改めて考える
- form を使う部品も `value` で読むこと。値の出どころが props と store の二つになり、ずれたときにどちらを信じるかで不具合になる
- form を使う部品どうしの `defaultValue` の受け渡し（object・array・record・tuple が子の分を取り出して渡す、record の `field.value ?? defaultValue`）。
  意味は「初期値」のままなので、このプランでは触らない
