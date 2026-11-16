# zf.union：選んだ腕を、値が検証に通らなくても表示し続けるプラン

- ステータス: 実装済み
- 対象ブランチ: `claude/project-thread-po6sz4`（このプランと同じブランチに実装を積む）
- 対象パッケージ: `@zodapp/zod-form-mantine`（利用側: `apps/form-demo`）

---

## 1. 背景と原因

form-demo の `zf.union` のページ（`formId=union`）で、「連絡先タイプ」に「電話」か「住所」を選ぶと、
セレクトが空欄に戻り、腕の入力欄（電話番号タイプ・電話番号、住所）が出てこない。
値だけが `{ "contact": { "type": "phone" } }` に変わる。

このページの union は discriminator を持たない `zf.union` で、
`packages/zod-form-mantine/src/components/union.tsx` の `UnionBody` は、
どの腕を表示するかを「今の値がどの腕の `safeParse` に通るか」（`determinator`）だけで決めている。

1. 腕を選ぶと、`handleSelect` が `normalizeValue` で、その腕のデフォルト値 `{ type: "phone" }` を値に入れる
2. その値は電話の腕の schema に通らない（`phoneType`・`phone` が必須、`phone` は `min(10)`）
3. `determinator` がどの腕も返さず、`selectedProfile` が `undefined` になり、セレクトの値も腕の入力欄も描画されない

メールの腕が初期表示で動くのは、初期値 `user@example.com` が検証に通るから。
メールの腕に戻すときも、値が `contact` ごと消え（`undefined`）、どの腕にも通らないので、同じく空欄になる。

discriminatedUnion の側は、選んだ discriminator を `selectedDiscriminator`（state）に持つので、この問題はない。

リポジトリの最初のスナップショット（cc96bb8）でも同じ操作で壊れており、PR #24 による退行ではない。
`union.spec.tsx` のテストは discriminatedUnion のものだけで、discriminator のない union のテストはない。

## 2. 決めた仕様

1. **選んだ腕を覚えておく。** 利用者がセレクトで腕を選んだら、値がまだ検証に通らなくても、その腕のセレクト表示と入力欄を出し続ける。
2. **値が外から変わったときは、値から腕を決め直す。** 次の規則で、覚えている腕と値を突き合わせる。
   - 覚えている腕に値が通る → そのまま（ほかの腕にも通っても切り替えない。例: z.lazy のページで、文字列の腕を選んで `""` のとき）
   - 覚えている腕には通らず、ほかの腕に通る → 通った最初の腕に切り替える（フォームのリセット、計算値の書き込みなど）
   - どの腕にも通らない → 覚えている腕のまま（入力の途中）
3. **初期値がどの腕にも通らないときは、literal の欄で腕を推定する。**
   object の腕で、literal の欄（例: `type: z.literal("phone")`）の値が一致する腕が 1 つだけなら、その腕を表示する。
   途中まで入力して保存したデータを開き直したとき、腕が空欄にならないようにするため。
   一致する腕がない、または複数あるときは、今と同じく未選択（空欄）。
4. **腕の切り替えでは検証しない。** discriminatedUnion の側と同じく、値は検証せずに書き（`runAsUserEdit` で利用者の編集として記録する）、
   残っているエラー表示を消す。切り替えた直後に、まだ触っていない欄が赤くならないようにするため。
   切り替えたときに作る値は今と同じ（その腕に通るなら今の値、通らなければその腕のデフォルト値）。

`required === false` の union で、選択中の腕をもう一度選んで外す動き（discriminatedUnion の側にはある）は、このプランでは扱わない。

## 3. 設計

変更は `packages/zod-form-mantine/src/components/union.tsx` の `UnionBody` の、discriminator のない分岐だけ。discriminatedUnion の分岐は変えない。

### 3.1 選んだ腕の state

- `selectedIndex: string | undefined`（profile の `value`、つまり腕の index の文字列）を `useState` で持つ。
  初期値は「値に通る最初の腕」→ なければ「literal の欄で一意に推定できる腕」→ なければ `undefined`。
- `formValue` が変わったら、2.2 の規則で `selectedIndex` を決め直す（`useEffect`、または描画中の state 調整）。
- `selectedProfile` は、discriminator のない分岐では `compiledOptions.selector(selectedIndex)` を使う。

### 3.2 literal の欄による推定

`compiledOptions` を作るときに、object の腕ごとに literal の欄（`ZodLiteral` で値が 1 つのもの）の `{ key: value }` を集めておき、
値が record で、ある腕の literal の欄がすべて一致し、そういう腕が 1 つだけのときにその腕を返す関数を足す。
literal の欄を持たない腕（文字列の腕など）は推定の候補にしない。

### 3.3 `handleSelect`

discriminator のない分岐で、`field.onChange(normalized)` の代わりに

1. `setSelectedIndex(profile.value)`
2. discriminatedUnion の分岐と同じ `setValueWithoutValidation(normalized)`（`runAsUserEdit` で書き、エラー表示を消す）

にする。

### 3.4 エラーの振り分け

