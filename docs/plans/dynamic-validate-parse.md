# dynamic の検証と送信を 1 つの評価にそろえるプラン

- ステータス: 実装済み
- 対象ブランチ: `claude/project-thread-cn05w5`
- 前提の main: 668ae13（PR #38 までマージ済み）
- 対象パッケージ: `@zodapp/zod-form`、`@zodapp/zod-form-react`、`@zodapp/zod-form-mantine`（テスト）、`@zodapp/zod-form-widget`、`apps/survey`

---

## 1. 背景

PR #32 の #8 で、`zf.dynamic()` の土台を `z.unknown()` にした。静的な schema のまま parse でき、親の `.refine()` も走るようになった。
そのぶん、`FormRuntime` の `validate`（エラーの表示と送信の可否）と `parse`（送信する値）が違う値を見ていることが表に出た。

- `validate`：静的な schema を **生のフォームの値** で検証し、登録された schema（dynamic が resolve したもの）は、それぞれ生の値の自分の path で検証する
- `parse`：登録された schema を深い順に parse し、**output を差し込んでから** 静的な schema で parse する（`docs/archive/zod-form-unsupported-schemas.md`）

main で確かめた症状は次のとおり。どれもスクラッチで `FormRuntime` を直接呼んで再現し、668ae13 でも再現することを確かめた（#4 を除く）。

| #   | 症状                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | dynamic が `z.string().transform(Number)` を返し、親の `.refine()` が変換後の値を前提にしていると、正しい値でも送信できない。`{ a: "3", b: 5 }` で、`validate` はルートに refine のエラーを出し、`parse` は `{ a: 3, b: 5 }` で通る                           |
| 2   | 親の `.refine(..., { path: ["a"] })` のように dynamic の欄を指す issue を、`validate` は捨てる（登録のある path の下の静的な issue を捨てる作りのため）。`parse` はその issue で落ちるので、**エラーが出ないまま送信できない**                                |
| 3   | dynamic の中の dynamic では、外側の schema の refine が内側の変換前の値を受け取る（#1 と同じ）                                                                                                                                                                |
| 4   | （扱わない。§1.1）同じ path で dynamic が入れ子になると、`FormRuntime` は一番深い登録しか見ない。ただし画面では、内側の dynamic が `rewrapWithOuter` で外側の包みと検査を足して登録するので、外側の refine は効く。`FormRuntime` に手で登録したときだけ起きる |
| 5   | dynamic が不正・読み込み中・取得失敗のときも、親の refine が生の値で走り、紛らわしいエラーが出る                                                                                                                                                              |

あわせて、2 つがずれていることへの備えが、使う側にもある。

- AutoForm（`zod-form-widget/src/form/AutoForm.tsx`）：「検証は通ったが parse で落ちた」ときの `parseIssuesRef` と、「フォームは invalid だが runtime では通る」ときに validate と parse をやり直す分岐
- 送信が止まった理由（`submitBlocked.ts`）：validate の issue か parse の issue のどちらかを受け取る
- survey の `SurveyBuilder`：送信で `editorSchema.safeParse` を直接呼び、runtime を通していない（dynamic の output も、文言のキーも通らない）

### 1.1 このプランで扱わないもの

- AutoSearch の `onChange` に parse していない値が渡る件（型は `z.output`）。parse できたときだけ呼ぶと、入力途中の検索条件で呼ばれなくなるので、別に決める
- dynamic の土台を resolve した schema で置き換えた「実際の schema」を組み立て、zod に 1 回で parse させる形。配列の要素ごとに resolve の結果が変わり、zod の検査からは自分の path が分からないため、組み立てられない
- 既定値の補い（`applyDefaultFills`・`fillValue`）。path ごとに schema を持つが、役割が違う
- 同じ path の入れ子の dynamic（#4）を、深い登録から順に差し込んで評価すること。画面では `rewrapWithOuter` で外側の検査がすでに内側の登録に入っているので、外側の検査・包みが 2 回かかり、同じエラーをまとめる処理が要る。利点（外側の dynamic が `zf.dynamic().transform(...)` を返したときに変換がかかる）は、困った例の無い形なので取らない
- 評価の結果の使い回し（キャッシュ）。速くなるだけで、同じかどうかの判定を誤ると古いエラーが残る不具合になる。遅くて困っている報告も無い
- AutoForm の「フォームは invalid だが runtime では通る」分岐を消せるかの調査（§3.1）

