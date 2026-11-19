---
"@zodapp/zod-tabular": minor
"@zodapp/zod-form-widget": patch
---

`toTable`・`fromTable` に `skip` を追加した（true を返した schema の欄を、z.never の欄と同じく表に出さない・読まない）。zod-form-widget の CSV の書き出し・読み込みは、`zf.dynamic` の欄を飛ばす（土台が z.unknown になっても、今までどおり列にしない）。
