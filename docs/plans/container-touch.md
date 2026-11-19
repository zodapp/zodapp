# 入れ物の欄を「触った」「変えた」にするプラン

- ステータス: 実装済み
- 対象ブランチ: `claude/project-thread-1axi7l`
- 対象パッケージ: `@zodapp/zod-form-react`、`@zodapp/zod-form-mantine`、`apps/form-demo`

---

## 1. 背景

入れ物（object・intersection・array・record）の欄は、子の欄の「触った」「変えた」を自分のこととして受け取らない。そのため、入れ物の path に出るエラー（path を指定しない `.refine()` など）で、次の 2 つの不具合が起きる。

### 1.1 欄を離しても、入れ物のエラーが出ない

- エラーを出すかどうかは、`wrapper.tsx` の `showError = isTouched || isSubmitted` で決める
- 子の欄を離しても、触ったことになるのは子の欄だけ。入れ物の欄は触ったことにならないので、送信するまでエラーが出ない
- ブラウザで確かめた：intersection のデモの「期間（.refine()）」「子の object の .refine()」は、すべての欄を触って離しても出ず、送信して初めて出る

### 1.2 直してもエラーが消えず、送り直せない

jsdom で、`pair: zf.object({ from, to }).refine(from !== to)` を確かめた。

| 時点                 | `pair` の errorMap                  | canSubmit |
| -------------------- | ----------------------------------- | --------- |
| 1 回目の送信（a・a） | onChange・onBlur・onSubmit にエラー | false     |
| 終了を b に変える    | onChange が消える                   | false     |
| 終了の欄を離す       | onBlur も消える。onSubmit だけ残る  | false     |
| 2 回目の送信         | onSubmit が残ったまま               | false     |

- onChange・onBlur は、フォーム全体の検証が走るたびに、すべての path について入れ直されるので消える
- 欄の onSubmit を消すのは、その欄自身の `validate("change")`・`validate("blur")` だけ（TanStack form-core 1.33.2 の `FieldApi.validateSync` の最後で、エラーが無ければ onSubmit を消す）。子の欄の入力では、入れ物の欄の validate は呼ばれない
- 2 回目からの送信は、まず欄ごとの `validateAllFields("submit")`（フォーム全体の検証を飛ばす）を走らせる。入れ物の欄には欄ごとの検証が無いので onSubmit は残り、`isFieldsValid` が false のまま、フォーム全体の検証の前に送信をやめる

## 2. 決めたこと

### 2.1 入れ物の末尾の目印（`ContainerMarker`）

zod-form-react の common に、部品 `ContainerMarker`（`{ fieldPath: string }`）を足す。入れ物の部品は、子の欄をすべて描いた後ろに 1 つ置く。

- 描くのは `<span hidden />` だけ。`hidden`（display: none）なので、横並び（flex の gap）の間に余白は入らない
- 入れ物の欄の FieldApi は、wrapComponent がもう作っているので、新しく `useZodField` は呼ばない。呼ぶときに `form.getFieldInfo(fieldPath)?.instance` から取る（object・intersection は `field` を受け取らないようにマスクしているため。マスクは、子の入力のたびに入れ物を描き直さないためのもの）
- 根（`fieldPath === ""`）には置かない。根の `.refine()` のエラーはフォーム全体のエラーで、欄には出ないので、このプランでは扱わない

置く部品：object（`ObjectBodyImplement`）、intersection、array、record（`record`・`record_entries`）、union。optional の object（`OptionalContainer`）は、中の `ObjectBodyImplement` が置くので足さない。

同じ path の外側の部品の子として描かれるとき（`hideError` か `errorToken` を受け取ったとき。intersection の両側、union の腕）は置かず、外側が置く（`container.tsx` の `ownsContainerMarker`）。置くと、intersection の左側の最後の欄を離しただけで、同じ path の intersection を触ったことになる（「期間」の開始を離しただけで「開始と終了は別の値にしてください」が出る）。そのため union にも置く（プランの初めの版では「union には置かない（腕が置く）」としていたが、腕は `errorToken` を受け取るので置かない）

### 2.2 触った：前の欄を検証するしくみに乗せる

`ContainerMarker` は、`useValidatePrecedingFields` の provider に、`{ node: span, handleBlur: 入れ物の欄の handleBlur, kind: "marker" }` を登録する（いまの欄は `kind: "field"`）。

