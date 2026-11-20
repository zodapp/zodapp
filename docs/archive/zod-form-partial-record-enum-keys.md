# キーが enum の partialRecord の見た目を直す

今の仕様は [zod-form-mantine の README](../../packages/zod-form-mantine/README.ja.md) の「record の見た目」にあります。

## 目的

`z.partialRecord(z.enum([...]), ...)` は、キーを文字で打つ entries の見た目になっていた。使えるキーが画面からわからず、enum に無いキーを打つとエラーになる。zod の `partialRecord` はキーの schema を複製して `_zod.values` を消すので、`enumeratedRecordKeys` からは「列挙できない record」に見えていた。partialRecord は「キーごとに optional な object」と同じ意味なので、見た目もそれに合わせる。

## 決めたこと

- **キーの候補は、キーの schema の def から取り出す（`partialRecordKeys`）。** enum・literal・その union を列挙する。ラベルは複製元を `_zod.parent` でたどって registry の meta から読む
- **見た目は 2 つにする。** 既定は、候補のキーを全部固定の欄で並べ、各欄を optional の見た目にする（キーが少ないとき向け）。`uiType: "entries"` は、値にあるキーだけを行で並べ、いちばん下の選択でキーを足す（キーが多いとき向け）。どちらもキーの名前は書き換えられず、enum に無いキーは作れない
- **空にした欄は、undefined を入れずにキーごと消す。** zod の partialRecord は、値にあるキーの値を値の schema で検証するので、`{ alice: undefined }` はエラーになるため。値の schema 自体が optional でも、JSON で区別できないので消す
- **entries の行の並びは meta の `keyOrder` で選ぶ。** 既定は定義順（キー順を残さない Firestore・DynamoDB 向け）、`"value"` は値の順（キー順を残す zod-searchparams・localStorage 向け）。整数に見えるキーは JS の object が数の順に並べるので、`"value"` でも足した順にならない
- **キーを列挙できない record（`z.string()` のキーなど）は変えない。** 既定値（`{}`）も変えない
