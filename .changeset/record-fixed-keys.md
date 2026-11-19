---
"@zodapp/zod-form": minor
"@zodapp/zod-form-react": minor
"@zodapp/zod-form-mantine": minor
---

キーの決まった record（`z.record(z.enum([...]), …)`、`z.record(z.literal([...]), …)` など）を、キーごとの固定の欄として表示するようにした。キーの名前には選択肢の label を使う。`getDefaultValue` は足りないキーに値の既定値を入れる。`z.partialRecord` と文字列のキーの record は今までどおり。キーの検査のエラー（`invalid_key`）は record の欄に、キーの検査の文言で出す（entries の見た目では、そのキーの欄に出す）。
