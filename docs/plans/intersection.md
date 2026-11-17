# zf.intersection を描くプラン

- ステータス: プラン（未実装）
- 対象ブランチ: `claude/union-arm-errors-v2`（PR を分けるなら、今の PR のマージ後に新しいブランチ）
- 対象パッケージ: `@zodapp/zod-extendable`、`@zodapp/zod-form`、`@zodapp/zod-form-react`、`@zodapp/zod-form-mantine`、`apps/form-demo`

---

## 1. 背景

`z.intersection(a, b)`（`a.and(b)`）を、フォームで描けるようにしたい。

intersection の両側は、同じ path の値を受け持つ。描き方は「両側の部品を、同じ path に並べる」で足りる。
問題は見た目で、次の 2 通りが要る。

- 両側の object を、それぞれの枠（`box` など）のまま並べる
- 両側の object を、枠を付けずに「1 つの object と同じ見た目」で並べる

### 1.1 今の object の部品が足す DOM

jsdom で描いて確かめた。ラベルも uiType も無い内側の object は、次の div を 1 つ足す。

```
<div>                                    ← 外側の object が欄ごとに包む div（横並びでは flex の項目）
  <div .mantine-InputWrapper-root style> ← 内側の object の入れ物（上の余白・エラーの文言の場所）
    <div>                                ← 内側の object が欄ごとに包む div
      （欄）
```

- ラベルがあれば、InputWrapper の中にラベルの div が増える
- `uiType: "box"` なら、InputWrapper の代わりに `<fieldset>`・`<legend>`・InputWrapper の入れ子になる

縦並びなら、ラベルの無い object は今でもほぼ平らに並ぶ（違いは、上の余白が入れ子のぶん重なること）。
横並び（`horizontal`・`horizontal-wrap`）では、内側の欄は外側の flex の項目にならない。

## 2. 方針

**intersection の部品は、両側の部品を同じ path に並べるだけにする。
「枠を付けずに並べる」は、子の側（object・union）の uiType で選ぶ。**

両側を 1 つの object にまとめる（欄を集めて描き直す）作りにはしない。子の側で枠を消せれば、
object どうしだけでなく、object と union の intersection も同じ仕組みで並べられるため。

### 2.1 `zf.intersection` の登録

- zod-extendable に `extendIntersection` を足し、zod-form の `zf` に `intersection` を足す（meta は object と同じ共通の meta）
- 部品は `schema.type` でも探されるので、`zf` を使わない `z.intersection`・`.and()` も同じ部品で描く
- 部品は `componentLibrary` の `intersection` に登録する

### 2.2 intersection の部品

- 左・右の schema を、同じ path の `Switch` で、左・右の順に並べる
- intersection が入れ子（`a.and(b).and(c)`）でも、そのまま Switch で入れ子に描く（平らにまとめる処理はしない）
- intersection 自身の入れ物は、object と同じ uiType で決める
  - 既定：ラベルがあれば InputWrapper のラベルを出す
  - `box`：Fieldset で囲む
  - `horizontal`・`horizontal-wrap`：子の欄を横に並べる（2.3 の `flat` の子と組み合わせて使う）
- 子のラベルは、子の meta のまま（intersection が消さない）

### 2.3 「枠を付けない」uiType（`flat`）

object と union に `uiType: "flat"` を足す。

- object の `flat`：InputWrapper（ラベル・余白・エラーの文言の場所）も枠も出さず、欄（を包む div）だけを返す。縦並びなら、欄はそのまま外側の流れに入る（`display: contents` も要らない）
- union の `flat`：Fieldset を出さず、腕を選ぶ欄と腕の欄だけを返す
- 自分の path のエラーがあるときだけ、欄のあとにエラーの box を 1 つ出す（2.4）
- intersection の部品の中でなくても使える（object の中の object を平らに並べるなど）
- `display: contents` は主なブラウザで使える。div に付けるので、読み上げの問題も無い
- 外側が横並びのときは、外側の object・intersection が欄を包む div を `display: contents` にする必要がある。外側の部品は、子が `flat` のときだけ、包む div を `display: contents` にする（`flat` の部品自体には、消す入れ物がもう無い）

