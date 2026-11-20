# 既定値と値の調整

[English](default-value.md)

## `getDefaultValue(schema, value?)`

schema からフォームの初期値を作ります。`value` を渡すと、その値を持ったまま schema を歩き、値が `undefined` のところだけを補います。入っている値は変えません。

- 配列の各要素、record の各値、object の各キー、union の選んだ腕の中も補います。初期値の木を別に作って重ねるのではなく、値と schema を一緒に歩くので、どの深さでも同じ規則になります
- `value` を省くと、schema だけから初期値を作ります
- 補えないとき（schema の形と値が合わないなど）は、値をそのまま返します
- AutoForm は、フォームを開くときに `defaultValues` をこれに通します（`@zodapp/zod-form-widget` の README の「開くときの値」）。固定値（値が 1 つの literal など）の値も、部品ではなくここで入ります

型ごとの初期値（値が `undefined` のとき）は次のとおりです。

| schema                                                       | 初期値                                                                                                            |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `.default(x)`・`.prefault(x)`                                | `x`（関数なら呼んだ結果）                                                                                         |
| object                                                       | `{}` に、子の初期値を入れたもの。`undefined` になったキーは置かない（キーが無いと検証結果が変わる子のキーは残す） |
| 配列                                                         | `[]`。長さの指定（`length`・`min`）があれば、その長さの `undefined`                                               |
| tuple                                                        | 要素の数の `undefined`                                                                                            |
| キーを列挙できる record（キーが enum・literal とその union） | 列挙したキーごとに値の初期値を入れたもの（初期値が `undefined` のキーは置かない）                                 |
| そのほかの record・Set・Map                                  | 空の値                                                                                                            |
| 値が 1 つの literal                                          | その値                                                                                                            |
| 値が複数の literal                                           | `undefined`                                                                                                       |
| `z.null()`                                                   | `null`                                                                                                            |
| `z.nan()`                                                    | `NaN`                                                                                                             |
| `z.undefined()`・`z.void()`                                  | `undefined`（object のキーは置く。キーが無いと zod の検証結果が変わるため）                                       |
| optional                                                     | `undefined`（中は歩かない）                                                                                       |
| `.nonoptional()`                                             | optional を外した中の初期値                                                                                       |
| nullable                                                     | 中が default なら（`.default("x").nullable()`）その値、中が optional を含むなら `undefined`、それ以外は `null`    |

- optional と nullable の両方が付いた欄（`.optional().nullable()`・`.nullable().optional()`）は、どちらの順でも `undefined` です
- nullable な object は `null` で始まり、＋で開くまで中の欄を出しません
- intersection は両側を別々に補い、両側が object ならキーを合わせます

### union の腕の選び方

値がある union では、次の順に腕を選び、その腕で歩いて補います。zf.union の部品が腕を決める規則（`@zodapp/zod-form-mantine` の [zf.union](../../zod-form-mantine/docs/union.ja.md)）にそろえています。

1. discriminatedUnion なら、discriminator の値が一致する腕
2. 値がそのまま検証に通る腕があれば、その最初の腕
3. object の腕で、literal の欄の値が一致する腕が 1 つだけなら、その腕
4. 決められなければ、値をそのまま返す（補わない）

歩いた結果が検証に通るかは問いません。入力の途中のデータ（必須の欄が空のまま保存したものなど）を補うためです。

## `pruneValueToSchema(value, schema)` と `adaptValueToSchema(value, schema)`

- `pruneValueToSchema`：schema に合わない値を消します
- `adaptValueToSchema`：合わない値を消してから補います（`getDefaultValue(schema, pruneValueToSchema(value, schema))`）。zf.dynamic で、利用者の編集がきっかけで schema が切り替わったときに使います（`@zodapp/zod-form-react` の [zf.dynamic の値の扱い](../../zod-form-react/docs/dynamic.ja.md)）
