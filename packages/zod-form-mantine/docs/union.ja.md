# zf.union

union の部品は、腕を選ぶ欄（セレクト）と、選んだ腕の欄を出します。discriminatedUnion は選んだ discriminator を、discriminator の無い union は選んだ腕を覚えて描きます。

## 腕の選び方（discriminator の無い union）

利用者が選んだ腕は、値がまだ検証に通らなくても、そのまま表示し続けます。値が外から変わったとき（フォームのリセット、計算値の書き込みなど）は、覚えている腕と値を次の規則で突き合わせます。

| 値 | 表示する腕 |
|---|---|
| 覚えている腕に通る | そのまま（ほかの腕にも通っても切り替えない） |
| 覚えている腕には通らず、ほかの腕に通る | 通った最初の腕 |
| どの腕にも通らない | 覚えている腕のまま（入力の途中） |

- 最初の表示では、値に通る最初の腕を選びます。どの腕にも通らなければ、object の腕の literal の欄（`type: z.literal("phone")` など、値が 1 つの `ZodLiteral`）で推定します。literal の欄がすべて一致する腕が 1 つだけならその腕、それ以外は未選択です。途中まで入力して保存したデータを開き直したとき、腕が空欄にならないようにするためです
- 推定できないときは、値を書き換えずに未選択で開きます

## 腕の切り替え

- 切り替えでは検証しません。値は `runAsUserEdit` で利用者の編集として書き、欄とフォーム全体の onChange・onBlur のエラーを消します。切り替えた直後に、まだ触っていない欄が赤くならないようにするためと、残ったフォーム全体のエラーで最初の送信が止まらないようにするためです
- 書く値は、その腕に通るなら今の値、通らなければその腕の既定値です。どの腕にも無いキーは消しません（intersection で並べた object の欄の値を残すため）
- nullable の union で、腕の既定値が `undefined` なら `null` を書きます
- optional・nullable の union は、× で腕を外して空の値（`emptyValueOf`）を書きます。discriminatedUnion で選んでいる腕をもう一度選んだときも同じです

## 腕のエラー

zod の union は、腕の子の欄の型のエラー（必須の欄が空・型が違う）を、union の欄の `invalid_union` にまとめます。union の部品はこれを読み、選んだ腕のエラーとして配ります（置き場所は [union の腕のエラー](../../zod-form-react/docs/errors.ja.md)）。

- 腕そのもの（path が union の欄）の issue は、`writtenBy` を付けて同じ欄に足します。object の腕の子の欄の issue は、その欄に配ります
- 片付けでは、自分が書いたもの（`writtenBy` が自分のもの）だけを消します。腕が変わったとき、`invalid_union` が消えたとき、部品が外れたときです
- union の欄の値が変わったら（子の欄の入力でも変わります）、自分の欄の onBlur のエラーを消します。子の欄を離れずに直したときに、古いエラーが残らないようにするためです
- 欄のエラーを子に配るときは、union の欄の path を外してから配り、union の欄より下を指さないものは配りません

## 腕が未選択のとき

腕が未選択で、次のどれかがあれば、腕を選ぶ欄に「選択してください」を出します。出す時機はほかの欄と同じ（触ったか送信したか）です。

- union の欄の、読み込み中以外のエラー（code は問いません）
- discriminatedUnion の discriminator の欄（`[union の欄, discriminator]`）のエラー。discriminator の無い保存値ではここに出ますが、この欄は描かれないためです

ただし、`hideError` を受け取っていて、union の欄に外側が出すエラー（`invalid_union` 以外）があるときは、自分の欄のエラーからは出しません（intersection の「必ず入力してください。」と重ねないため）。`invalid_union` しか無いときは、ほかに出す部品が無いので `hideError` でも出します。

intersection の外の discriminatedUnion（腕は strictObject）に、選んでいない腕のキーが残った値では、腕を選ぶ欄に「連絡方法を選択してください」のように出します（[知らないキーの文言](intersection.ja.md)）。腕を選んでいるときも出し、`hideError` のときは出しません。腕の部品は、この `unrecognized_keys` を出しません。