### 2.4 エラー（同じ path で重ならないようにする）

欄のエラーは `wrapComponent` が path ごとに読み、部品の `error` に渡す。同じ path に部品が 3 つ
（intersection・左・右）あると、3 つとも同じエラーを受け取り、object の部品は自分の入れ物の下にそれぞれ出す。

- 同じ path のエラーは、intersection の部品が 1 か所にまとめて出す
- intersection は子に「この path のエラーは出さない」と伝え、子は自分の path のエラーを出さない
  - 伝え方は、Switch に渡す props か context にする（実装のときに決める。`same-path-experiment.md` の案F で props をまとめる流れに合わせる）
  - 子の中の欄（path が違うもの）のエラーは、今までどおり各欄に出す
  - `box` のままの子も、この指示に従って出さない
- `flat` の object・union は、InputWrapper を出さないので、自分の path のエラーを出す場所を別に作る
  - エラーがあるときだけ、欄のあとにエラーの box を 1 つ出す。エラーが無ければ何も出さない
  - box は `uiType: "box"` と同じ仕組み（Mantine の Fieldset）で描き、枠の見た目をそろえる。中身はエラーの文言だけ
  - 特定の欄の下の赤い文言とは違う見た目になるので、欄のまとまりについてのエラーだと分かる
  - 横並びのときは、box を 1 行ぶんの幅にして（flex の項目として幅いっぱい）、次の行に出す。`horizontal`（折り返さない）の中でも box だけは折り返す必要があるので、外側の部品の並べ方を少し変える
  - intersection の中では「この path のエラーは出さない」と指示されるので、box も出さない
- union は今も、自分の path のエラーを同じ path の腕の部品に出させている。intersection の中の union では、腕の部品にもこの指示が伝わり、腕の部品は出さない（intersection が出す）

### 2.5 同じキーが両側にあるとき

両側の部品がそれぞれ描くので、同じキーの欄が 2 回出る。そのまま 2 回出し、開発中に警告を出す
（schema の書き方で避けてもらう）。

### 2.6 値・既定値・検証

- 検証は今までどおりフォーム全体の schema で行う（intersection を特別扱いしない）
- `getDefaultValue`・`pruneValueToSchema` は zod-transform の intersection の処理（`zod-transform-intersection.md`）を通る。intersection を含む schema で、既定値と削る処理が正しく動くかを単体テストで確かめ、足りなければ直す

### 2.7 optional・nullable な intersection

外側の `.optional()`・`.nullable()` は intersection の部品が受け取り、子には渡さない（`outer` は渡さない）。
値が無いときの見せ方（object の＋・削除の行と同じにするか）は、実装のときに object の部品と合わせて決める。

## 3. デモと e2e

form-demo に「zf.intersection」のページを足す。

- 2 つの object の intersection（既定：それぞれの枠のまま）
- 2 つの object を `flat` で 1 つの object のように並べる（縦並び・横並び）
- object と discriminatedUnion の intersection（union も `flat`）
- intersection 全体の `.refine()` のエラーが 1 回だけ出ること

e2e で確かめること：

- 両側の欄に入力した値が、同じ object に入ること
- `flat` の子の欄が、外側の object の欄と同じ並び（横並びでは同じ行）に出ること
- 同じ path のエラーが 1 回だけ出ること
- object と union の intersection で、腕を切り替えると腕の欄が変わり、共通の欄の値が残ること

## 4. 扱わないこと

- 両側の object の欄を集めて、1 つの object として描き直すこと（2. の方針で不要）
- 同じキーの欄を 1 つにまとめて描くこと（2.5）
- intersection の中でだけ子を `flat` にする指定（子の uiType より優先する、intersection の meta）。要るなら後から足す
- reactive 版（mantine-lite の reactiveComponents）の部品
