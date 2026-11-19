# zf.intersection

`zf.intersection(a, b)`（`z.intersection`・`.and()` も同じ部品で描きます）は、両側が同じ path の値を受け持つので、両側の部品を同じ path に並べて描きます。

## 描き方

- `schema.def.left`・`schema.def.right` を、同じ fieldPath の `Switch` で左・右の順に並べます。入れ子（`a.and(b).and(c)`）もそのまま入れ子に描きます
- 子には、同じ `fieldPath`、左・右の `schema`、同じ `defaultValue`、`readOnly`、`hideError={true}` を渡します。`label` と `outer` は渡しません（子は自分の meta のラベルを使います）
- 入れ物は、intersection の meta の `uiType` で決まり、object と同じ関数で描きます（[object の入れ物](object.ja.md)）。両側を枠のまま並べることも、子を `flat` にして 1 つの object と同じ見た目で並べることもできます
- optional・nullable な intersection は、object と同じく＋・削除の行で出します（[optional・nullable な object](object.ja.md)）
- 両側が（包みを外して）object で、同じキーを持つときは、その欄が 2 回出ます。まとめずにそのまま出し、開発中（`NODE_ENV !== "production"`）だけ、schema ごとに 1 回 `console.warn` で知らせます

両側の欄を集めて 1 つの object として描き直すことや、同じキーの欄を 1 つにまとめることはしません。

## エラーの出る場所

同じ path のエラーは、いちばん外側の intersection の入れ物に 1 回だけ出します。子には `hideError` が届くので、子の部品は同じ path のエラーを出しません（[同じ欄のエラーの受け渡し](../../zod-form-react/docs/errors.ja.md)）。

intersection の中の discriminatedUnion・union が同じ path に出す issue は、次のように出ます。

| 状況 | code | 出す部品 |
|---|---|---|
| 値が `undefined`・`null` | `invalid_type` | intersection |
| 値が object でない | `invalid_type` | intersection |
| 選んだ腕の、path を指定しない `.refine()` | `custom` | intersection |
| 選んだ腕が strictObject で、知らないキーがある | `unrecognized_keys` | intersection（下の文言） |

- 腕そのもののエラー（腕の object の path を指定しない `.refine()` など）は、zod の issue にどの schema から出たかが残らず、intersection 自身の issue と見分けられません。そのため intersection に出します。腕の中に出したいときは `.refine(..., { path: ["phone"] })` のように欄を指します
- 値が空のとき、union は「選択してください」を重ねて出しません（[腕が未選択のとき](union.ja.md)）
- discriminator が無い・どの腕にも合わないときの `invalid_union`（discriminator の欄に出る）と、腕の子の欄のエラーは、intersection とは関係なく今の場所に出ます

### 知らないキー（`unrecognized_keys`）の文言

zod の intersection は、両側とも知らないキーだけを、intersection の path に 1 つの `unrecognized_keys` として出し直します。discriminatedUnion の選んでいない腕にあるキー（腕が替わった保存データに前の腕の欄が残っているときなど）もここに入りますが、これは腕を選び直せば直ります。

そこで、キーごとの文言ではなく、キーを持つ union の名前を並べて選択を促します（`unrecognizedKeysMessage`）。

- `issue.keys` のキーごとに、そのキーをどれかの腕に持つ discriminatedUnion を schema からたどって探します。たどる範囲は、包みを外した先、intersection の両側、discriminatedUnion の全部の腕で、path が変わる子の欄には入りません
- 見つかった union の名前を、見つけた順に「と」でつなぎ、「連絡方法と会員タイプを選択してください」と出します。名前は `selectorLabel`、無ければ `label`、どちらも無ければ「タイプ」です
- schema のどこにも無いキーしか無いときは、画面で直せないデータの不具合なので、errorMap の文言をそのまま出します。見つかるキーと見つからないキーが混ざるときは、作り直した文言を出します
