---
"@zodapp/zod-form-react": minor
"@zodapp/zod-form-mantine-lite": minor
"@zodapp/zod-form-mantine": minor
---

zf.union の不具合を直し、`ZodFormProps` の `required` を `optional` に裏返す。

- **破壊的変更**：`ZodFormProps` の `required?: boolean` を `optional?: boolean` にした。`nullable?: boolean` を足し、`NullableComponent` が渡す。`useDynamicSchema` の `{ required }` は `{ optional }`
- `FormRuntime.validate` は zod の issue をまるごと残す（一番外の path にだけ前置きを付ける）
- `wrapComponent` と配列の欄は `invalid_union` を表示しない。zf.union が選んだ腕のエラーを、同じ欄（と object の腕の子の欄）の errorMap の `onDynamic` に足す
- 腕が未選択で検証に落ちているときは、腕を選ぶ欄に「選択してください」
- optional・nullable の union の × と、腕を選んだ直後の空の値（optional は `undefined`、nullable だけは `null`）
- 腕を選んだ直後の最初の送信が、検証されずに止まる不具合を修正
