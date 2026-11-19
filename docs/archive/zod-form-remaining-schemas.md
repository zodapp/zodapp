# 残りの非対応スキーマに対応する

今の仕様は [zod の型ごとの描き方](../../packages/zod-form-mantine/docs/schema-types.ja.md) と [既定値と値の調整](../../packages/zod-form/docs/default-value.ja.md) にあります。

## 目的

[非対応スキーマへの対応](zod-form-unsupported-schemas.md) のあとに残った型を扱う。部品の無い型は「Component not found」になり、送信が理由も出ずに止まるものと黙って通るものがあった。包む型（`.readonly()` など）は中が描かれず、数値の enum は選択肢の名前が値になり、optional の付かない再帰は描画が終わらず、`zf.computed()` は `.optional()` を付け忘れると送信が止まった。

## 決めたこと

- **包む型（`.readonly()`・`.catch()`・`.nonoptional()`・`.prefault()`）は、包みを外して中を描く。** `.readonly()` は値を凍らせるだけで入力の可否ではないので、読み取り専用にはしない
- **欄の無い型（`any`・`unknown`・`custom`・`symbol`・`function`・`never`）は、欄を出さず値を保って送る。** `z.nan()` は値が 1 つに決まるので固定値として扱う
- **object の形で書いた enum は、label が無ければキーを選択肢の名前にし、検証を通らない値を選択肢から外す。** 数値の TS enum の逆引きのキーもこれで消える
- **`z.promise()` と非同期の検査は、例外を握って送信が止まった理由として出す。** 同期の `safeParse` が例外を投げ、送信の処理ごと終わっていたため。非同期の検証への対応はしない
- **どの部品にも当たらない型は、辞書の文言の「扱えない」注記と、型の名前を入れた `console.error` にする**
- **optional の付かない再帰は、lazy の入れ子の数の上限（既定 10、`maxDepth`）で止める。** 同じ schema かどうかの検出は、zod の内部の動きに頼ることになり危ういので入れない
- **`zf.computed()` は初めから optional を含める。** 値を持たない表示専用の欄なので

扱わないこと：`z.success()`（ドキュメントに無い API。共通の扱いに任せる）、非同期の検証への対応。
