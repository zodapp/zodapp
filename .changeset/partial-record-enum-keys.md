---
"@zodapp/zod-form": minor
"@zodapp/zod-form-mantine": minor
---

キーが enum・literal の `z.partialRecord` の見た目を変える。

- 既定：候補のキーを全部、キーの決まった record と同じ固定の欄で並べ、各欄は optional の見た目にする。空にした欄は、値に undefined を入れずにキーごと消す
- `uiType: "entries"`：値にあるキーだけを行で並べ、各行は削除だけできる。いちばん下の選択（文字で絞り込める）で、まだ無いキーを足す。行の並びは record の meta の `keyOrder`（`"definition"` 既定・`"value"`）で決める
- `@zodapp/zod-form` に、partialRecord のキーの候補を返す `partialRecordKeys` を足す
