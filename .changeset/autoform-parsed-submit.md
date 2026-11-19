---
"@zodapp/zod-form-react": minor
"@zodapp/zod-form-widget": minor
---

**Behavior change**：AutoForm の `onSubmit` に、parse した値（`z.output`）を渡す。今までは型が `z.output` なのに、parse 前のフォームの値が届いていた（`.trim()`・`.default()`・`z.coerce`・`.transform()` が効かなかった）。zod-form-react の `FormRuntime` に `parse(staticSchema, value)` を足す。dynamic の output を先に値へ差し込んでから静的な schema で parse するので、外側の transform・refine は dynamic の output を受け取る。検証（エラーの表示）は今のまま parse 前の値で行い、`onCancel` には今のままフォームの値（`z.input`）を渡す