## `uiType: "flat"`

union の Fieldset とその legend（union のラベル）だけを出しません。腕を選ぶ欄と腕の欄は出します（腕を選ぶ欄のラベルは `selectorLabel`、無ければ union の `label`）。自分の path のエラーは、object の `flat` と同じく Alert で出します（[object の入れ物](object.ja.md)）。

## literal の union を選択肢として選ぶ（`select`・`badge`）

literal の union を enum の代わりに使えます。数値と文字列を混ぜられること、literal ごとにラベルと色を付けられることが、enum に対する利点です。union の部品ではなく、enum と同じ作りの部品で描きます。

| 形 | 書き方 | 部品 |
|---|---|---|
| 一つ選ぶ | `zf.union([...literal])` に `uiType: "select"` | `union_select` |
| 一つ選ぶ・バッジ | 同じく `uiType: "badge"` | `union_badge` |
| 複数選ぶ | `zf.array(zf.union([...literal]))` に `uiType: "multipleEnum"` | `array_multipleEnum` |
| 複数選ぶ・バッジ | 同じく `uiType: "multipleEnumBadge"` | `array_multipleEnumBadge` |

**選択肢と値**

- 選べる腕は、literal に入る値（文字列・数値・bigint・boolean・null・undefined）すべてです。`z.null()`・`z.undefined()` の腕も同じに扱います（ラベル・色は `zf.common.registry` で付けます）。値を複数持つ literal（`z.literal(["a", "b"])`）は、値ごとに選択肢を出します
- 選択肢のラベル・色は各腕の meta から取ります。ラベルが無ければ値を文字にします（bigint は `10n`、null は `null`、undefined は `undefined`）
- Select とは、腕の番号と値の番号（`"0"`、複数の値なら `"0.1"`）でやりとりし、選んだらその腕の値をそのまま書きます。`literal(10)` と `literal("10")` のように文字にすると同じになる腕も区別できます。番号は Select の中だけで使います
- literal でない腕は選択肢に出さず、開発中に警告します
- 選択肢に無い値は、enum の `unlisted` と同じに扱います（既定は消す。`keep` なら「（不正な値）」と出してエラーにする）。Select に渡す文字列は `unlisted:` で始めます。複数選ぶ形で `keep` で残した値は、ほかを選んだときも元の値のまま書きます

**空の値と、optional・nullable**

腕で表せる空の値は、外側の optional・nullable より腕を優先します。undefined の腕があれば外側の optional を、null の腕があれば外側の nullable を、無いものとして扱い、残ったものから × で書く値（`emptyValueOf`）と必須の印を決めます。

| 外側 | 腕 | × | × で書く値 |
|---|---|---|---|
| optional | undefined の腕 | 出さない | — |
| nullable | null の腕 | 出さない | — |
| optional・nullable | undefined の腕 | 出す | `null` |
| optional・nullable | null の腕 | 出す | `undefined` |
| optional・nullable | 両方の腕 | 出さない | — |

- 外側に何も無い必須の欄は、enum と同じく × を出します
- 値が腕の値（undefined・null）なら、その腕が選ばれた表示にします。初期値が無く undefined の腕があれば、最初からその腕が選ばれて見えます
- 複数選ぶ欄は、× で配列ごと消すので、要素の腕とは関係しません

**エラー**

literal の union の検証エラーは `invalid_union` になり、共通の表示では出ません。この部品は欄のエラーを自分で読み、次の文言にします。

- 値が無い（空の値を受け付けないとき）：「必ず入力してください。」
- 値があるのに、どの腕にも合わない：「選択肢に無い値です。選び直すか、消してください。」

ほかのエラー（union の外側の `.refine()` など）はそのまま出します。複数選ぶ形では、要素ごとの `invalid_union` を同じ考えで扱います。
