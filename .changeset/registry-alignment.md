---
"@zodapp/zod-form": minor
"@zodapp/zod-form-mantine": patch
---

`zf.*.registry` の型の約束と、実際に描ける型をそろえる。`zf.date.registry` が `z.coerce.date()` を、`zf.externalKey.registry`・`zf.externalFile.registry` が書式付きの文字列（`z.email()` など。`zf.string` と同じ）を受け付ける。型では止めきれない組み合わせ（array の `uiType` と要素の型が合わないとき、rest 付きの tuple）は、例外で描画ごと落とさず、その欄の場所に「このスキーマの組み合わせは、このフォームでは扱えません」と出し、`console.error` に理由を出す。`multipleString` に string 以外の要素を渡したとき、値を黙って捨てていたのも止める