---

## 2. 方針

`FormRuntime` に、値を 1 回評価して issue と output を返す `evaluate(staticSchema, value)` を置く。
`validate` は `evaluate` の issue を、`parse` は `evaluate` の結果（issue が無ければ output）を返すだけにする。
2 つは同じ評価の結果を読むので、「エラーが出ないのに送信できない」「エラーが出ているのに送信できる」は起きなくなる。

検査はすべて zod の `safeParse` に任せる。自前で持つのは、parse する順番と差し込みだけ。

### 2.1 評価の手順

1. 登録のある path を、**深い順** に並べる。同じ path に登録が複数あれば、今どおり一番深い登録（depth が最大のもの）だけを使う（§1.1）
2. それぞれ、今の値（前の手順で差し込んだ後の値）のその path を、登録の schema で `safeParse` する
   - 成功：output をその path に差し込む（`fillAt`。値はコピーで、フォームの値は変えない）
   - 失敗：issue を集め（path に登録の path を前置きする）、その path に **目印** を差し込む
   - 読み込み中・取得失敗：今と同じ印の issue（`PENDING_ISSUE_CODE`・`RESOLVE_ERROR_ISSUE_CODE`）を集め、目印を差し込む
3. 差し込んだ値を、静的な schema で `safeParse` する
4. 2 と 3 の issue から、**目印の issue だけ** を捨てる（§2.3）。残った issue を返す。issue が無ければ 3 の output が送信する値になる

外側の path の登録（#3）は、内側の output（または目印）が差し込まれた値を受け取る。外側の schema の中の内側の dynamic は土台が `z.unknown()` なので、output は素通りし、目印は §2.2 の検査で落ちる。
最初に失敗した所で止めずに、全部の登録を評価する（エラーをすべて出すため）。
2・3 の `safeParse` は、今の `validate`・`parse` と同じく `safeParseSync`（PR #33・#34 で入った。非同期の検証で zod が投げる例外を握り、`ASYNC_VALIDATION_ISSUE_CODE` の issue にする）を通す。

issue の並びは今の `validate` に合わせ、静的な schema の issue を先に、登録の issue を後に並べる。
`moveInvalidKeyIssue`（record のキーの issue を record の欄に移す）は、両方の issue に今どおりかける。

### 2.2 目印と、dynamic の土台

zod-form に、目印の値（`Symbol`）と、目印の issue を見分ける関数を置く。
dynamic の土台を `z.unknown()` から、**目印だけを弾く `abort: true` の検査を足した `z.unknown()`** にする。

```ts
// zod-form（イメージ）
export const DYNAMIC_UNRESOLVED: unique symbol = Symbol("zodform.dynamicUnresolved");
const dynamicBase = () =>
  z.unknown().refine((value) => value !== DYNAMIC_UNRESOLVED, {
    abort: true,
    params: { zodform: "dynamicUnresolved" },
  });
const dynamic = extendCustom(dynamicBase, "dynamic", …);
```

- `abort: true` の issue があると、zod は親の `.refine()` を走らせない（zod 4.4.3 で確かめた）。zod で子の型が合わないときに親の refine が走らないのと同じ動きになる（#5）
- 目印は `FormRuntime` が評価の中でだけ作るコピーに入れる。フォームの値・サーバー・CSV には出ない。サーバーで同じ schema を parse しても、検査は必ず通る
- 型は今と同じ `z.ZodUnknown`（`refine` は型を変えない）。部品は今どおり `typeName: "dynamic"` で探される
- zod では、子の失敗が `min()` のような続けられる種類なら、親の refine は走る。このプランでは、dynamic が失敗したら（種類によらず）必ず親の refine を飛ばす。親は変換後の値を前提にしているため

