# キーが enum の partialRecord の見た目を直すプラン

- ステータス: 実装済み
- 対象ブランチ: `claude/project-thread-t5tgbw`
- 対象: `@zodapp/zod-form`（キーの候補の取り出し）、`@zodapp/zod-form-mantine`（record・record の entries）、`apps/form-demo`（デモ・e2e）

---

## 1. 背景

`z.partialRecord(z.enum(["alice", "bob", "carol"]), z.string())` は、今は「キーが文字列の record」と同じ entries の見た目（キーを文字で打つ）になる。
enum に無いキーを打つと「Expected one of: alice, bob, carol」のエラーが出る。使えるキーが画面からわからず、打ち間違えるとエラーになる。

原因：zod の `partialRecord` は、キーの schema を複製して `_zod.values` を消している（すべてのキーを必須として検証しないため）。
`enumeratedRecordKeys`（`zod-form/src/utils/schema.ts`）は `_zod.values` でキーを列挙するので、partialRecord は「列挙できない record」として扱われる。

## 2. 方針

partialRecord は「キーごとに optional な object」と同じ意味なので、見た目もそれに合わせる。デザインは 2 つ。

| uiType | 見た目 | 向いている場面 |
| --- | --- | --- |
| 既定（`uiType` なし・`box` など） | 固定キー＋optional：候補のキーを全部、キーが enum の record と同じ固定の欄で並べ、各欄は optional の見た目にする | キーが少ないとき |
| `entries` | 下でキーを追加：値にあるキーだけを固定のラベルの行で並べ、各行は削除だけできる。いちばん下の選択でキーを足す（Redmine の検索の条件の足し方に近い） | キーが多いとき |

どちらも、キーの名前を書き換える操作は無い。enum に無いキーは作れない。

キーの schema が列挙できない record（`z.record(z.string(), ...)` など）は、今の entries（キーを文字で打つ）のまま変えない。

## 3. ライブラリ

### 3.1 キーの候補を取り出す（`zod-form`）

`partialRecordKeys(schema): string[] | undefined` を足して export する。

- `schema.type === "record"` で、`_zod.values` が無く（＝ `enumeratedRecordKeys` が undefined）、キーの schema の def からキーを列挙できるときに、そのキーを返す
  - enum：`def.entries` の値
  - literal：`def.values`
  - literal（と enum）の union：腕ごとに上を集める
- 数値のキーは文字にする（`enumeratedRecordKeys` と同じ）
- それ以外（`z.string()` など）は undefined

ラベル（`zf.enum` の選択肢の label、union の腕の label）は、今の `keyLabelsOf`（`record.tsx`）をそのまま使う。複製されたキーの schema は `_zod.parent` で元をたどるので、registry の meta はそのまま読める（zod 4.4.3 で確認済み。テストでも確かめる）。

### 3.2 既定：固定キー＋optional

`record.tsx` の `RecordSwitch` で、`partialRecordKeys` があれば新しい `PartialFixedKeysRecordComponent` を使う。

- 候補のキーを、enum の定義順に、キーが enum の record と同じ見た目（`FixedKeysRecordBody`）で全部並べる
- 各欄は、値の schema を optional にしたものとして描く（`valueSchema.optional()` を `Switch` に渡す）。見た目は値の型の optional の見た目そのまま
  - 文字・数値など：空にするとキーが無い状態
  - object・intersection：`OptionalContainer`（＋で開き、削除で閉じる）
  - そのほか optional の見た目を持つ型も同じ
- 値が undefined になったキーは、値に undefined を入れずに、キーごと消す。zod の partialRecord は、値にあるキーの値を値の schema で検証するので、`{ alice: undefined }` は値が `z.string()` ならエラーになるため
  - 作り：欄が undefined を書いたことを record の部品で受け、`field.onChange` でキーを消した object を書く。欄の書き込みをどこで受けられるかは実装のときに確かめ、受けられなければ止めて相談する
- 値の schema 自体が optional・nullable のときも、undefined ならキーを消す（JSON にしたとき区別できないため）。null はそのまま入れる
- 値にあって候補に無いキーは描かない（キーが enum の record と同じ。zod のエラーとして record の欄に出る）
- 必須の印は付けない

### 3.3 `uiType: "entries"`：下でキーを追加

`record_entries.tsx` の `RecordEntriesSwitch` で、`partialRecordKeys` があれば新しい `PartialRecordEntriesComponent` を使う。

- 値にあるキーだけを行で出す。行の見た目は固定のラベル（キーの label、無ければキー）と値の欄、右に削除のボタン
  - キーの名前は書き換えられない
  - 値の欄は値の schema そのもの（optional にしない）。行があるかどうかがキーがあるかどうか
- いちばん下に、まだ値に無いキーだけを候補にした選択を出す。選ぶとそのキーの行を足し、選択は空に戻す
  - 候補は文字で絞り込める（Mantine の `Select` の `searchable`）。候補の名前はキーの label
  - すべてのキーを使い切ったら、選択を出さない
  - readOnly のときは選択も削除のボタンも出さない
