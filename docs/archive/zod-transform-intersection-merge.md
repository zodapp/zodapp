# zod-transform：intersection のマージを、元の値との差分で行う

今の仕様は [zod-transform の README](../../packages/zod-transform/README.ja.md) の「intersection のマージ仕様」にあります。

## 目的

`z.object({ a: z.date() }).and(z.object({ b: z.string() }))` のような intersection で、left 側の変換が効くようにする。

それまでは、left と right を同じ元の値から別々に変換し、浅くマージしていた。object は shape にないキーを変換せずに通すので、right が通した変換前の `a` が、left の変換結果を上書きしていた。同じキーの中の別々のフィールド（`meta.x` と `meta.y`）を両側が変換するときも、片方が失われた。利用側では、intersection を平らな object に組み直して避けていた。

## 決めたこと

1. **元の値との差分でマージする。** Schema を解析してキーを分けるのではなく、left・right の結果を元の値と（`Object.is` で）比べ、変わった側を採る。union・lazy・pipe・catchall・record が混ざっても同じ規則で動くため。plain object と同じ長さの配列は、キーごと・要素ごとに再帰する
2. **片側が取り除き、もう片側が値を通しただけなら、取り除く。** それまでの「right にあれば復活する」をやめた
3. **両側が別々の値に変換して食い違ったら、right を採る**（それまでと同じ）

## 採らなかった案

- **Schema を解析して、キーごとにどちらの側が受け持つかを決める。** union・lazy・catchall・record などが混ざると、受け持ちを静的に決められないため
