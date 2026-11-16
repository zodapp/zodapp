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
| 5 | optional・nullable の union：× で腕を外して空に戻せる。空でも送信でき、必須のエラーは出ない。必須の union は、開いただけではエラーを出さず、送信でエラーを出す | メモ（`memo`）・備考（`note`）・必須（`required`） | ○（8 章で直したあと、× で空に戻す・nullable は null のまま・必須の union の「選択してください」を足した） | ○ |
| 6 | 配列の中の union：要素を足し、要素ごとに違う腕を選ぶ。要素を消しても、残った要素の腕が保たれる | 項目（`items`） | ○ | |
| 7 | 読み取り専用：腕ごとに、腕の名前と値の表示 | 読み取り専用の欄（`readOnlyView`） | ○ | |
| 8 | 送信のエラーが、選んだ腕の欄に出る（文字列・数値・オブジェクト） | 値（`value`） | ○（8 章で直したあと、空の数値の腕のケースを足した） | ○ |
| 9 | 値を外から書き換える（見るための部品の書き込みのボタン）と、腕の選択が値に追う | 値（`value`） | ○ | ○ |
| 10 | 初期値がどの腕にも通らない：literal の欄で腕を推定する。推定できないときは腕を空欄で開き、値は書き換えない | 下書き（`draft`）・どの腕にも当てはまらない保存値（`unknownSaved`） | ○ | （4 章のテストにある） |

見つかった不具合は、このプランの範囲ではライブラリを直さず、再現手順と直し方の候補を書いて別に扱う。
このリポジトリには、落ちるテストを `it.fails`／`test.fail` で残す決まりがないので、不具合を再現するテストは入れていない。

### 7.1 見つかった不具合

1〜5 は 8 章で直した。

1. **AutoForm では、どの腕にも型が合わない値のエラーが出ない。** `FormRuntime.validate`（`zod-form-react/src/common/schemaRegistry.ts`）が issue を `{ message, path, code }` に詰め直すので、`invalid_union` の `errors` が落ち、`UnionBody` が選んだ腕のエラーを取り出せない。`invalid_union` の文言は日本語の errorMap では空なので、何も出ないまま送信が止まる。例：unionArms で値の種類を「数値」にし、空のまま送信する。zf.union のページで電話を選び、電話番号に 090 と入れて送信する
2. **optional の union で × を押しても値が消えない。** `handleSelect(null)` が discriminator のない union では何もしない。セレクトは空に見えるが、値と腕の欄は残る（メモの種類を「数」にし 5 と入れて × を押す）
3. **nullable の union で、腕を選ぶと値が null でなく undefined になり、null に戻せない。** 腕の既定の値が undefined のため。nullable の union が undefined になると検証に通らず、送信が止まる（エラーの文言は空で見えない）
4. **必須の union を未選択のまま送信しても、エラーが見えない。** セレクトは `error={undefined}` で、選んだ腕もないのでエラーを振り分けられない
5. **AutoForm を使わず useZodForm に zod の schema を直接渡すと、プリミティブの腕が空のまま送信すると無限に描き直して落ちる**（Maximum update depth exceeded）。腕のエラーの path が `[]` なので、振り分け先が union 自身の欄（`value`）になり、union の error が変わる → 振り分けをやめて消す → 元に戻る、を繰り返す

## 8. 不具合の直し方（7.1 の 1〜5 と、あとで見つかった 2 件）

- ステータス: 実装済み（8.13 の判断事項 J・K も実装済み）
- 対象ブランチ: `claude/union-arm-errors-v2`（main から作る。このプランと同じブランチに実装を積む）
- 対象パッケージ: `@zodapp/zod-form-react`・`@zodapp/zod-form-mantine`・`@zodapp/zod-form-mantine-lite`（利用側: `apps/form-demo`）
- 判断の経緯: Claude Docs「zf.union の不具合の直し方の判断事項」（A〜I）。実験の実装はブランチ `claude/union-arm-errors`（context で腕のエラーを渡す案）と `claude/union-arm-errors-e`（この章の案）にあり、使えるテストだけを参考にする

### 8.1 決めたこと

