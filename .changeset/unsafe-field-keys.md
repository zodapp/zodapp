---
"@zodapp/zod-form-react": minor
"@zodapp/zod-form-mantine": minor
---

フィールドパスに使えないキー（`.`・`[`・`]` を含む、空文字）を扱うようにした。`isUnsafeFieldKey` を追加。object の shape・キーの決まった record のキーにあれば、その欄の場所に「このキー名は使えません」と出す。record の entries ではそのキーを入れられないようにし、record に保存されていた値にあれば、編集できない行（キー・注記・エラー・消すボタン）として出して、値はそのまま送る。
