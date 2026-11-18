# zf.dynamic の値の扱い

`zf.dynamic` は、実行時に決まる schema で欄を描きます。externalKey も同じ仕組み（`useDynamicSchema`）の上にあり、選択肢から作った schema を dynamic に届けます。

## schema が決まったときの値

**schema が決まったら、値が無いところを既定値で補う。利用者が切り替えたときだけ、合わない値を削る。**

| いつ | 値への処理 |
|---|---|
| schema が最初に決まったとき | 補う（削らない） |
| 利用者の編集がきっかけで、別の key に切り替わったとき | 削ってから補う（`adaptValueToSchema`） |
| 利用者の編集以外で切り替わったとき | 何もしない |

- 最初の回に削らないのは、そのときの値が保存済みのデータかもしれないからです
- 補うのは値が `undefined` のところだけで、入っている値は変えません。補い方は `getDefaultValue(schema, value)`（[既定値と値の調整](../../zod-form/docs/default-value.ja.md)）です
- 最初の回の書き込みは `dontValidate`・`dontUpdateMeta` で書き、「触った」「変えた」にしません。利用者の編集としても扱いません
- 補った結果が今の値と同じなら書きません
- 登録する schema は、同じ path の外側の包み（props の `outer`。optional・nullable・default と、包みに付いた `.refine()` などの検査）で包み直します。空にして書いた `null` を決まった schema の検証で止めないためと、外側の検査のエラーを欄に出すためです

## 補った値を初期値に入れる

最初の回に値だけを書くと、TanStack は今の値を `defaultValues` と比べるので、開いただけで `isDefaultValue` が false になり、`reset()` で補った値が消えます。そこで、補いを `defaultValues` にも入れます。

- dynamic は、最初の回に「この path はこの schema（外側の包みごと）で補う」と `FormRuntime.setDefaultFill(path, schema)` に登録し、外れたら `removeDefaultFill` で外します
- `FormRuntime.applyDefaultFills(defaults)` は、登録された path を浅い順に `getDefaultValue(schema, その位置の値)` で補った値を返します。親が無い path や配列の範囲の外には値を作りません。何も変わらなければ `defaults` をそのまま返します
- `useDefaultValuesWithFills(runtime, defaults)` は、登録が変わると計算し直します。AutoForm はこれを `useZodForm` の `defaultValues` に渡します
- dynamic は今の値にも直接書きます。利用者が先に触っていて、TanStack が値を `defaultValues` に戻さないときのためです

AutoForm を使わずに `useZodForm` を直接使うときは、`useDefaultValuesWithFills` を通さなければ、`isDefaultValue` と `reset()` は補う前の `defaultValues` を基準にします。

静的な schema の `.default()` は、AutoForm がフォームを開くときには補いません。呼び出し側が `defaultValues` に入れます。