`optionIssues` は `selectedProfile.index` で `invalid_union` のエラーから腕のエラーを取り出しているので、
`selectedProfile` が決まるようになれば、選んだ腕の欄に送信時のエラーが出る。コードの変更はない（テストで確かめる）。

## 4. テスト

### 4.1 単体テスト（`packages/zod-form-mantine/src/components/union.spec.tsx`）

form-demo の union と同じ形の schema（文字列の腕 + literal `type` を持つ object の腕 2 つ）で、discriminator のない union のテストを足す。

- object の腕を選ぶと、セレクトがその腕のラベルになり、腕の欄が出る
- 腕の欄に途中まで入力しても（検証に通らなくても）、腕の表示が保たれる
- 文字列の腕に戻すと、セレクトが戻り、文字列の欄が出る
- 送信すると、選んだ腕の欄にエラーが出る
- フォームの値を外から別の腕に通る値にすると、表示がその腕に切り替わる
- 初期値が `{ type: "phone" }`（どの腕にも通らない）でも、電話の腕を表示する
- 初期値がどの腕にも通らず、literal でも決まらないときは未選択

### 4.2 form-demo の E2E（`apps/form-demo/e2e/union.spec.ts`、新規）

`formId=union` のページで、電話を選ぶ → 電話番号タイプ・電話番号の欄が出る → 入力するとプレビューの値に入る、
住所に切り替える → 住所の欄が出る、メールに戻す、を確かめる。
あわせて `recursiveSchema`（z.lazy）のページで、腕の切り替えが今どおり動くことを 1 本確かめる
（spec は 1 つのデモページに 1 つ、という form-demo の決まりに合わせ、`apps/form-demo/e2e/recursive-schema.spec.ts` に分ける）。

## 5. ドキュメント

- `CHANGELOG.md` / `CHANGELOG.ja.md` に、zod-form-mantine の修正として書く。

## 6. 実装の順序（コミットの粒度）

1. 単体テストを足す（この時点では落ちる）
2. `union.tsx` の修正（3.1〜3.3）
3. form-demo の E2E を足す
4. CHANGELOG とこのプランのステータス更新

各段階で `pnpm check-types`・`pnpm build` と、対象パッケージのテストを通す。

## 7. テストケースの追加

4 章のテストは、文字列の腕と object の腕の組み合わせだけを確かめている。
文字列・数値などのプリミティブの腕、どちらの腕にも通る値、optional・配列の中・読み取り専用などを足す。

置き場所：zf.union のページ（`union`）は連絡先の欄 1 つで説明しているので、そのまま残す（e2e の `union.spec.ts` も変えない）。
ケースを足すと欄が多くなり読みにくくなるので、同じ Advanced の分類に、新しいデモページ
「zf.union（いろいろな腕）」（formId `unionArms`、`apps/form-demo/src/pages/form/schemas/unionArms.tsx`、e2e は `apps/form-demo/e2e/union-arms.spec.ts`）を足す。

| # | ケース | デモページの欄 | e2e | 単体テスト |
| --- | --- | --- | --- | --- |
| 1 | `string \| number \| { text: string }`：文字列 → 数値 → オブジェクト → 文字列 → 数値と切り替え、その腕の欄が出る。値は腕の型で書く（数値は number） | 値（`value`） | ○ | ○ |
| 2 | `string \| number` に数字だけの文字列：初期値 `"42"` は文字列の腕。打ち込んでも文字列のまま。数値の腕に切り替えて打つと number | 番号（`code`） | ○ | ○ |
| 3 | どちらの腕にも通る値（`enum(S/M/L) \| string`）：初期値 `"M"` は先の腕（選ぶ）。「自由に書く」を選んで `M` と打っても、選んだ腕のまま | サイズ（`size`） | ○ | ○ |
| 4 | boolean・literal・enum の腕：切り替えと、書かれる値（`true`／`"unknown"`） | 回答（`answer`）・サイズ（`size`） | ○ | ○ |
| 5 | optional・nullable の union：× で腕を外して空に戻せる。空でも送信でき、必須のエラーは出ない。必須の union は、開いただけではエラーを出さず、送信でエラーを出す | メモ（`memo`）・備考（`note`）・必須（`required`） | ○ | ○ |
| 6 | 配列の中の union：要素を足し、要素ごとに違う腕を選ぶ。要素を消しても、残った要素の腕が保たれる | 項目（`items`） | ○ | |
| 7 | 読み取り専用：腕ごとに、腕の名前と値の表示 | 読み取り専用の欄（`readOnlyView`） | ○ | |
| 8 | 送信のエラーが、選んだ腕の欄に出る（文字列・数値・オブジェクト） | 値（`value`） | ○ | ○ |
| 9 | 値を外から書き換える（見るための部品の書き込みのボタン）と、腕の選択が値に追う | 値（`value`） | ○ | ○ |
| 10 | 初期値がどの腕にも通らない：literal の欄で腕を推定する。推定できないときは腕を空欄で開き、値は書き換えない | 下書き（`draft`）・どの腕にも当てはまらない保存値（`unknownSaved`） | ○ | （4 章のテストにある） |

見つかった不具合は、このプランの範囲ではライブラリを直さず、再現手順と直し方の候補を書いて別に扱う。