| # | 決めたこと |
| --- | --- |
| A | 腕のエラーは、同じ欄に `invalid_union` を残したまま `errorMap.onDynamic` に足す。誰が書いたかの目印は、union の中だけの context で、すぐ外の union の path と ref を渡して見分ける（リレー） |
| B | 腕が未選択で検証に落ちているときは、union のセレクトに「選択してください」と出す。値が空でも、値がどの腕にも合わず推定できなくても同じ。`invalid_union` を通して出す |
| C | `ZodFormProps` に `nullable?: boolean` を足し、`NullableComponent` が渡す |
| D | nullable の union で、腕を選んだ直後や × の後の空の値は null |
| E | discriminatedUnion も、必須で未選択ならセレクトに B と同じ文言を出す |
| F | `FormRuntime.validate` は zod の issue をまるごと残し、一番外の issue の path にだけ前置きを付ける。`invalid_union.errors` の中の path は書き換えない |
| G | 腕を切り替えた直後に、最初の送信が何もしない件を直す |
| H | object の腕の中の union に `invalid_union` が届かない件を直す |
| I | `ZodFormProps` の `required` を `optional` に裏返す。先に置き換えをコミットし、その上に `nullable` を足す。空にするときの値は `optional ? undefined : nullable ? null : undefined` |

### 8.2 `required` を `optional` に裏返す（I）

- `ZodFormProps`（`zod-form-react/src/utils/type.ts`）の `required?: boolean` を `optional?: boolean` にする。書かないときは必須
- 部品の `required !== false` を `!optional` に、`required={false}` を `optional={true}` に置き換える（zod-form-mantine-lite・zod-form-mantine・zod-form-widget など、ライブラリの中で約 55 か所）
- `OptionalComponent`・`NullableComponent`・`DefaultComponent`（mantine-lite の `baseComponents`）は `optional={true}` を渡す。C のあとは `NullableComponent` だけ `nullable={true}` に変える（8.3）
- `required` を受け取る hook（`useDynamicSchema(meta, fieldPath, { required })` など）も `optional` にそろえる
- Mantine の部品に渡す `required`（ラベルの＊を出す Mantine の props）はそのまま。値は `!(optional || nullable)`
- 利用者が作った部品には壊れる変更なので、CHANGELOG と changeset に「破壊的変更」と書く
- この段階では挙動を変えない（置き換えだけ）。既存のテストがそのまま通ることを確かめる

### 8.3 `nullable` を足す（C・D）

- `ZodFormProps` に `nullable?: boolean` を足す
- `NullableComponent` は `nullable={true}` を渡す（`optional` は渡さない）。`.optional().nullable()` のように重なると、両方が届く
- 空にするときの値を決める小さな関数を zod-form-react に置く（例：`emptyValueOf({ optional, nullable })` → `optional ? undefined : nullable ? null : undefined`）。公開するかは実装時に決めず、まず内部で使う
- union は、腕を選んだ直後（腕の既定の値が undefined のとき）と × のときに、この関数の値を書く
- string・number などの部品で、消したときに null を書くようにするかは、この章では扱わない（今は undefined を書く）

### 8.4 `FormRuntime.validate` で issue をまるごと残す（F）

- `zod-form-react/src/common/schemaRegistry.ts` の `collect` で、issue を `{ message, path, code }` に作り直すのをやめ、`{ ...issue, path: [前置き, ...issue.path] }` にする
- `invalid_union.errors` の中は書き換えない。中の path はその union の値からの相対なので、union が自分の欄から絶対の path に直す
- dynamic の「読み込み中」「取得できませんでした」の issue は今のまま

### 8.5 腕のエラーを同じ欄に足す（A）

`packages/zod-form-mantine/src/components/union.tsx`

1. union は、欄のエラーの配列全体を見る（`useStore(field.api.store, s => s.meta.errors)`）。最初の 1 つだけを見るのをやめる
2. 部品ごとの ref（`useState(() => ({}))`）を持つ
3. 中だけで使う context（export しない）に、すぐ外の union の `{ path, token }` を 1 組だけ載せる。union は受け取った組を読み、自分の `{ path, token }` に置き換えて子に渡す
4. 入力の `invalid_union` の選び方
   - 受け取った path が自分の path と同じ（同じ欄に外の union がいる）：その token が付いた（`writtenBy`）ものだけを取る
   - それ以外：目印の無い最初のものを取る
5. 選んだ腕の issue のうち path が `[]` のもの（primitive の腕・腕が union のとき）は、`writtenBy: 自分の token` を付けて、同じ欄の `errorMap.onDynamic` に足す。書くときは今の meta を読み、自分の分だけを入れ替える（ほかの union の分は残す）。同じ内容なら書かない
6. path が `[]` でない issue（object の腕の子の欄）は、今の `redistributeIssues` と同じく子の欄に配る。ただし `errors` ごと置き換えるのをやめ、`errorMap.onDynamic` に書く。H のため、issue はまるごと（`code`・`errors` を落とさずに）渡す
7. 片付け：腕が変わったとき、`invalid_union` が消えたとき、外れたときに、自分の token が付いたものだけを消す
8. 書き込みは `form` と欄の名前を通す（`field.api` は errorMap が変わるたびに作り直されるので、effect の依存に入れるとループする）