- **入れ物より後ろの欄にフォーカスが入ったとき**：いまの `triggerPreceding` のまま。目印はその欄より前にあるので、入れ物の `handleBlur` が呼ばれ、触ったことになり、検証される
- **入れ物の中の欄にフォーカスが入ったとき**：目印はその欄より後ろにあるので、何も起きない（特別な処理はいらない）
- **最後の欄を離したとき**：provider に `triggerTrailing(record)` を足す。離した欄より後ろにある目印のうち、離した欄との間に `kind: "field"` の記録が無いものすべての `handleBlur` を呼ぶ
  - 離した欄の path（`field.name`）が、目印の入れ物の path と同じかその下にあるときだけ呼ぶ。中に欄の無い入れ物（空の配列など）の目印が、入れ物の前の欄を離しただけで呼ばれないようにするため（PR の自動レビューで見つかった）
  - 入れ子で、内側と外側の両方の最後の欄なら、両方の入れ物が触ったことになる（間にあるのは目印だけなので）
  - 最後の欄から、同じ入れ物の前の欄へ戻ったときも触ったことになる。一度最後まで来たあとなので、出してよい
- 欄を離したことは、部品ごとに onBlur をつなぐのではなく、`useValidatePrecedingFields` の `ref` で受け取った要素に `focusout` の listener を付けて受け取る（いま `useValidatePrecedingFields` を使う部品は 17 あり、全部を直さないで済む）
- 最後の欄以外から余白をクリックしたときは、触ったことにならない。送信すれば出るので、扱わない

### 2.3 変えた：入れ物の値が変わったら、入れ物の欄を検証する

`ContainerMarker` は入れ物の欄の値を購読し（`useStore(form.store, …)`。描き直すのは目印だけで、入れ物は描き直さない）、初めて描いたとき以外で値が変わったら、入れ物の欄の `validate("change", { skipFormValidation: true })` を呼び、onBlur のエラーを消す。

- onBlur も、値が変わっても残る（1.2 の表で、終了を b に変えたあとも残っている）。欄の部品の onChange（`wrapper.tsx`）と同じく、自分で消す。まだ正しくない値なら、同じエラーがフォーム全体の onChange の検証で onChange に入っている

- これで、入れ物の欄の onSubmit が消え、送り直せるようになる（1.2）
- `validate` は欄が触っていないと何もしない（`if (!this.state.meta.isTouched) return []`）。onSubmit が入るのは送信のあとで、送信は入れ物の欄も含めてすべての欄を触ったことにするので、困らない
- `skipFormValidation: true` にする理由：フォーム全体の onChange の検証は、子の欄の入力ですでに走っている。入れ物ごとにもう一度走らせると、入れ子の数だけ、1 回の入力で zod の検証が重なる
- その代わり、値がまだ正しくないときも onSubmit は消える。同じエラーがフォーム全体の onChange の検証で onChange に入っているので、エラーの表示と `canSubmit` は変わらない
- union は、いまも値が変わったら onBlur のエラーを消している（`union.tsx`）。これは残す（このプランでは union を変えない）

## 3. テスト

単体テスト（zod-form-react・zod-form-mantine）：

- object の `.refine()`（path なし）：最後の欄を離すとエラーが出る。最後でない欄を離しただけでは出ない
- 入れ物の後ろの欄にフォーカスすると、入れ物のエラーが出る
- 入れ子の object：内側の最後の欄が外側の最後の欄でもあれば、離すと両方のエラーが出る
- 送信でエラーを出し、子の欄を直すと、入れ物の欄の onSubmit が消え、送り直すと送信できる
- 直しても正しくない値のままなら、エラーは出たまま
- intersection・array・record で、それぞれ 1 つ（最後の欄を離すと出る、直すと送り直せる）

e2e（form-demo）：

- intersection のデモの「期間（.refine()）」で、最後の欄（終了）を離すとエラーが出る
- 「期間」を送信でエラーにしてから直すと、エラーが消える（ほかの欄のエラーがあるので、送信できるかは単体テストで確かめる）
- 「子の object の .refine()」で、パスワードの枠の最後の欄（確認）を離しても出ず、intersection の最後の欄（名前の枠の「名」）を離すと出る。子の object の `.refine()` のエラーは同じ path の intersection に出るので、intersection の最後の欄で出す（2.1）

## 4. 扱わないこと

- 根の `.refine()`（2.1）
- 最後の欄以外から余白をクリックしたとき（2.2）
- 検証で欄がずれてクリックが外れること（union の e2e で見つけた件）。別に扱う
