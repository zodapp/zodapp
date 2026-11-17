# literal の union を enum のように選ぶ（uiType: "select"）プラン

- ステータス: プラン（未実装）
- 対象ブランチ: `claude/union-arm-errors-v2`
- 対象パッケージ: `@zodapp/zod-form-mantine`、`@zodapp/zod-form-mantine-lite`（utils）、`apps/form-demo`

---

## 1. 背景

`zf.union([zf.literal(10), zf.literal("abc")])` のように、literal の union を enum の代わりに使いたい。
数値と文字列を混ぜられること、literal ごとにラベルを付けられることが、enum に対する利点。

今の `union` の部品でも値は正しく選べる（選ぶと `10` や `"abc"` が入り、optional なら × で消せる）。
ただ、union の部品は「腕を選んで、腕の中身を入力する」ためのもので、enum の代わりとしては次の点が重い。

- 枠（Fieldset）の見出し（`label`）と、選択の欄（`selectorLabel`）が別々に出る
- 選んだ腕（literal）を literal の部品で描くので、選択の欄の下に値（`abc`）がそのまま出る

## 2. 方針

部品は `componentLibrary` から `型名_uiType` で探される（`switch.tsx`）。zf.union の登録でも `uiType` は書ける。
そこで、literal の union に uiType を付けると、union の部品ではなく、enum と同じ作りの部品で描く。
中の作りは union の部品を使わず、enum の部品と同じにする（軽くするため）。

### 2.1 4 つの形

| 形               | 書き方                                                                                            | 部品                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 一つ選ぶ         | `zf.union([...literal]).register(zf.union.registry, { label, uiType: "select" })`                 | `union_select`（新規）                                                         |
| 一つ選ぶ・バッジ | 同じく `uiType: "badge"`                                                                          | `union_badge`（新規。`union_select` と同じ部品で、バッジで出す）               |
| 複数選ぶ         | `zf.array(zf.union([...literal])).register(zf.array.registry, { label, uiType: "multipleEnum" })` | `array_multipleEnum`（今の部品を、要素が literal の union でも動くようにする） |
| 複数選ぶ・バッジ | 同じく `uiType: "multipleEnumBadge"`                                                              | `array_multipleEnumBadge`（同上）                                              |

- バッジの uiType は、enum（`enum_badge`）にそろえて `"badge"` にする
- 複数選ぶ形は、配列の uiType を enum と同じにし、要素が enum でも literal の union でも動くようにする（新しい uiType は足さない）

### 2.2 選択肢と値

- 選択肢は、各腕（literal）の `label` と `color` から作る。ラベルが無ければ値を文字にしたもの
- Select とは、腕の番号（`"0"`・`"1"`…）を文字にしたものでやりとりする。選んだら、その番号の腕の literal の値（数値 10 や文字列 "abc"）を書く。今の値から番号へは、literal の値と `===` で比べて戻す。番号は Select の中だけで使い、フォームの値や外には出さない
- 腕が literal でないとき（object など）は、この部品では選べない。その腕は選択肢に出さず、開発中に警告を出す
- 番号でやりとりするので、`literal(10)` と `literal("10")` のように文字にすると同じになる腕も区別できる（Select の値が文字列しか扱えないのは Mantine の都合で、値の側の制約ではない）。bigint・null など、JSON にできない literal も同じく扱える

選択肢を作る処理は、今の `useEnumData`・`toEnumOptionValue`・`fromEnumOptionValue`（mantine-lite の utils）を、
「値とメタの一覧」を受け取る形に広げ、enum と literal の union で同じものを使う。
literal の union では、選択肢の値を腕の番号にする（enum は今のまま、値を文字にしたもの）。

### 2.3 空・optional・nullable・選択肢に無い値

enum の部品と同じにする。

- 必須でなければ × で消せる。消したときは `emptyValueOf` の値を書く（optional なら undefined、nullable だけなら null）
- 選択肢に無い値は、enum の `unlisted` と同じ扱い（既定は消す。`keep` なら「（不正な値）」と出してエラーにする）
  - zf.union の登録には `unlisted` が無いので、足す（`union_select` でだけ使う）
- 読み取り専用では、選んだ選択肢のラベル（バッジなら色付き）を出す

### 2.4 エラー

literal の union の検証エラーは、zod では `invalid_union`（腕ごとの `invalid_value` を中に持つ）になる。

- `wrapComponent` は `invalid_union` を欄に出さない（union の部品が読んで、選んだ腕のエラーとして足す前提のため）
- 日本語の error map では、`invalid_union` の文言は空になる

そのため、この部品では欄のエラーを自分で読み、`invalid_union` を次の文言にする。

- 値が無い（undefined・null を受け付けないとき）：「必ず入力してください。」（ほかの必須の欄と同じ文言）
- 値があるのに、どの腕にも合わない：「選択肢に無い値です。選び直すか、消してください。」（enum の unlisted と同じ文言）

ほかのエラー（union の外側の `.refine()` など）は、そのまま出す。複数選ぶ形では、要素ごとの `invalid_union` を同じ考えで扱う。

## 3. デモと e2e

form-demo に「literal の union を選ぶ」ページを足す。

- 一つ選ぶ（必須、数値と文字列の混在）、一つ選ぶ・optional、一つ選ぶ・バッジ、複数選ぶ、複数選ぶ・バッジ
- e2e：
  - 選ぶと、数値の腕なら数値、文字列の腕なら文字列が入る
  - optional なら × で undefined に戻る（nullable だけなら null）
  - 必須のまま空で送信すると「必ず入力してください。」が出る
  - 複数選ぶ形で、選んだ値が配列に入り、全部外すと空になる
  - バッジの形で、選んだ選択肢がバッジで出る

## 4. 確かめること

- 単体テスト：選択肢の作り方（ラベル・色、`literal(10)` と `literal("10")` を区別できること）、値の書き方、エラーの文言
- 今の union・enum・複数選ぶ部品の単体テストと e2e がすべて通ること

## 5. 扱わないこと

- reactive 版（mantine-lite の reactiveComponents）の部品。要るなら別に足す
- literal 以外の腕を持つ union を、この部品で描くこと
