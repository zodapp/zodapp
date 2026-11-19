---
"@zodapp/zod-form-react": patch
"@zodapp/zod-form-mantine": minor
"@zodapp/zod-form-widget": patch
---

set（`z.set`・`zf.set`）を描く。順序の無い集合として値全体を 1 つの欄で扱い、Set を書き込む。要素が enum・literal の union・値を複数持つ literal なら複数選択（`multipleEnum` と同じ見た目）、string・number ならタグ入力（`multipleString` と同じ見た目。重複は入らない）、それ以外は「扱えません」の注記を出す。set の下の issue（要素の検査のエラーを含む）は、すべて set の欄に出る。zod-form-react の値の比較（`isEqualValue`）は、Set・Map を中身で比べる（今までは中身が違っても「同じ」になっていた）。AutoForm などの値のプレビュー（`showPreview`）は、Set を配列、Map を [キー, 値] の配列として出す
