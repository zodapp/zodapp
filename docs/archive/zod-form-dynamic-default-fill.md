# zf.dynamic：決まった schema の既定値を、今の値の足りないところに補う

今の仕様は [zf.dynamic の値の扱い](../../packages/zod-form-react/docs/dynamic.ja.md) と [既定値と値の調整](../../packages/zod-form/docs/default-value.ja.md) にあります。

## 目的

`zf.dynamic` で、実行時に決まった schema の `.default()` が、フォームの値（と送信の結果）に入らなかった。schema が最初に決まったときには何もせず、利用者が切り替えたときも、初期値の木を object のキーだけで重ねていたので、配列の要素・record の値・union の腕の中は補えなかった。

## 決めたこと

- **schema が決まったら、値が無いところを既定値で補う。利用者が切り替えたときだけ、合わない値を削る。** 最初の回に削らないのは、そのときの値が保存済みのデータかもしれないから
- **初期値の木を別に作って重ねるのをやめ、今の値を持ったまま schema を歩いて補う（`getDefaultValue(schema, value)`）。** 歩く処理はもともと「値が無ければ初期値」の形なので、値を渡すだけで、どの深さでも同じ規則で補える
- **値がある union は、zf.union の部品と同じ規則で腕を選ぶ。** 検証に通る腕だけで選ぶと、入力の途中の値ではどの腕にも通らずに失敗するため
- **補った値を、AutoForm の `defaultValues` にも入れる。** 値だけに書くと、開いただけで `isDefaultValue` が false になり、`reset()` で補った値が消えた。`form.options.defaultValues` を直接書き換えても、useForm が描画のたびに上書きするので、`FormRuntime` に補いを登録し、AutoForm がそれを入れた `defaultValues` を渡す形にした

## 採らなかった案

- **AutoForm がフォームを開くときに、静的な schema の `.default()` も補う。** 静的な schema と dynamic が同じ規則になるが、渡された `defaultValues` を変えることになるので、このときは決めずに残した
