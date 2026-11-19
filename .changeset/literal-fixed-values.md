---
"@zodapp/zod-form": patch
"@zodapp/zod-form-react": patch
"@zodapp/zod-form-mantine-lite": minor
"@zodapp/zod-form-mantine": minor
---

literal 系を共通の作りで扱う。値が 1 つに決まる型（値が 1 つの literal・`z.null()`・`z.undefined()`・`z.void()`）は「固定値」として既定で出さず、フォームの値が無ければ部品がその値を書き込む（触った扱いにせず、検証もしない。optional のときは書き込まない）。meta で `hidden: false` と明示すると、readOnly と同じ表示でスキーマの値を出す（必須の印は付けない）。これで discriminatedUnion の腕の中の discriminator や、union の literal の腕の値も出なくなり、`z.null()` などの Not found も出なくなる。値を複数持つ literal（`z.literal(["a", "b"])`）は enum と同じ部品で選べ（`uiType` の `select`・`badge` も同じ）、`multipleEnum` の要素にもできる。`getDefaultValue` は、値を複数持つ literal で例外を投げず、値を入れない。zod-form-react の `Switch` は、meta の無い schema で `"undefined"` の名前の部品を探さないようにした