### 2.3 目印の issue を捨てる

- 一番外の issue：`params.zodform === "dynamicUnresolved"` のものを捨てる
- `invalid_union` の `errors`（腕ごとの issue）の中も、再帰的に捨てる。union の腕の中で dynamic が失敗すると、zod はその腕を諦めて別の腕を試す。その結果、別の腕で通るか、`invalid_union` の腕の issue に目印の issue が入る。後者を残すと、union の部品がそれを腕の欄のエラーとして出してしまう
  - 別の腕で通ってしまう場合も、送信は dynamic 自身の issue で止まるので、値は壊れない
- 今の `isCovered`（登録のある path の下の静的な issue を捨てる仕組み）は消す。土台が何でも通す今は、そこに出る静的な issue は「親の refine が `path` で dynamic の欄を指したもの」か目印だけなので、目印だけを捨てればよい（#2 が直る）

### 2.4 API

- `FormRuntime.evaluate(staticSchema, value): { issues: Issue[]; data?: unknown }` を足して export する（`data` は issue が無いときだけ）
- `validate`・`parse`・`wrapValidator` の形は変えない。中身は `evaluate` を読むだけにする
- `parse` の失敗の issue は、今は「最初に落ちた所の issue」だったが、全部の issue になる。`submitBlockedReasons` は全部を数えるので、理由が増えることはあっても欠けることはない

---

## 3. 使う側を畳む

### 3.1 AutoForm

- `onSubmit` で `runtime.parse` が落ちる場合（`parseIssuesRef`）は、validate と同じ評価なので起きなくなる。`parseIssuesRef` を消す
- 「フォームは invalid だが runtime では通る」分岐は残し、中を `runtime.evaluate` 1 回で済ませる（今は validate と parse の 2 回）。ずれへの備えというより、TanStack Form に古い欄のエラーが残る場合（union の腕を切り替えて消えた欄など）への備えと見ている。消せるかの調査はしない（§1.1）

### 3.2 送信が止まった理由

`submitBlockedReasons` には `evaluate` の issue を渡す。validate と parse のどちらの issue かを選ぶ分岐を消す。読み込み中・取得失敗・非同期の検証・入力の誤りを数える `submitBlockedReasons` 自体は変えない。

### 3.3 survey の SurveyBuilder

送信で `editorSchema.safeParse(form.state.values)` を直接呼んでいる所を、`runtime.parse(editorSchema, form.state.values)` にする。

---

## 4. ドキュメント

- `schemaRegistry.ts` の `validate`・`parse` のコメントを書き直す（「検証は parse 前の値で行う」をやめる）
- `packages/zod-form-react/docs/dynamic.ja.md` の「エラーの表示は、今のところ parse 前の値で行います」を、このプランの動きに書き直す（英語版があれば合わせる）
- 変更の記録：ルートの CHANGELOG はやめ、各パッケージの CHANGELOG.md を changesets で作る。最初の公開（0.1.0）までは changeset を足さないので、下の内容は書かない（公開のあとなら、英語の changeset にする）
  - zod-form-react：**振る舞いの変更**：dynamic のある フォームの検証も、送信と同じく dynamic の output を差し込んでから行う。親の `.refine()` は変換後の値を受け取り、`path` で dynamic の欄を指す refine のエラーも出る。dynamic が不正・読み込み中・取得失敗のときは、親の refine を走らせない。`FormRuntime.evaluate` を足した
  - zod-form：`zf.dynamic()` の土台に、評価の目印だけを弾く検査を足した（型は `unknown` のまま）
- zod-form-react の README に dynamic の検証の説明があれば、合わせて直す