- 足した行の値は、値の schema の既定値（`getDefaultValue`。object なら既定値の入った形、文字なら空）。必須の欄のエラーは、触るまで出さない（今の entries の組を足したときと同じ）
- 削除すると、キーごと値から消す
- 行の並び順は meta の `keyOrder` で決める（3.4）
- 組の分だけ描くので、lazy の数を数え直す（`ResetLazyDepth`。今の entries と同じ）

### 3.4 `keyOrder`（`uiType: "entries"` のときだけ）

`zf.record` の meta に `keyOrder?: "definition" | "value"` を足す。

| 値 | 並び | 向いているストア |
| --- | --- | --- |
| `"definition"`（既定） | enum の定義順 | Firestore・DynamoDB など、キー順を残さないストア |
| `"value"` | 値の object に入っている順。足したキーは末尾に入れる | zod-searchparams・localStorage の JSON など、キー順を残すストア。実質、足した順になる |

- `"definition"` でも、足したキーは値の object の末尾に入れる（並びは表示のときに決める）
- JS の object は、`"1"`・`"2"` のような整数に見えるキーを、入れた順に関係なく数の小さい順に並べる。キーが数字の enum で `"value"` を選んでも足した順にはならない。meta の説明（JSDoc）とドキュメントに書く
- 固定キー＋optional の見た目では使わない（全キーを出すので、常に定義順）

### 3.5 そのほか

- 既定値（`getDefaultValue`）：partialRecord は今までどおり `{}`。変えない
- changeset（minor：partialRecord の見た目が変わるため。zod-form は `partialRecordKeys` と meta の `keyOrder` を足すので minor）
- `zod-form-mantine` の README（record の節）に、partialRecord の 2 つの見た目と `keyOrder` を書く

## 4. テスト（ライブラリ）

- `zod-form`：`partialRecordKeys` が enum・literal・literal の union・数値の literal のキーを返し、`z.string()` のキー・普通の record では undefined を返す
- `zod-form-mantine`（`recordPartial.spec.tsx` を新しく作る）
  - 既定：候補のキーが label で全部並ぶ。入力するとそのキーが入り、空にするとキーごと消える（undefined を入れない）
  - 既定：値が object なら ＋ で開き、削除でキーごと消える
  - entries：値にあるキーだけが並ぶ。下の選択の候補は、まだ無いキーだけ。選ぶと行が足され、既定値が入る。削除でキーごと消える。使い切ると選択が消える
  - entries：`keyOrder` が既定なら定義順、`"value"` なら値の順
  - readOnly で、選択・削除のボタンが出ない
  - どちらも、送信の検証が通る（キーを消したあとも）

## 5. デモと E2E（`apps/form-demo`）

### 5.1 デモ（`recordEntries` のページ）

- 今の `nicknames`（あだ名）を、既定の見た目（固定キー＋optional）に変える
- キーの多い partialRecord を `uiType: "entries"` で足す。例：都道府県の enum（47 個、`zf.enum` で label 付き）をキー、件数（数値）を値にする「支店の数」。初期値は 2〜3 件
- `keyOrder: "value"` の例を足す（同じ形で `keyOrder: "value"`）。初期値のキーの順を定義順と変えて、並びの違いがわかるようにする
- ページの説明（description）に、partialRecord の 2 つの見た目と `keyOrder` を書く

### 5.2 E2E（`e2e/record-entries.spec.ts`）

今の「キーが enum の partialRecord は、組を足して編集する。enum に無いキーはエラーになる」を、次のテストに置き換える。

- 既定の partialRecord：候補のキー（アリス・ボブ・キャロル）が label で全部並ぶ。空の欄に入力するとそのキーが値に入り、空にするとキーごと消える（`window.__formDemo` の値に、そのキーが無い）
- 既定の partialRecord：キーを入れたまま送信でき、送信した値にも空にしたキーは無い
- entries の partialRecord：値にあるキーだけが並ぶ。下の選択を文字で絞り込んでキーを選ぶと、行が足され、値に既定値で入る。選択の候補に、もうあるキーは出ない
- entries の partialRecord：行を削除すると、キーごと値から消え、選択の候補に戻る
- `keyOrder`：既定は定義順、`"value"` は値の順（足したキーは末尾）で並ぶ
- `all-pages.spec.ts` は登録簿から開くので、手を入れない

## 6. 確かめること

- `pnpm check-types`・`pnpm lint`・`pnpm build`
- `pnpm --filter @zodapp/zod-form test`・`pnpm --filter @zodapp/zod-form-mantine test`
- `pnpm --filter form-demo e2e`

## 7. コミットの分け方（実装のとき）

1. `partialRecordKeys` とテスト
2. 固定キー＋optional の見た目とテスト
3. entries の見た目・`keyOrder` とテスト、changeset・README
4. デモと E2E
