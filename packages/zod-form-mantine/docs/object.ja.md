# object の入れ物と、optional な object

object と intersection は、子の欄を並べる入れ物を同じ関数（`container.tsx`）で描きます。入れ物の形は、その schema の meta の `uiType` で決まります。

| `uiType` | 入れ物 |
|---|---|
| なし（既定） | InputWrapper。ラベルがあれば出す |
| `box` | Fieldset で囲む |
| `horizontal` | 子を横に並べる（折り返さない） |
| `horizontal-wrap` | 子を横に並べ、折り返す |
| `flat` | 入れ物を出さず、子だけを返す |

- 横並びでは、子を div で包んで flex に並べます。子が `flat` なら、その div を `display: contents` にして、子の欄が外側の flex の項目に直接なるようにします
- 子が `flat` かは、子の schema の meta の `uiType` で決めます。optional・nullable・default などの包みの中にあるときは、包みを外して見ます
- 入れ物には、その path のエラーを出します。最後の子の欄のエラーと見分けられるよう、欄のエラー（入力欄の 5px 下）より離して出します（InputWrapper の error に `marginTop: 8`）

## `flat` のときのエラー

`flat` は入れ物を出さないので、自分の path のエラーがあるときだけ、子のあとに Mantine の `Alert`（`color="red"`、`variant="light"`、`IconAlertCircle`）を 1 つ出します。

- 横並びの中では、Alert を幅いっぱいにして次の行に出します（flex の項目として `flex-basis: 100%`）
- `horizontal`（折り返さない）の中でも Alert だけは折り返すよう、子に `flat` があるときは外側の flex を `flex-wrap: wrap` にします。`flat` でない子の幅は変えません

## optional・nullable な object

optional・nullable な object は、0..1 の UI（＋と削除）で描きます。intersection も同じ部品（`OptionalObjectImplement`）を使います。

- 値が無い（`undefined`・`null`）ときは＋だけを出します。＋で `getDefaultValue(schema)` を書きます
- 値があるときは、子を枠で囲み、左に削除のボタンを出します。削除で空の値（`emptyValueOf`。optional なら `undefined`、nullable だけなら `null`）を書きます
- 横並び（下揃え）の中に置いても、隣の欄と下端がそろうようにします。＋だけの状態では、＋の行の高さを入力欄の高さに合わせます。設定済みの状態では、枠の中の入力欄の下端が隣の入力欄の下端とそろうように、枠の余白を決めています

0..1 の UI をやめて中身を平らに描く指定（`uiType: "flatten"` など）はありません。