zod-form-react

- `wrapComponent`（`src/common/wrapper.tsx`）は、読み込み中の issue と `invalid_union` を飛ばした最初のエラーを見せる
- 配列の欄（`getArrayFieldError`）も同じく `invalid_union` を飛ばす
- `invalid_union` かを見分ける関数は内部に置き、export しない

`onDynamic` を使う理由：onChange・onBlur・onSubmit は AutoForm の検証が上書きし、`wrapComponent` が値の変更で onBlur を消す。onMount は値を書くたびに TanStack が消す。onDynamic は今の設定（`defaultValidationLogic`）では TanStack が読みも書きもしない。`revalidateLogic` や欄ごとの validators を使うとぶつかる恐れがあるので、README に書く。

### 8.6 腕が未選択のときの表示（B・E）

- union は、自分の `invalid_union` があり、かつ腕が未選択なら、セレクトに「選択してください」を出す。出す時機はほかの欄と同じ（触ったか送信したか）
- discriminator のない union と discriminatedUnion の両方に効かせる
- 文言は union の部品が持つ（`jaErrorMap` は変えない）

### 8.7 × と nullable（不具合 2・3）

- `handleSelect(null)`：`optional` か `nullable` のとき、覚えた腕を消し、8.3 の空の値を書く
- nullable の union で腕を選んだとき、腕の既定の値が undefined なら null を書く（8.3）

### 8.8 最初の送信が何もしない件（G）

- 腕を切り替えると `handleSelect` が欄の onChange・onBlur のエラーを消すため、form 全体の onBlur のエラーだけが残り、`canSubmit` が false になって、TanStack が検証せずに送信をやめる
- 実装の最初に、この流れを単体テストで再現してから直し方を決める。候補は、切り替えのあとに form の検証を走らせ直す（`form.validate("change")`）か、form 全体のエラーも合わせて消す。どちらにするかは、再現したテストで挙動を確かめて選び、プランに追記する
- 再現して分かったこと：残っていたのは form 全体の `errorMap.onBlur`（腕を選ぶ欄を離れたときの検証の結果）。standard schema の検証では、form 全体のエラーにも欄ごとのエラーがそのまま入るため、`isFormValid` が false になり `canSubmit` も false になる。TanStack は初めの送信（`submissionAttempts` が 1）で `canSubmit` が false なら、検証せずに返す
- 選んだ直し方：form 全体のエラーも合わせて消す（`form.setErrorMap({ onChange: undefined, onBlur: undefined })`）。`form.validate("change")` では、新しい値の `invalid_union` が form 全体の onChange に入るので `canSubmit` は false のまま、しかも切り替えた直後に欄のエラーが出てしまう
- 消すのは form 全体の分なので、ほかの欄の form 全体のエラーも次の検証まで消える（欄ごとの errorMap は残る）。8.13 の 3 で確認する

### 8.9 テスト

単体テスト（`union.spec.tsx` ほか）。schema を `useZodForm` に直接渡す場合と、`FormRuntime` を通す場合（AutoForm と同じ）の両方で走らせる。

- `FormRuntime.validate` が `invalid_union.errors` を残し、一番外の path にだけ前置きを付ける（`schemaRegistry.spec.ts`）
- 空の数値の腕で送信すると、数値の欄にエラーが出て枠が赤くなる。ループしない（落ち着いたあと store が更新されない）。直すとエラーが消える
- 触る前・送信前は腕のエラーが出ない
- 同じ欄に union を 2 段・3 段重ねて、内側の腕のエラーが正しい欄に 1 つだけ出る。外の腕のエラーが一度も書かれない
- discriminatedUnion の子の欄にある union が、目印の無い issue を取ってエラーを出す
- object の腕の子の欄にある union にエラーが届く（H）
- dynamic の読み込み中の issue と並んでも、union が `invalid_union` を見落とさない
- optional の union で × を押すと空になり送信できる。nullable の union は腕を選んでも × でも null。両方のときは undefined
- 必須の union（discriminator なし・discriminatedUnion）を未選択で送信すると、セレクトに「選択してください」
- 腕を 2 回切り替えた直後の最初の送信で、検証が走る（G）
- `required` → `optional` の置き換えのあとも既存のテストが通る

form-demo の e2e（`union-arms.spec.ts`）。7 章で入れていなかったケースを足す。

