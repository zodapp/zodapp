# zf.intersection を描く

今の仕様は [zf.intersection](../../packages/zod-form-mantine/docs/intersection.ja.md)、[object の入れ物](../../packages/zod-form-mantine/docs/object.ja.md)、[欄のエラーの受け渡し](../../packages/zod-form-react/docs/errors.ja.md) にあります。

## 目的

`z.intersection(a, b)`（`a.and(b)`）をフォームで描けるようにする。両側の欄を枠のまま並べる見た目と、枠を付けずに 1 つの object と同じ見た目で並べる見た目の両方を選べるようにする。

## 決めたこと

- **両側の部品を同じ path に並べて描く。** 両側の欄を集めて 1 つの object として描き直すことはしない。同じキーが両側にあれば欄が 2 回出るが、まとめずに開発中だけ警告する
- **入れ物の描き方を object と共通にし、`uiType: "flat"` を足す。** 子を `flat` にすると、入れ物を出さずに外側の並びにそのまま加わるので、intersection を 1 つの object と同じ見た目にできる
- **同じ path のエラーは、いちばん外側の部品が 1 回だけ出す。** そのために `hideError`（祖先が出すので出さない）と、同じ欄のすぐ外側の union を表す `errorToken` を部品の props に足した。union の腕を読み分ける仕組みも、context による受け渡しから `errorToken` に置き換えた
- **腕そのもののエラーは intersection に出す。** zod の issue には、どの schema から出たかが残らないので、腕のエラーと intersection 自身のエラーを見分けられない。腕の中に出したいときは `.refine(..., { path })` で欄を指す
- **知らないキー（`unrecognized_keys`）は、キーを持つ union の名前を並べて選択を促す。** discriminatedUnion の選んでいない腕のキーが残っているときがほとんどで、腕を選び直せば直るため

## 採らなかった案

- **issue の中身（code・文言・path）を照合して、腕のエラーと intersection のエラーを見分ける。** 同じ中身の issue が重なると、出たり消えたりするため
- **`unrecognized_keys` を、キーを持つ union に振り分けて、その union の中に出す。** intersection から union に向けて `writtenBy` を付けて書く仕組みが要るため
