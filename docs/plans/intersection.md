# zf.intersection を描くプラン

- ステータス: 実装済み（form-demo の e2e は 132 件すべて通過）
- 対象ブランチ: `claude/union-arm-errors-v2`
- 対象パッケージ: `@zodapp/zod-extendable`、`@zodapp/zod-form`、`@zodapp/zod-form-react`、`@zodapp/zod-form-mantine`、`apps/form-demo`

---

## 1. 背景

`z.intersection(a, b)`（`a.and(b)`）をフォームで描く。両側は同じ path の値を受け持つので、両側の部品を同じ path に並べて描く。

見た目は、両側をそれぞれの枠のまま並べる形と、枠を付けずに 1 つの object と同じ見た目で並べる形の、2 通りを選べるようにする。
今の object の部品は、ラベルが無くても InputWrapper の div（上の余白・エラーの文言の場所）を 1 つ足し、`box` なら Fieldset で囲む（jsdom で確かめた）。

## 2. 決めたこと

### 2.1 登録

- zod-extendable に `extendIntersection`（`extendCustom(z.intersection, "intersection", …)`）を足す
- zod-form の `zf` に `intersection: extendIntersection(zodExtendableCommonDefSchema)` を足す
- zod-form-mantine の `componentLibrary` に `intersection` を登録する。部品は `schema.type` でも探されるので、`z.intersection`・`.and()` も同じ部品で描く

### 2.2 intersection の部品

- `schema.def.left`・`schema.def.right` を、同じ fieldPath の `Switch` で左・右の順に並べる
- 子に渡す props：`fieldPath`（同じ）、`schema`（左・右）、`defaultValue`（同じ値）、`readOnly`、`outer={undefined}`、`hideError={true}`。`label` は渡さない（子は自分の meta のラベルを使う）
- intersection が入れ子（`a.and(b).and(c)`）でも、そのまま Switch で入れ子に描く
- 入れ物は、intersection の meta の uiType で決める。object の部品と同じ関数で描く（2.4）
  - 既定：InputWrapper（ラベルがあれば出す）
  - `box`：Fieldset で囲む
  - `horizontal`・`horizontal-wrap`：子を横に並べる
  - `flat`：2.5
- 入れ物には、intersection が受け取った `error` を出す（同じ path のエラーを、ここで 1 回だけ出す）

### 2.3 同じ path のエラーを子に出させない（`hideError`）

- zod-form-react の `ZodFormProps` に `hideError?: boolean` を足す。「この部品の path のエラーは祖先が出すので、出さない」という意味
- `wrapComponent` は、`props.hideError` が true なら、部品に渡す `error` を undefined にする
- `useArrayField` も、`hideError` が true なら配列の欄のエラー（`getArrayFieldError`）を返さない。`useArrayField` は `hideError` を引数で受け取る
- 同じ path だけに届く理由：同じ path に描く包み（optional・nullable・default・pipe・lazy・dynamic・externalKey・preprocess）は `{...props}` で子に渡すので届く。path が変わる部品（object・record・tuple・array）は子の props を 1 つずつ書くので届かない
- union の腕の Switch（と Suspense の fallback）は props を 1 つずつ書いているので、`hideError={props.hideError}` を足す
- invalid_union から作る文言（union の「選択してください」、literal の union の「必ず入力してください。」）は止めない。intersection は invalid_union を出さないので重ならない
- intersection 自身も `wrapComponent` を通るので、外側から `hideError` を受け取れば出さない。同じ path で入れ子になった intersection では、いちばん外の intersection だけが出す

### 2.4 入れ物の描き方を object と共通にする

object の部品の、入れ物を描く部分（既定・`box`・`horizontal`・`horizontal-wrap`・`flat`）を関数に分け、object と intersection で使う。

- 引数：ラベル、uiType、エラー、並べる子の一覧（子ごとに「`flat` か」を持つ）
- 横並びでは、子を div で包んで flex に並べる。子が `flat` なら、その div を `display: contents` にして、子の欄が外側の flex の項目に直接なるようにする
- 子が `flat` かは、子の schema の meta の uiType が `"flat"` かで決める。optional・nullable・default などの包みの中にあるときは、包みを外して見る