- × でメモを空に戻す。備考（nullable）は null のまま、× で null に戻る
- 必須の union を未選択で送信すると「選択してください」
- 数値の腕を空で送信すると「必ず入力してください。」
- どの腕にも合わない保存値の欄に「選択してください」
- 7 章の表の 5・8 の △ を ○ にする

### 8.10 ドキュメント

- CHANGELOG（日英）と changeset：`required` → `optional` は破壊的変更として書く。`nullable` の追加、union の不具合の修正、`wrapComponent` が `invalid_union` を見せなくなったこと
- zod-form-react の README：`ZodFormProps` の `optional`・`nullable`、union の腕のエラーが `errorMap.onDynamic` に入ること
- このプランの 7.1 と 7 章の表を、直したものに合わせて更新する

### 8.11 実装の順序（コミットの粒度）

1. `required` → `optional` の置き換え（8.2）。挙動は変えない
2. `nullable` を足す（8.3）
3. `FormRuntime.validate` で issue をまるごと残す（8.4）。単体テストを先に足す
4. 腕のエラーを同じ欄に足す（8.5）。不具合 1・5 と H のテストを先に足す
5. 腕が未選択のときの表示（8.6）
6. × と nullable（8.7）
7. 最初の送信が何もしない件（8.8）。再現テストを先に足し、直し方をプランに追記してから直す
8. form-demo の e2e を足す（8.9）
9. CHANGELOG・changeset・README・このプランの更新（8.10）

各段階で `pnpm check-types` と対象パッケージの単体テストを通す。最後に `pnpm --filter form-demo build` と form-demo の e2e を通す。

### 8.12 この章で扱わないこと

- string・number などの部品で、消したときに null を書くこと
- `onDynamic` 以外の置き場所への移しかえ（TanStack に専用の仕組みができたら見直す）

### 8.13 実装で分かったこと（判断事項 J〜L）

判断事項の Doc で決めた。J・K は直し、L は今のまま。

1. **J：E（discriminatedUnion の未選択）は、`invalid_union` を通しては出せなかった。** zod の discriminatedUnion は、値が undefined・null のとき `invalid_type`（expected object）を union の欄に出し、discriminator が無い・どれにも合わないときは `invalid_union` を discriminator の欄（`[...path, discriminator]`）に出す（`errors` は空）。
   決定：腕が未選択で、union の欄に読み込み中以外のエラーがあれば、code を問わず「選択してください」を出す。discriminator の欄の `invalid_union` は拾わない（画面で腕を外したときの値は undefined・null なので、ふつうの未選択はこれで拾える）
2. **K：object の腕の子の欄を、欄を離れずに直しても、エラーが消えなかった（main からある）。** 子の欄の型のエラー（空の数値・未選択の選択肢・欠けた項目）は、zod が union の欄の `invalid_union` に入れる。子の欄を空にして離れると、その検証の結果が union の欄の onBlur に入り、次に欄を離れるまで残る。union はそれを子の欄に振り分け続けていた（`wrapComponent` が値の変更で消すのは、自分の欄の onBlur だけ）。discriminatedUnion と union でない object は、zod が子の欄に直接エラーを出すので起きない。
   決定：union の欄の値が変わったら（子の欄の入力でも変わる）、union が自分の欄の onBlur のエラーを消す
3. **L：G の直し方は、フォーム全体のエラーを消す。** 8.8 のとおり、ほかの欄のフォーム全体のエラーも次の検証まで消える。表示は欄ごとのエラーから、送信の可否も欄ごとのエラーで決まるので影響しない。決定：今のまま
4. **プランからずらしたところ**
   - `invalid_union` かを見分ける関数は zod-form-react の中に置き（export しない）、zf.union は同じ判定を自分で持つ。パッケージをまたいで使うには export が要るため
   - 空の値を決める関数（8.3）は zod-form-react ではなく、使うところ（zf.union）に置いた。今は union だけが使うため
   - discriminatedUnion の × と、選んだ腕をもう一度選んだときも、8.3 の空の値を書く（今までは undefined）
5. **あわせて直したこと**：invalid_union でない欄のエラーを子の欄に振り分けるとき、フォームの値からの path をそのまま union の値からの path として使っていたため、入れ子の union では `value.value` のような無い欄に書いていた（main からある）。union の欄の path を外してから振り分け、union の欄より下を指さないものは振り分けない
6. **別の課題**：単体テストでは、union に関係ないふつうの欄でも「空にして離れる → 離れずに直す → 送信」で、1 回目の送信が検証されずに止まった（フォーム全体の onBlur が残り、`canSubmit` が false のまま）。ブラウザでは送信ボタンを押すと先に欄を離れるので起きない。Enter で送信するときに起きるかは確かめていない
