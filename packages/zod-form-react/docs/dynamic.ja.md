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

AutoForm は、フォームを開くときに静的な schema でも `getDefaultValue(schema, defaultValues)` で補います（`@zodapp/zod-form-widget` の README の「開くときの値」）。

## 静的な schema での `zf.dynamic`

`zf.dynamic()` の土台は `z.unknown()` です。静的な schema のまま parse でき、隣の欄の `.refine()` も走ります。値の検証は、dynamic が決めて登録した schema で行います。読み込み中・取得の失敗は、登録した印の issue で送信を止めます。CSV の書き出し・読み込み（zod-tabular）では、dynamic の欄を飛ばします。

## 送信する値（`FormRuntime.parse`）

AutoForm の `onSubmit` には、parse した値（`z.output`）を渡します。dynamic の output を先に値へ差し込んでから、静的な schema で parse します。

1. 登録された path を、深い順に並べる
2. それぞれ、今の値のその path を、その path の一番深い登録の schema で parse する。失敗したら送信しない（読み込み中・取得の失敗も失敗）
3. その path に output を差し込む（値はコピーで、フォームの値は変えない）
4. 差し込んだ値を静的な schema で parse し、その output を渡す

- 外側の transform・refine は、dynamic を parse した後の値を受け取ります（zod で親が子の output を受け取るのと同じ）。差し込み先は入力の値の path なので、外側に transform があっても必ずあります
- dynamic の中の dynamic は、内側を先に差し込みます。外側から見ると内側の土台は `z.unknown()` なので、output は素通りします
- エラーの表示（`FormRuntime.validate`）は、今のところ parse 前の値で行います。2 つの評価をそろえる見直しは [docs/plans/dynamic-validate-parse.md](../../../docs/plans/dynamic-validate-parse.md) にあります
- `onCancel` には、フォームの値（`z.input`）を渡します
