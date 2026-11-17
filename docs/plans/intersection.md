# zf.intersection を描くプラン

- ステータス: 2〜5 は実装済み（form-demo の e2e は 132 件すべて通過）。6（エラーの扱いの見直し）は未実装
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
  - ~~box は `uiType: "box"` と同じ Mantine の Fieldset で描く~~ → 6.6 で Alert に変える
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

## 6. エラーの扱いの見直し（未実装）

2〜5 の実装のあと、同じ path に出るエラーを、union が腕に回すもの・discriminatedUnion が出すものまで調べ直した（jsdom で試した結果をもとにする）。次のとおり決める。

### 6.1 同じ path に出るエラーと、出す部品

discriminatedUnion（`contact`）が union と同じ path（`["contact"]`）に出す issue と、intersection の中で出す部品：

| 状況                                           | code              | 出す部品            |
| ---------------------------------------------- | ----------------- | ------------------- |
| 値が undefined・null                           | invalid_type      | intersection（6.4） |
| 値が object でない                             | invalid_type      | intersection        |
| 選んだ腕の、path を指定しない `.refine()`      | custom            | intersection（6.3） |
| 選んだ腕が strictObject で、知らないキーがある | unrecognized_keys | intersection（6.5） |

- discriminator が無い・どの腕にも合わない：invalid_union が discriminator の欄（`["contact", "type"]`）に出る。今と同じく union が腕を選ぶ欄に「選択してください」を出す（intersection とは関係しない）
- 腕の子の欄のエラー：その欄に出る（関係しない）

### 6.2 同じ欄の issue の種類と、出す部品（`errorTokens`）

1 つの欄（path P）に来る issue を 3 種類に分け、種類ごとに出す部品を 1 つに決める。3 つの規則は対象が重ならないので、互いを参照しない。

**① union が同じ欄に書いた issue（`writtenBy` 付き）**

union は、選んだ腕のエラーのうち path が `[]` のもの（string の腕の too_small、腕の object の path を指定しない `.refine()` など）を、`writtenBy: writer` を付けて同じ欄 P に書く（今の `ownArmIssues`）。`writer` は union の部品ごとに `useState(() => ({}))` で作るオブジェクトで、書き直し（`replaceWrittenIssues`）と invalid_union の読み分けに使う。union ごとに別である必要がある。

- zod-form-react の `ZodFormProps` に `errorTokens?: readonly object[]` を足す。定義：同じ欄で、その部品を囲んでいる union すべての `writer`（外側から順）
- 部品は、`writtenBy` が `errorTokens` の中にある issue を出す。それ以外の `writtenBy` 付きの issue は捨てる。`hideError` とは関係しない
- union は、受け取った `errorTokens` に自分の `writer` を足したもの（`useMemo`）を、腕の Switch（と Suspense の fallback）に渡す
- 同じ path の包みは `{...props}` で渡すので届き、path が変わる部品は渡さないので子の欄には届かない
- union の部品は自分の欄のエラーを出す場所を持たないので、union あての issue は、それを囲まれた、出せる部品が出す。入れ子（`A = z.union([B, …])`、B に `.refine()`）では、B の refine を A が `writtenBy: wA` で書き、B の腕は `[wA, wB]` を受け取るので、B の refine も B の腕のエラーも腕の部品が出す
- intersection は `errorTokens` を子に渡さない（union ではなく、自分で出せるため）。intersection の両側の union は互いを囲まないので、腕はそれぞれの union の `writer` だけを受け取る
- 子の欄に振り分けたもの（`distributedBy` 付き）は、表示の規則では ③ として扱う（今のとおり）。`distributedBy` は、union が自分の振り分けたものを消すためだけに使う

**② union が解釈する issue（invalid_union と、union の腕の unrecognized_keys）**

そのままでは画面に出せない（どの腕の話か、どの union を選び直せばいいかが、union にしか分からない）。

- 表示の共通関数（`wrapComponent`・`useArrayField`）は、invalid_union を部品に渡さない（今のとおり）。unrecognized_keys は、`errorTokens` を受け取った部品（union の腕）には渡さない（6.5）
- union が読む invalid_union（`pickUnionIssue`）：`UnionRelayContext` をやめる。`props.errorTokens` があれば、`writtenBy` がその最後の要素（すぐ外側の union の `writer`）のもの、無ければ `writtenBy` の無いもの
- `UnionRelayContext` は消す
- union は、読んだものを腕に配る（①にする）か、腕を選ぶ欄の文言（6.4・6.5）にして出す

**③ `writtenBy` の無いふつうの issue（refine、invalid_type、union の外の unrecognized_keys）**

- 出す部品：P のいちばん外側の部品。内側の部品には、外側が `hideError` を渡す（2.3 のとおり）
- union は、受け取った `hideError` をそのまま腕に渡す（union は ③ を表示しないので、外側の役を取らない）

表示の共通関数が部品に渡す error は、次で選ぶ：

```ts
const isMine = (issue) =>
  issue.writtenBy !== undefined
    ? (props.errorTokens?.includes(issue.writtenBy) ?? false)
    : !props.hideError;
const error = rawErrors
  .flat()
  .find(
    (issue) =>
      !isPendingIssue(issue) &&
      !isUnionIssue(issue) &&
      !(props.errorTokens && isUnrecognizedKeysIssue(issue)) &&
      isMine(issue),
  );
```

これで、`z.union` の腕の、path を指定しない `.refine()` などは、intersection の中でも腕の中に出る。入れ子の refine は、単体テストで確かめる。

### 6.3 discriminatedUnion の腕のエラーは intersection に出す

