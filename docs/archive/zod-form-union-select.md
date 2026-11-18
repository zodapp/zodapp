# literal の union を、enum のように選ぶ（`uiType: "select"`・`"badge"`）

今の仕様は [zf.union](../../packages/zod-form-mantine/docs/union.ja.md) の「literal の union を選択肢として選ぶ」にあります。

## 目的

`zf.union([zf.literal(10), zf.literal("abc")])` のような literal の union を、enum の代わりに使えるようにする。数値と文字列を混ぜられること、literal ごとにラベルと色を付けられることが、enum に対する利点。union の部品は「腕を選んで、腕の中身を入力する」ためのもので、enum の代わりとしては、枠の見出しと選択の欄が別々に出る、選んだ literal の値がそのまま下に出る、と重かった。

## 決めたこと

- **`uiType` を付けた literal の union は、union の部品ではなく、enum と同じ作りの部品で描く。** 選択肢を作る処理は enum と共通にする。複数選ぶ形は、配列の uiType を enum と同じにし、要素が enum でも literal の union でも動くようにした（新しい uiType は足さない）
- **Select とは、腕の番号でやりとりする。** Select は文字列しか扱えないが、`literal(10)` と `literal("10")` を区別し、bigint・null・undefined も選べるようにするため。番号は Select の中だけで使い、値には出さない
- **null・undefined の腕は、外側の optional・nullable より優先する。** undefined の腕があれば外側の optional は無いものとして扱い、残ったものから × の有無と × で書く値を決める。値に null・undefined を選べることと、× で空にすることを、両立させるため
- **`invalid_union` を、欄の文言に作り直す。** 共通の表示は `invalid_union` を出さず、日本語の文言も空なので、値が無ければ「必ず入力してください。」、合う腕が無ければ enum の unlisted と同じ文言にする
