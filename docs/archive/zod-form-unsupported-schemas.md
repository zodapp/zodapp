# zod-form の非対応スキーマに対応する

今の仕様は [zod の型ごとの描き方](../../packages/zod-form-mantine/docs/schema-types.ja.md)、[zf.dynamic の値の扱い](../../packages/zod-form-react/docs/dynamic.ja.md)、[既定値と値の調整](../../packages/zod-form/docs/default-value.ja.md)、zod-form-widget の README の「開くときの値」、zod-form-mantine の README の「フォームで使えないキー」にあります。

## 目的

約 90 種類の zod スキーマを jsdom で描画・入力・送信して調べ、「対応した方が良いもの」を直す。型は `z.output` なのに onSubmit に生の値が届く、`.transform()` の欄が出ない、codec・stringbool が送信できない、値が複数の literal が選べない、キーが enum の record が送信できない、`.` を含むキーで値が壊れる、`z.file()` でフォームごと落ちる、などがあった。

## 決めたこと

- **`z.*` と `zf.*` のどちらで書いても同じに動かす。** 部品は zf の名前で探し、無ければ zod の型の名前で探すので、zod の型（`schema.type` と `def`）を基準に作る。zf の名前が zod の型の名前と同じなら、その zod の型を必ず受け付ける。独自の名前は zod の型の名前と重ねない
- **`zf.file` を `zf.externalFile` に改名する。** 値は外に置いたファイルを指す文字列で、`z.file()`（File オブジェクト）と名前が重なっていた。互換の別名は残さない（まだ npm に出ていないため）
- **onSubmit には parse した値を渡す。** dynamic の output を先に値へ差し込んでから、静的な schema で parse する。後から差し込むと、外側の transform で output の形が変わり、差し込み先が無くなるため
- **`zf.dynamic()` の土台を `z.never()` から `z.unknown()` にする。** never では静的な parse が必ず落ち、隣の `.refine()` が黙って効かなかった
- **pipe は入口の型で描く。** 検証は pipe 全体で行うので、値は入口の型でなければ通らないため
- **固定値（値が 1 つの literal・null・undefined・void）は既定で出さない。** 見せたいときだけ `hidden: false`。これで union の腕の中の discriminator も二重に出なくなる
- **AutoForm が開くときに既定値を補う。** 固定値を部品から書き込むと、描く前の検証にキーが無く見え、「変更あり」に見え、描かれない欄に効かなかった。値は `getDefaultValue` で補い、部品は書き込まない。AutoSearch は補わない（検索の条件が変わるため）
- **キーを列挙できる record は、zod と同じ基準（`keyType._zod.values`）で固定の欄にする。** zod はすべてのキーを必須として検証するのに、キーを足す手段が無かった
- **`.`・`[`・`]`・空文字のキーは非対応にし、場所ごとに弾く。** TanStack Form の欄の名前にエスケープの書き方が無いため。保存されていた値にあっても送信は止めず、編集できない行とエラーと消すボタンを出す
- **型で縛りにくい組み合わせ（tuple の rest、array の uiType と要素）は、例外で落とさず、その場所に非対応の注記を出す**