discriminatedUnion は、選んだ腕の `.refine()` などの issue を invalid_union に包まず、`writtenBy` の無い issue として union と同じ path に出す。zod の issue には、どの schema から出たかの情報が残らない。そのため、intersection 自身の issue と見分けられない。

- intersection の中では、hideError のまま intersection の入れ物に出す（今の動きを仕様にする）
- 腕の中に出したいときは `.refine(..., { path: ["phone"] })` のように欄を指す。デモの説明に、この書き方をすすめる形で載せる
- 中身（code・文言・path）で照合して見分ける方法はとらない（同じ中身の issue が重なると、出たり消えたりするため）

### 6.4 値が空のとき、union は「選択してください」を重ねて出さない

discriminatedUnion は、値が undefined・null のとき invalid_type（③）を union の欄に出す。union は今、腕が未選択で欄にエラーがあれば、code を問わず腕を選ぶ欄に「選択してください」を出している。そのため、intersection の中では intersection の「必ず入力してください。」と重なる。z.union も、intersection のもう片方が object なら、そちらの invalid_type（③）を intersection が出すので、invalid_union から作る「選択してください」と重なる。

- union は、`hideError` を受け取っていて、P に ③ があるとき（外側が出すものがあるとき）は、自分の欄のエラーからは「選択してください」を出さない
- P に ③ が無いとき（invalid_union しか無い。値はあるがどの腕にも合わないとき、intersection の両側が union のときなど）は、`hideError` でも出す。ほかに出す部品が無いため
- discriminator の欄のエラー（`hasDiscriminatorError`）からは、今のとおり出す（P の issue ではないので、intersection とは重ならない）

### 6.5 unrecognized_keys の文言

zod の intersection は、両側の unrecognized_keys をまとめ、両側とも知らないキーだけを intersection の path に 1 つの issue（`{ code: "unrecognized_keys", keys: [...] }`）として出し直す。ただし、discriminatedUnion の、選んでいない腕にあるキーは「知らないキー」になる（腕が替わった保存データに、前の腕の欄が残っているときなど）。この場合は、腕を選び直せば直る。

文言は、キーごとに作らず、キーを持つ union の名前を並べて、選択を促す。

- `issue.keys` のキーごとに、そのキーをどれかの腕に持つ discriminatedUnion を、schema からたどって探す
  - たどる範囲：包み（optional など）を外し、intersection は両側、discriminatedUnion は全部の腕。object の子の欄（path が変わるもの）には入らない
  - 腕の中のキーは、腕を包みから外した object の shape で見る
- 見つかった union の名前を、見つけた順に「と」でつなぎ、「連絡方法と会員タイプを選択してください」と出す（同じ union は 1 回だけ）
  - union の名前は `selectorLabel`、無ければ `label`、どちらも無ければ「タイプ」（腕を選ぶ欄のラベルと同じ）
- 見つからないキーしか無いとき（schema のどこにも無いキー）：issue のメッセージ（errorMap のもの）をそのまま出す。画面で直せないデータの不具合なので、作り直さない
- 見つかるキーと見つからないキーが混ざるとき：作り直した文言を出す（画面で直せる方を出す）
- 文言を作る関数は zod-form-mantine の utils に置き、intersection と union で使う

出す部品：

- intersection の中：intersection が、受け取った error が unrecognized_keys なら、この文言に作り直して入れ物に出す
- intersection の外の discriminatedUnion：union が、自分の欄の unrecognized_keys を読み、腕を選ぶ欄のエラーとして出す（腕を選んでいるときも出す）。`hideError` のときは出さない
- 腕の部品は、unrecognized_keys を出さない。表示の共通関数は、`errorTokens` を受け取った部品（union の腕）には、`writtenBy` の無い unrecognized_keys を渡さない（6.2 の ②）
- union の無い strictObject は、今のとおり object の部品が errorMap のメッセージで出す

### 6.6 flat のエラーは Alert で出す

2.5 のエラーの box を、Mantine の `Alert`（`color="red"`、`variant="light"`、アイコンは `@tabler/icons-react` の `IconAlertCircle`）に変える。余白は今の box と同じ（`mt={10}`、`py={8}`）。横並びの中では今のとおり幅いっぱいにして次の行に出す。

### 6.7 デモと e2e に足すもの

デモに次のエラーの例を足し、e2e で出る場所と回数を確かめる。

- box の子の object に `.refine()`：エラーは intersection に 1 回だけ出て、子の枠には出ない
- flat（横並び）の子に `.refine()`：横並びの中のエラーの出方
- 子の欄に `min(1)`：欄のエラーは今のとおり欄の下に出る
- `z.union` の腕の object に、path を指定しない `.refine()`：腕の中に出る（6.2）
- discriminatedUnion の腕の object に、path を指定しない `.refine()`：intersection に出る（6.3）
- 必須の intersection（object と discriminatedUnion）の値が空：「必ず入力してください。」が 1 回だけ出て、「選択してください」は出ない（6.4）
- 2 つの discriminatedUnion（腕は strictObject）の intersection に、選んでいない腕のキーが残った初期値：「連絡方法と会員タイプを選択してください」が出る（6.5）
- intersection の外の discriminatedUnion（腕は strictObject）に、選んでいない腕のキーが残った初期値：腕を選ぶ欄に「連絡方法を選択してください」が出る（6.5）

スクリーンショットは、欄ごとに分けて、送信前と送信後を撮る。

### 6.8 扱わないこと

- unrecognized_keys を、キーを持つ union に振り分けて、その union の中に出すこと（intersection から union に向けて `writtenBy` を付けて書く仕組みが要る）
- `z.union`（discriminator の無いもの）の腕の unrecognized_keys の文言を作り直すこと
