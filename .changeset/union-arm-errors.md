---
"@zodapp/zod-form": minor
"@zodapp/zod-form-react": minor
"@zodapp/zod-form-mantine-lite": minor
"@zodapp/zod-form-mantine": minor
"@zodapp/zod-form-widget": minor
---

zf.union の不具合を直し、`ZodFormProps` の `required` を `optional` に裏返す。

- **破壊的変更**：`ZodFormProps` の `required?: boolean` を `optional?: boolean` にした。`nullable?: boolean` を足し、`NullableComponent` が渡す。`useDynamicSchema` の `{ required }` は `{ optional }`
- `FormRuntime.validate` は zod の issue をまるごと残す（一番外の path にだけ前置きを付ける）
- `wrapComponent` と配列の欄は `invalid_union` を表示しない。zf.union が選んだ腕のエラーを、同じ欄（と object の腕の子の欄）の errorMap の `onDynamic` に足す
- 腕が未選択で検証に落ちているときは、腕を選ぶ欄に「選択してください」（discriminator のない union）
- optional・nullable の union の × と、腕を選んだ直後の空の値（optional は `undefined`、nullable だけは `null`）
- 腕を選んだ直後の最初の送信が、検証されずに止まる不具合を修正
- object の腕の子の欄の型のエラーを、欄を離れずに直してもすぐ消す
- discriminatedUnion で腕が未選択のときも「選択してください」
- 入れ子の union が無い欄にエラーを書いていた不具合を修正
- discriminator のない保存値の discriminatedUnion でも「選択してください」
- **破壊的変更**：nullable だけの欄を空にすると `null` を書く（optional の欄は今までどおり `undefined`）。`emptyValueOf` を export し、`useDynamicSchema` に `{ nullable }` を足した
- 複数選択の欄（enum・外部キー）も、全部外すと nullable だけなら `null` を書く
- mantine-lite の reactive 版の部品も、`onBlur`・`onConfirm` に渡す空の値を `emptyValueOf` にそろえる（`useConfirmableState` に `emptyValue`）
- `getDefaultValue` は、optional と nullable の両方が付いた欄（`.optional().nullable()`）の初期値を `undefined` にする
- reactive 版の日付の欄は、`onConfirm` に保存の形式で渡す（`useConfirmableState` に `toValue`）
- bigint の欄は、先頭の「-」と数字以外の文字を受け付けない
- `getDefaultValue` は、object の子の値が undefined のときキーを置かない。`getDefaultValue(schema, value)` で値が無いところだけを補える
- `zf.dynamic` の schema が最初に決まったとき、値が無いところを既定値で補い、AutoForm の defaultValues にも入れる（`useDefaultValuesWithFills`）