### 2.5 uiType `flat`（object・union・intersection）

- object・intersection の `flat`：InputWrapper も枠も出さず、子（を包む div）だけを返す
- union の `flat`：Fieldset とその legend（union のラベル）だけを出さない。腕を選ぶ欄と腕の欄は今のまま出す（腕を選ぶ欄のラベルは、今と同じく `selectorLabel`、無ければ union の `label`）
- 自分の path のエラーがあるときだけ（受け取った `error` があるときだけ）、子のあとにエラーの box を 1 つ出す
  - box は `uiType: "box"` と同じ Mantine の Fieldset で描き、中身はエラーの文言だけ（文字色は Mantine のエラーの色）
  - 横並びの中では、box を幅いっぱいにして次の行に出す（flex の項目として `flex-basis: 100%`）。`horizontal`（折り返さない）の中でも box だけは折り返すよう、外側の flex は、子に `flat` があるときは `flex-wrap: wrap` にし、`flat` でない子の幅は今のまま（折り返さない）にする
  - intersection の中では `hideError` で `error` が来ないので、box も出ない

### 2.6 optional・nullable な intersection

object と同じく、＋・削除の行で出す。

- 値が無い（undefined・null）ときは＋だけを出す。＋で `getDefaultValue(intersection)` を書く
- 値があるときは、子を枠で囲み、左に削除のボタンを出す。削除で空の値（optional なら undefined、nullable だけなら null）を書く
- object の部品の `OptionalObjectImplement` を、中身を描く関数を受け取る形にして共通に使う
- 子には `outer` を渡さない

### 2.7 同じキーが両側にあるとき

両側の部品がそれぞれ描くので、同じキーの欄が 2 回出る。そのまま出し、開発中（`process.env.NODE_ENV !== "production"`）だけ `console.warn` で知らせる。

- 調べるのは、両側が（包みを外して）object のときだけ。shape のキーの重なりを調べる
- 警告は、schema ごとに 1 回だけ出す

### 2.8 既定値・削る処理

`getDefaultValue` と `pruneValueToSchema` について、intersection（object どうし、object と discriminatedUnion）の単体テストを先に書き、落ちたものだけ直す。

## 3. デモと e2e

form-demo に「zf.intersection」のページ（formId: `intersection`）を足す。

- 2 つの object の intersection（子は既定の枠のまま。子のラベル付き）
- 2 つの object の intersection（子は `flat`。縦並び）
- 2 つの object の intersection（子は `flat`。intersection は `horizontal`）
- object と discriminatedUnion の intersection（object も union も `flat`）
- intersection 全体に `.refine()` を付けた欄（エラーが 1 回だけ出ることを見る）
- optional な intersection（＋・削除）

e2e で確かめること：

- 両側の欄に入力した値が、同じ object に入ること
- `flat` の子の欄が、横並びでは外側と同じ行に出ること
- `.refine()` のエラーが 1 回だけ出ること
- object と union の intersection で、腕を切り替えると腕の欄が変わり、共通の欄の値が残ること
- optional な intersection の＋で値ができ、削除で undefined に戻ること

実装したら、デモのスクリーンショットを撮って見せる（見た目はスクリーンショットで判断する）。

## 4. 扱わないこと

- 両側の object の欄を集めて、1 つの object として描き直すこと
- 同じキーの欄を 1 つにまとめて描くこと
- intersection の中でだけ子を `flat` にする指定（子の uiType より優先する、intersection の meta）
- reactive 版（mantine-lite の reactiveComponents）の部品

## 5. 実装で分かったこと

- union の腕を切り替えると、腕の外のキーを消していたので、intersection で並べた object の欄の値が消えていた。どの腕にも無いキーは消さないようにした（discriminatedUnion・discriminator の無い union の両方）
- object 自体の `.refine()` のエラー（object の path のエラー）は、子の欄を直しても消えず、送り直しても残る。intersection だけでなく、ふつうの object でも同じ（errorMap の onBlur・onSubmit に残る）。今からある不具合で、このプランでは直していない
