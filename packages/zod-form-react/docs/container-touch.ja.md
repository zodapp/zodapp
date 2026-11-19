# 入れ物の欄の「触った」「変えた」

入れ物（object・intersection・array・record・union）の欄は、TanStack Form では子の欄の「触った」「変えた」を自分のこととして受け取りません。そのままだと、入れ物の path に出るエラー（path を指定しない `.refine()` など）が、送信するまで出ず、子の欄を直しても消えずに送り直せません。そこで、入れ物の部品は子の欄のあとに目印（`ContainerMarker`）を置き、入れ物の欄を触ったこと・変えたことにします。

## 目印を置く部品

`ContainerMarker`（`{ fieldPath }`）は、子の欄をすべて描いた後ろに 1 つ置く `<span hidden />` です。`display: none` なので、横並びの間に余白は入りません。

- 置く部品：object、intersection、array、record（`record`・`record_entries`）、union。optional の object は、中の object が置きます
- 同じ path の外側の部品の子として描かれるとき（`hideError` か `errorToken` を受け取ったとき。intersection の両側、union の腕）は置かず、外側が置きます（zod-form-mantine の `ownsContainerMarker`）。置くと、intersection の左側の最後の欄を離しただけで、同じ path の intersection を触ったことになるためです
- 根（`fieldPath === ""`）には置きません。根の `.refine()` のエラーはフォーム全体のエラーで、欄には出ないためです

## 触った

目印は、前の欄を検証するしくみ（`useValidatePrecedingFields`）に、入れ物の欄の `handleBlur` を `kind: "marker"` として登録します。

- **入れ物より後ろの欄にフォーカスが入ったとき**：前の欄と同じく、入れ物の `handleBlur` が呼ばれ、触ったことになります
- **入れ物の中の欄にフォーカスが入ったとき**：目印はその欄より後ろにあるので、何も起きません
- **最後の欄を離したとき**（`triggerTrailing`）：離した欄より後ろにある目印のうち、間に欄が無いものすべての `handleBlur` を呼びます。離した欄の path が目印の入れ物の path と同じかその下にあるときだけです（空の配列の目印が、前の欄を離しただけで呼ばれないように）。入れ子で内側と外側の両方の最後の欄なら、両方が触ったことになります
- 欄を離したことは、部品ごとに onBlur をつながず、`useValidatePrecedingFields` の `ref` で受け取った要素の `focusout` で受け取ります
- 最後の欄以外から余白をクリックしたときは、触ったことになりません（送信すれば出ます）

## 変えた

目印は入れ物の欄の値を購読し（描き直すのは目印だけ）、初めて描いたとき以外で値が変わったら、入れ物の欄の `validate("change", { skipFormValidation: true })` を呼び、onBlur のエラーを消します。

- 欄の onSubmit のエラーは、その欄自身の `validate` でしか消えません。入れ物の欄には欄ごとの検証が無いので、これが無いと送信で入った onSubmit が残り、2 回目からの送信がフォーム全体の検証の前に止まります
- `skipFormValidation: true` にするのは、フォーム全体の onChange の検証が子の欄の入力ですでに走っているためです。入れ物ごとに走らせると、入れ子の数だけ zod の検証が重なります。値がまだ正しくなければ、同じエラーがフォーム全体の検証で onChange に入るので、表示と `canSubmit` は変わりません