---

## 5. テスト

### 5.1 zod-form-react（`schemaRegistry.spec.ts`）

`FormRuntime` を直接呼び、`validate` と `parse` の両方で確かめる。どのケースでも「`validate` が issue を返さない ⇔ `parse` が成功する」ことも確かめる。

- #1：dynamic が `z.string().transform(Number)`、親の refine が数値を前提にする → 通り、parse の output が数値
- #2：親の refine が `path: ["a"]` で dynamic を指す → `validate` がその issue を `["a"]` に返す
- #3：dynamic の中の dynamic で、外側の refine が内側の output を受け取る
- #5：dynamic が不正・読み込み中・取得失敗のとき、親の refine の issue が出ず、dynamic の issue（と印）だけが出る
- 配列の要素ごとの dynamic（要素ごとに違う schema）
- union の腕の中の dynamic が失敗したとき、目印の issue が `invalid_union` の中にも残らない
- 目印の issue が一番外に出ない（登録のある path に、dynamic 自身の issue だけが出る）

### 5.2 zod-form-mantine（jsdom）

- `samePath.spec.tsx`・`dynamic.spec.tsx` に、描画した dynamic で #1・#2 を確かめるケースを足す（変換する dynamic と、変換後の値を見る親の refine で送信できる。dynamic を指す refine のエラーが欄に出る）
- union の腕の中の dynamic が失敗したとき、腕の欄に目印のエラーが出ない

### 5.3 zod-form-widget（`AutoForm.spec.tsx`）

- #1 の形で、AutoForm の onSubmit に変換後の値が届く
- dynamic が読み込み中・取得失敗・不正のとき、送信が止まった理由が今どおり出る

### 5.4 全体

`pnpm check-types`・`pnpm build`・`pnpm test` を通す。form-demo の E2E（zf.dynamic のページ）も通す。

---

## 6. 決めたこと

- 直し方は A（検証も dynamic の output を差し込んでから行い、失敗した所には目印を入れて親の refine を止める）
- 範囲は、FormRuntime の統一（#1・#2・#3・#5）、AutoForm の送信、送信が止まった理由、survey の SurveyBuilder。AutoSearch の onChange は扱わない（§1.1）
- dynamic が失敗したら、失敗の種類によらず親の refine を止める（§2.2）
- union の腕の中で dynamic が失敗し、別の腕で通ってしまうのは許す。目印の issue だけを消す（§2.3）
- `parse` の失敗の issue は全部を返す（§2.4）
- #4 は扱わず、深い登録から順に差し込むこともしない。評価の結果の使い回しもしない（§1.1）
- AutoForm の分岐は残し、中の検査を 1 回にするだけにする（§3.1）
- 「ついでに直せるものは直す」が、デメリットの重いものは避ける

## 7. 実装で変えたこと

- 登録は dynamic の土台の所だけでなく、externalKey（`zf.string()` の欄に、選択肢の schema を登録する）にもあった。その欄の登録が通らずに目印を差し込むと、静的な `z.string()` が目印を型の誤りとして弾き、そのエラーが欄に出た（zod-form-mantine の externalKey のテストで分かった）。
  そこで、評価の `safeParse` に `reportInput: true` を渡し、`input` が目印の issue を「目印を弾いた issue」として捨てる（土台の `params` の印も見る）。`input` は返す issue から外す（今までの issue の形のまま）。
  型の誤りは abort なので、この欄でも親の refine は走らない
- AutoForm の「検証は通ったのに onSubmit が送らなかった」場合は、`parseIssuesRef` の代わりに、その場で評価して issue があれば止まった理由を出す（検証と同じ評価なので、通常は起きない）。issue が無くても（呼ぶたびに答えが変わる検査で、評価し直すと通った・onSubmit が呼ばれなかった）、`handleSubmit()` の Promise は `undefined` で決着させる（PR #39 のレビューの指摘）
