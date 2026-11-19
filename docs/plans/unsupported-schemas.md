# zod-form の非対応スキーマに対応するプラン

- ステータス: プラン（レビュー中）
- 対象ブランチ: `claude/project-thread-e4chhv`
- 前提の main: dfb39e1（入れ物の目印 PR #31・UI 文言の差し替え PR #30 を取り込み済み。§1.3）
- 対象パッケージ: `@zodapp/zod-form`、`@zodapp/zod-form-react`、`@zodapp/zod-form-mantine`、`@zodapp/zod-form-mantine-lite`、`@zodapp/zod-form-widget`、`apps/form-demo`（ほか `zf.file` を使っている所）

---

## 1. 背景

main（28ab1ea）で、約 90 種類の zod スキーマを jsdom の上で描画・入力・送信して調べた。
その結果を「対応した方が良いもの」「非対応で良いが落ち方を決めたいもの」「今のままで良いもの」に分け、
このプランでは、次の 9 つに対応する。

| #   | 内容                                                             | 今の症状                                                                                                                      |
| --- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | AutoForm の onSubmit に parse した値を渡す                       | 型は `z.output` だが、生のフォームの値が届く（`.trim()`・`.default()` が効かない）                                            |
| 2   | pipe を入口（in）の型で描く                                      | `.transform()` は欄が出ない。codec・stringbool などは何を入れても送信できない                                                 |
| 3   | literal 系（固定値と、複数の値を持つ literal）を共通の作りで扱う | 複数の値の literal は選べず、`getDefaultValue` が例外を投げる。値が1つの literal は「undefined」と出る。null などは Not found |
| 4   | set を描く                                                       | 部品が無く、欄が出ない（`zf.set` は meta だけある）                                                                           |
| 5   | キーを列挙できる record を、固定のキーで描く                     | キーが足りないエラーがどこにも出ず、送信できない                                                                              |
| 6   | `.`・`[`・`]` を含むキーを弾く                                   | record の値を編集すると `{ "a.b": "x", a: { b: "y" } }` に分かれて壊れる                                                      |
| 7   | `zf.file` を `zf.externalFile` に改名する                        | `z.file()` が zf.file の部品に回り、フォームごと落ちる                                                                        |
| 8   | `zf.dynamic()` の土台を `z.unknown()` にする                     | 土台が `z.never()` なので、静的な parse が必ず落ち、隣の `.refine()` も走らない                                               |
| 9   | `zf.*.registry` の型の約束と、実際の動きをそろえる               | 型は通るのに描けない・落ちるもの、型は通らないのに動くものがある                                                              |
| 10  | AutoForm が開くときに既定値を補う                                | 値が 1 つの literal・undefined のキー・`.default()` は、呼び出し側が入れないと入らない（#3 は部品が描いた後に書き込んでいた） |

### 1.1 このプランで扱わないもの

- 包むだけの型（`.readonly()`・`.prefault()`・`.nonoptional()`・`.catch()`）の対応
- 部品の無い型（`any`・`unknown`・`function`・`map` など）の落ち方の整理（Not found の出し方、送信が止まる理由の出し方）
- `z.promise` の検証が例外を投げて送信が終わらない件
- tuple の rest を足すボタン（#9 で、開発中のエラーにする）、`z.templateLiteral`、数値の enum の選択肢の名前、discriminatedUnion の腕の名前
- AutoTable・hideSchemaFields での各型の扱い
- 入れ物の path なし refine のエラーの件（PR #31 で main に入った）。tuple には入れ物の目印が置かれていないが、このプランでは足さない
- `zf.computed()` の土台（`z.never()`）。表示専用の欄の扱いは別に考える（#8 とは分ける）

### 1.2 `z.*` と `zf.*` の扱い

`zf.*()` は標準の zod スキーマに meta の登録を足した別名で、値・検証は `z.*()` と同じ。
部品は「zf の名前（typeName）で探し、無ければ zod の型の名前（`schema.type`）で探す」ので、
各項目は zf の関数ではなく、zod の型（`schema.type` と `def`）を基準に作り、`z.*` と `zf.*` のどちらでも同じに動くようにする。

- meta が無い（`z.*` で書いた）ときは、既定の見た目で描く。meta があれば label・uiType などを使う
- 項目ごとの対応：
  - #3：`z.literal`・`zf.literal`
  - #4：`z.set`・`zf.set`
  - #5：`z.record`・`zf.record`・`z.partialRecord`（キーの schema も `z.enum`・`zf.enum`・literal の union のどれでもよい）
  - #2：`.transform()`・`.pipe()`・`z.codec()`・`z.stringbool()`（zf には pipe の別名は無い）
- テストは、各項目を `z.*` と `zf.*` の両方で確かめる
- **zf の名前の決まり**：zf の typeName が zod の型の名前と同じなら、その zod の型を必ず受け付け、同じ部品で扱う。
  型の約束を広げて、ほかの型も受け付けてよい（例：`date` は同じ名前の `z.date()` に対応したうえで、`z.number()`・`z.iso.datetime()`・`z.iso.date()` にも広げている）。
  zod の型に対応しない独自の名前は、zod の型の名前と重ねない。
  今ある独自の名前（`time`・`externalKey`・`hidden`・`common`・`computed`・`dynamic`）は zod の型の名前と重なっていないことを確かめた。
  `file` は同じ名前の `z.file()` を受け付けないので、この決まりに反している。#7 で直す。この決まりは zod-form の README（zf の拡張の説明）に書く

### 1.3 main で入ったものに合わせること

調べたあとに main に入った 2 つの変更（PR #31・PR #30）に、新しく作る部品・文言を合わせる。

**入れ物の目印（PR #31、`docs/plans/container-touch.md`）**

入れ物の部品（object・intersection・array・record・record_entries・union）は、子の欄の後ろに `ContainerMarker` を置く。
目印は、入れ物の最後の欄を離したとき・入れ物の値が変わったときに、入れ物の欄のエラーを出し直す。

- 入れ物として描く新しい見た目には、目印を置く（`ownsContainerMarker` で判定）。#5 のキーの決まった record が当たる
- 入力欄は `useValidatePrecedingFields(field)` に登録する。登録しないと、その欄が入れ物の最後の欄のとき、離しても入れ物のエラーが出ない。#4 の set が当たる
- 入力できない表示（readOnly で出す固定値など）は登録しない。登録すると、その手前の欄が「最後の欄」でなくなり、入れ物のエラーが離しても出なくなる。#3 の固定値が当たる
- 固定値を書き込むと、入れ物の目印が入れ物の欄を検証するが、エラーは触ったか送信したあとにしか出ないので、開いた時点では出ない

**UI 文言の差し替え（PR #30、`docs/plans/i18n-messages.md`）**

- 画面に出す文言は `msg("zodFormMantine.…" /* 日本語 */)` で書き、そのパッケージの en（基準）と ja の辞書に足す。
  このプランに書いた日本語の文言は ja の訳として使い、en の文言は実装のときに決める
- 開発者向けの文言（`console.error` など）は辞書に入れず、英語で書く
- meta の文言（label など）は `getMeta` ではなく `useResolvedMeta`・`useResolveText` を通す（`msgKey` で書いた label を訳すため）
- 部品の中で `safeParse` してエラーを出すときは `{ error: zodMsgKeyErrorMap }` を渡し、表示の前に `msg.resolve` で訳す（`record_entries` のキーの検査と同じ）

---

## 2. onSubmit に parse した値を渡す（#1）

### 2.1 今

`AutoForm` は TanStack Form の `onSubmit` で受け取ったフォームの値（`value`）を、そのまま `onSubmit` に渡している。
型は `(data: z.output<T>) => void` だが、中身は parse 前の値（z.input の形）。

### 2.2 方針

`FormRuntime` に `parse(staticSchema, value)` を足し、送信のときにその結果（output）を `onSubmit` に渡す。
#8 で `zf.dynamic()` の土台を `z.unknown()` にするので、静的な schema のまま parse でき、dynamic の所は値がそのまま通る。
そこで、dynamic の output を先に値へ差し込んでから、静的な schema で parse する（先に差し込む形）。

1. 登録された path を、深い順に並べる
2. それぞれ、今の値のその path を、その path の一番深い登録の schema で parse する。失敗したら送信しない（読み込み中・取得の失敗も失敗として扱う）
3. その path に output を差し込む（既定値の補いで使っている `fillAt`。配列の添字も扱える）
4. 最後に、差し込んだ値を静的な schema で parse し、その output を onSubmit に渡す

- 2・4 の parse には、検証（`validate`）と同じく `{ error: zodMsgKeyErrorMap }` を渡す（§1.3）

- 外側の transform・refine は、dynamic を parse した後の値を受け取る。zod で親が子の output を受け取るのと同じ
- 差し込み先は入力の値の path なので、外側に transform があっても必ずある（後から差し込む形だと、output の形が変わって差し込み先が無くなる）
- dynamic の中の dynamic は、内側を先に差し込む。外側の schema から見ると内側の土台は `z.unknown()` なので、output が素通りする
- `zf.dynamic().refine(...)` のような dynamic 自身の検査は、静的な parse で output を受け取る（zod と同じ）
- 気をつける点：dynamic より外側の preprocess は、dynamic の output を受け取る。preprocess の値はフォームに入る前にそろえ済みで、
  2 度かけても同じになる作りが前提なので、実害はほぼ無い
- 検証（エラーの表示）は今のまま、parse 前の値で行う。変わるのは onSubmit に渡す値の作り方だけ
- `onCancel` は今のまま、フォームの値（z.input）を渡す
- `ReactiveAutoForm` ほか、送信の値を外に出す所を調べ、同じくそろえる

### 2.3 確かめること

- `.trim().toLowerCase()`・`.default("d")`・`z.coerce.number()`・`.transform()` の結果が onSubmit に届く
- dynamic を含むフォーム（form-demo の zf.dynamic のページ）で、onSubmit に resolve した schema の output が届く
- dynamic の外側に transform・refine があるとき、それが dynamic の output を受け取る
- dynamic の中の dynamic、配列の中の dynamic

---

## 3. pipe を入口の型で描く（#2）

### 3.1 今

`pipe` の部品（mantine-lite の `baseComponents/pipe.tsx`）は、出口（`def.out`）の schema で描く。
一方、検証は pipe 全体を `safeParse` するので、値は入口の型でなければ通らない。

- `z.string().transform(fn)` は `pipe(string, ZodTransform)` なので、`ZodTransform` を描こうとして Not found になる
- `z.string().transform(Number).pipe(z.number())`・`z.codec(z.iso.datetime(), z.date())`・`z.stringbool()` は、
  出口の型の部品（数値・日付・チェックボックス）が出口の型の値を書き込み、「expected string」で止まる

### 3.2 方針

- pipe の部品は、入口（`def.in`）の schema で描く
  - preprocess（入口が `ZodTransform`）は、今どおり Switch の手前の `PreprocessSwitch` で扱う（この部品には来ない）
  - 入口がさらに pipe なら、同じ部品でたどる
- pipe 自体に付いた検査（`.refine()` など）は、`addOuter` で中に渡す（default の部品と同じ）
- `getDefaultValue`（zod-transform の preprocess）は、すでに入口をたどっているので変えない
- `z.stringbool()` は文字列の欄になる。チェックボックスで出す専用の扱いは、このプランでは作らない

### 3.3 確かめること

- `.transform()`（string・object）、`pipe(string, string.min(2))`、`transform(Number).pipe(number)`、codec、stringbool で、
  入力して送信でき、#1 と合わせて onSubmit に output が届く

---

## 4. literal 系を共通の作りで扱う（#3）

### 4.1 今

- 値が 1 つの literal の部品は、スキーマの値ではなくフォームの値を表示する。初期値が無いと「undefined」と出て、送信も「expected 3」で止まる。
  必須の印「\*」も付く
- 値が複数の literal（`z.literal(["a","b"])`）は、値を表示するだけで選べない。`getDefaultValue` の literal の処理が `schema.value` を読むので、zod が例外を投げる
- `z.null()`・`z.undefined()`・`z.void()` は部品が無く、Not found が出る（object の欄でも、union の null の腕を選んだときも）
- discriminatedUnion・literal を持つ object の union では、選んだ腕の中に discriminator の literal（例「sms」）がもう一度出て、選択欄と二重になる（jsdom で確かめた）
- apps で literal に付けている label は、どれも enum・literal の union の「選択肢の名前」で、欄として見せるためのものではない

### 4.2 方針：固定値は既定で出さない

値が 1 つに決まる型を「固定値」と呼ぶ：値が 1 つの literal（`z.literal("a")`・`z.literal(3)`・`z.literal(null)` など）・`z.null()`・`z.undefined()`・`z.void()`。

- 固定値の欄は、既定で出さない（ラベルも出さない）
- 値は `getDefaultValue` が入れる（値が 1 つの literal はその値、undefined・void はキーを undefined で置く）。
  AutoForm が開くときに `getDefaultValue` を通すので（§11）、部品からは書き込まない
- 見せたいときは meta で `hidden: false` と明示する。readOnly と同じ表示で、スキーマの値を出す。必須の印は付けない。
  null・undefined・void は、`hidden: false` でも中身が無いので出さない
- これで union の腕の中の discriminator も出なくなるので、union 側に特別な扱いは要らない。union で null の腕を選ぶと、選択欄だけが残る
- 影響しないもの
  - `zf.boolean.registry` を付けた `z.literal(true)`（同意のチェック）は boolean の部品で描くので、今のままチェックボックスで出る
  - literal の union を選ぶ部品（`union_select`・`union_badge`）の選択肢

### 4.3 方針：値が複数の literal は enum と同じに選ぶ

- 値（`schema.def.values`）が 2 つ以上の literal は、enum の部品で描く（`uiType` の `select`・`badge` も enum にそろえる）
  - 選択肢・空の扱い・`unlisted` は enum と同じ
- `getDefaultValue` の literal の処理は、値が 1 つのときだけその値を入れ、複数なら値を入れない（undefined）
- `array_multipleEnum` も、要素が値が複数の literal のとき動くようにする（union_select のときと同じ広げ方）

### 4.4 コードの作り

literal 系の中身は 1 か所にまとめ、部品のファイルは型ごとに置く。

- 固定値の中身（既定で出さない・`hidden: false` なら readOnly で出す・エラーがあれば出す）を 1 つの共通の部品にする
- 部品のファイル（`componentLibrary` のキー）：
  - `literal.tsx`：`z.literal()` の入口。値が 1 つなら固定値の共通の部品、2 つ以上なら enum の部品に分ける
    （`literal_select`・`literal_badge` も同じファイルで受ける）
  - `null.tsx`・`undefined.tsx`・`void.tsx`：固定値の共通の部品をそのまま使う
- `z.*`・`zf.*` のどちらでも同じに動く（§1.2）
- §1.3 に合わせる
  - meta は `useResolvedMeta` で読む
  - 固定値を `hidden: false` で出すときも、`useValidatePrecedingFields` に登録しない
  - 値が複数の literal の選択は、enum の部品の作り（`useUnlistedLabel`・`resolveText` を渡す `normalizeStringSuggestions` など）をそのまま使う

## 5. set を描く（#4）

### 5.1 方針

set は順序の無い集合として扱う。並べ替えや、位置を指定した挿入は作らない。

- set の要素には、TanStack Form のパス（`f[0]` など）で欄を割り当てられないので、set の値全体を 1 つの欄として扱う
- 部品は `set`（`componentLibrary` に足す。`z.set`・`zf.set` のどちらもここに来る）。要素の schema で見た目を変える。要素の schema も `z.*`・`zf.*` のどちらでもよい

| 要素の schema                                  | 見た目                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| enum・literal の union・複数の値を持つ literal | MultiSelect（`array_multipleEnum` と同じ見た目。書き込むのは Set） |
| string・number                                 | TagsInput（`array_multipleString` と同じ見た目。重複は入らない）   |
| それ以外（object など）                        | 非対応。その場所に「この set は非対応」と出す（辞書に足す。§1.3）  |

- `array_multipleEnum`・`array_multipleString` の中身を、配列と Set の両方で使えるように分ける
- 空のとき：必須なら空の Set、optional なら undefined、nullable だけなら null（`emptyValueOf` にそろえる）
- 読み取り専用：選んだ値を Pill で並べる（配列と同じ）
- エラー：set の下の issue（要素の検査のエラーを含む）を、すべて set の欄に出す
- 入力欄は `useValidatePrecedingFields(field)` に登録する（`array_multipleEnum` と同じ。§1.3）

### 5.2 合わせて直す所

- 値の比較（`zod-form-react/src/utils/equal.ts` の `isEqualValue`、`switch.tsx` の `isEqualValue`）は、
  Set・Map をキーの無い object として比べるため、中身が違っても「同じ」になる。Set・Map の中身を比べるようにする
- AutoForm のプレビュー（`showPreview`）の JSON 化で、Set を配列として出す（今は `{}` になる）

---

## 6. キーを列挙できる record を、固定のキーで描く（#5）

### 6.1 今

- zod 4 の record は、キーの schema の `_zod.values` があるときだけ、すべてのキーを必須として検証する。
  `_zod.values` は enum・literal・literal の union などで入り、`z.partialRecord` はわざと空にしている
- 足りないキーのエラーは `[key]` の path に出るが、その欄が無いので、どこにも出ない。キーを足す手段も無い

### 6.2 方針

zod と同じ基準（`keyType._zod.values` があるか）で分ける。

- `_zod.values` がある record（以下「キーの決まった record」）は、そのキーを固定の欄として、object と同じように並べて描く
  - 欄の名前はキーそのもの（数値の値は文字にする。zod と同じ）。キーの schema が `zf.enum`（または zf.literal の union）で、選択肢に label があれば、その label を欄の名前にする
  - `uiType` が `entries` でも同じ（キーの追加・名前の変更はできないので、entries の見た目は使わない）
  - 値にあって、列挙に無いキーは、今どおり zod の unrecognized_keys として record の欄に出る
  - 欄の名前に使う選択肢の label は `useResolveText` で訳す（§1.3）
  - 子の欄の後ろに入れ物の目印（`ContainerMarker`）を置く。`record.tsx` の中で分ける作りにすれば、今ある目印をそのまま使える（§1.3）
- `getDefaultValue` は、キーの決まった record の値が無いとき、列挙したキーごとに値の schema の初期値を入れる
  （初期値が undefined なら、そのキーは置かない。object と同じ扱い）
- `_zod.values` が無い record は、今の見た目のまま。ただし、キーの検査のエラー（`invalid_key`）が値の欄に出ているのを、
  キーの側に出す（entries ならそのキーの欄、既定の見た目なら record の欄）。
  キーの検査は `{ error: zodMsgKeyErrorMap }` を渡して行い、`msg.resolve` で訳して出す（今の entries のキーの検査と同じ。§1.3）

---

## 7. `.`・`[`・`]` を含むキーを弾く（#6）

### 7.1 今

TanStack Form（1.33.2）の欄の名前は文字列だけで、エスケープの書き方が無い。名前の扱いは、値と状態で違う。

|                        | 名前 `f.a.b` を通す                                                                                                                   | 親の record を通す                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 値の読み               | 壊れる（`makePathArray` が `["f","a","b"]` に分けてたどる。無ければ undefined、キー `a` の object に `b` があればその値を読み違える） | できる（`record["a.b"]`）         |
| 値の書き               | 壊れる（`{ a: { b } }` を作る）                                                                                                       | できる（record 全体を書き換える） |
| 状態・エラーの読み書き | できる（`fieldMeta["f.a.b"]` のように名前を文字列のまま鍵にする。別の要素と名前が重なると混同する）                                   | —                                 |

- フォーム全体の検証のエラーは、zod の path を `.` でつないだ名前で `fieldMeta` に書き込まれる。その名前の欄が描かれていなくても書き込まれ、
  エラーが無くなれば消える（jsdom で確かめた）
- 標準の部品（Switch で描くもの）は、値を名前を通して読み書きするので、`.`・`[`・`]` を含むキーの要素には使えない

### 7.2 方針

これらのキーは非対応とし、場所ごとに次のように弾く。空文字のキーも、パスが親を指してしまうので同じ扱いにする。

- 判定の関数 `isUnsafeFieldKey(key)` を `zod-form-react` の `utils/path.ts` に置く
- **record の entries の見た目**：キーを入れた時点で「キーに . [ ] は使えません」のエラーにし、値に反映しない（重複のエラーと同じ扱い）
- **record に保存されていた値のキー**：その要素は標準の部品で描かない。代わりに、record の中に次の行を出す
  - キーと「このフォームでは編集できません」の注記
  - その要素のエラー（`fieldMeta[record の path + "." + キー]` を読む）。値が不正なら、TanStack の invalid で送信は止まり、理由がこの行に見える
  - 消すボタン（record 全体を書き換えて消す）
  - 値は変えず、送信も止めない（値が正しければそのまま送る）
  - 値は表示しない
  - 注意：値が object の record で、キー `a` と `a.b` が同時にあると、エラーの名前が重なり、持ち主を見分けられない（ドキュメントに書く）
- **object の shape のキー・キーの決まった record の列挙のキー**：スキーマを書く人が決めるので、その欄の場所に「このキー名は使えません」と出し、`console.error` も出す
- looseObject・catchall の shape に無いキーは、object の部品が描かないので、対象にしない
- 「キーに . [ ] は使えません」「このフォームでは編集できません」「このキー名は使えません」は辞書に足す。`console.error` の文言は英語にする（§1.3）
- 数字だけのキー（`"1"`）は、TanStack が数として扱うが、object の上ではそのまま動くので対象にしない

---

## 8. `zf.file` を `zf.externalFile` に改名する（#7）

### 8.1 今

`zf.file` が登録する名前（typeName）が `"file"` で、`z.file()` の型の名前（`schema.type`）と同じ。
部品は「zf の名前で探し、無ければ zod の型の名前で探す」ので、`z.file()` が zf.file の部品に当たり、
`fileConfig` が無いためフォームごと落ちる。

### 8.2 方針

- zf.file の値は「外に置いたファイルを指す文字列」なので、`externalKey` に合わせて `externalFile` と呼ぶ
- 関数を `zf.externalFile`、typeName と `componentLibrary` のキーを `"externalFile"` にする
- 型・ファイル名・設定の名前も合わせる（`file.tsx` → `externalFile.tsx` など）。`fileConfig`・`FileResolvers` などの設定の名前は変えない
  （「ファイルの設定」として意味が通るため）
- 使っている所（form-demo・taskmanager・zod-form-s3・README・AGENT.md）を書き換える
- `zf.file` は `z.string()` に meta を付けたものなので、値・検証は変わらず、変わるのは名前だけ
- 改名のあと、`z.file()` は部品の無い型の 1 つになる（Not found。§1.1 の落ち方の整理で扱う）
- `zf.file` を互換の別名としては残さない
- 部品の文言のキー `zodFormMantine.file.*`（`remove`・`dropzone`・`maxSize`）も `zodFormMantine.externalFile.*` に変える。
  辞書のキーは公開 API だが、改名がもともと破壊的変更で、全パッケージがまだ npm に出ていない（0.0.0）ため、合わせて変える
- CHANGELOG に破壊的変更として書く（文言のキーの変更も含める）

---

## 9. `zf.dynamic()` の土台を `z.unknown()` にする（#8）

### 9.1 今

`zf.dynamic()` は `extendCustom(z.never, "dynamic", …)` で、土台が `z.never()`。

- 静的な schema で parse すると、dynamic の所で必ず落ちる（検証は、登録された path の issue を捨てることで通している）
- 落ちるので、dynamic の隣の object の `.refine()` が走らず、黙って効かない（`docs/plans/same-path-experiment.md` §5 で `it.fails` として記録済み）
- 型が `never` になり、form-demo では初期値を `unknown` 経由で型変換している

zod 4 で確かめたこと：`z.object({ a: z.unknown() })` に `{ a: 1 }` を渡すと通り、親の `.refine()` も走る。
`z.object({ a: z.never() })` では never の所で落ち、親の `.refine()` は走らない。

### 9.2 方針

- 土台を `z.unknown()` にする（`zod-form` と、上書きしている `zod-form-react` の `def/index.ts` の両方）
- 静的な検証では、dynamic の所は何でも通る。値の検証は、今どおり登録された schema で行う
  - 読み込み中・取得の失敗は、今どおり登録して送信を止める
  - キーが無いとき、`z.unknown()` は zod 4 では「expected nonoptional」になるが、登録された path の issue は捨てるので、画面の動きは変わらない
  - 描かれていない（登録の無い）dynamic は、静的な検証では何でも通るようになる。今は never で必ず止まっている。これは受け入れる
- `zod-form-mantine` の `samePath.spec.tsx` の `it.fails`（隣の `.refine()` が効かない）を、通るテストに直す
- form-demo の `unknown` 経由の型変換を外す
- CHANGELOG に、`zf.dynamic()` の型が `never` から `unknown` に変わることを書く

---

## 10. `zf.*.registry` の型の約束と、実際の動きをそろえる（#9）

### 10.1 今

各 `zf.*.registry` にいろいろなスキーマを `.register()` して tsc で確かめ、型が通ったもののうち怪しいものを jsdom で描画・送信した。

**型は通るのに、描けない・落ちるもの**

| registry              | 受け付けるもの                      | 動き                                                   | 対応                          |
| --------------------- | ----------------------------------- | ------------------------------------------------------ | ----------------------------- |
| `zf.literal.registry` | 値が複数の literal                  | 選べない                                               | #3 で直る                     |
| `zf.set.registry`     | `z.set()`                           | 部品が無い                                             | #4 で直る                     |
| `zf.record.registry`  | キーが enum の record               | 送信できない                                           | #5 で直る                     |
| `zf.union.registry`   | 腕は何でも（例：null の腕）         | null の腕が Not found                                  | #3 で直る（固定値は出さない） |
| `zf.tuple.registry`   | rest 付きの tuple                   | rest の要素を足せない                                  | 10.2                          |
| `zf.array.registry`   | uiType と要素の組み合わせは問わない | 要素が object の配列に `multipleEnum` で、例外で落ちる | 10.2                          |
| `zf.common.registry`  | どの型でも（meta だけを足すもの）   | 部品の無い型に付けると Not found                       | 意図どおり。変えない          |

**型は通らないのに動くもの**

- `zf.date.registry` は `z.coerce.date()` を受け付けない（実際は `z.date()` と同じ部品で動く）
- `zf.externalKey.registry`・`zf.file.registry` は `z.string()` だけで、`z.email()` などの書式付きの文字列を受け付けない（`zf.string` は受け付ける）

**型どおりに動いたもの**：`zf.boolean.registry` を付けた `z.literal(true)`、`zf.union.registry` を付けた `z.xor`、
`zf.date` の `iso.datetime({ local: true })`・`iso.date`、`zf.time` の number、`zf.string` の `iso.datetime`、土台が string の `zf.dynamic`

### 10.2 方針

- 型で縛るのが難しいもの（tuple の rest、array の uiType と要素の組み合わせ）は、開発中のはっきりしたエラーにする。
  その欄の場所に「この組み合わせは非対応」と出し、`console.error` も出す。例外で描画ごと落とさない。
  画面の文言は辞書に足し、`console.error` は英語にする（§1.3）
- 型の約束が狭いものは広げる：`zf.date.registry` に `z.coerce.date()`、`zf.externalKey.registry`・`zf.externalFile.registry`（#7）に書式付きの文字列（`zf.string` と同じ `z.ZodString | z.ZodStringFormat`）
- registry ごとに、受け付ける型と描ける型が合っていることを確かめる型のテスト（`expectTypeOf`・`@ts-expect-error`）と、描画のテストを足す

---

## 11. AutoForm が開くときに既定値を補う（#10）

### 11.1 今

- AutoForm は、受け取った `defaultValues` をそのまま使う（`getDefaultValue` を通さない）。`useDefaultValuesWithFills` が補うのは、
  `zf.dynamic` が決めた schema の path だけ。静的な schema の `.default()`・空の配列・object・値が 1 つの literal は、
  呼び出し側が `defaultValues` に入れない限りフォームに入らない（`dynamic-default-fill.md` §4 で未決にしていた）
- #3 の実装では、固定値（値が 1 つの literal・undefined・void）の値を、部品が描いた後に書き込んでいる。
  描く前に走る検証にはキーが無く見え、書いた値は既定値に入らないので「変更あり」に見えることがあり、描かれない欄には効かない

### 11.2 方針

- AutoForm は、`defaultValues` を `getDefaultValue(schema, defaultValues)` に通してから使う
  （`defaultValues` が無ければ `getDefaultValue(schema)`）。補った値は既定値に入るので、開いただけでは「変更あり」にならず、reset でも残る
- `getDefaultValue` が例外を投げたら（optional の付かない `z.lazy` の無限の再帰など）、補わずに渡された値で続け、`console.error` を出す（英語）
- 固定値の部品からの書き込みをやめる。部品は、既定で出さない・`hidden: false` なら出す・エラーがあれば出す、だけにする
- 必須の object・intersection・配列は `{}`・`[]` で始まる。「必須だが空」で始める使い方は無くす
  （form-demo の「必須の intersection（空）」の例は、開いたあとに中身を消した場合の例に変える）
- 送信する値には、補ったキー（空の配列など）が入る
- AutoSearch は補わない（検索の条件に literal・空の配列が入ると、絞り込みが変わるため）
- ReactiveAutoForm は TanStack の form を使わず欄ごとに保存するので、対象にしない

### 11.3 合わせて直す所

- form-demo の E2E：union-arms の 2 件（#3 で値が 1 つの literal の値を出さなくなった）、intersection の 1 件（上の「必須だが空」）
- `dynamic-default-fill.md` §4 の未決の項目を、決まったとして書き換える
- ドキュメント（zod-form-widget の README）と changeset に、AutoForm が開くときに既定値を補うこと・送信する値に補ったキーが入ること・
  AutoSearch と ReactiveAutoForm は補わないことを書く

### 11.4 確かめること

- AutoForm の spec：`.default()`・空の配列・値が 1 つの literal・undefined のキーが、開いたときから値に入り、isDirty が false のまま送れる
- AutoForm の spec：optional の付かない `z.lazy` でも落ちず、`console.error` が出る
- 固定値の部品が書き込まなくても、AutoForm で送信が通る
- form-demo の E2E がすべて通る

## 12. テスト

- 各項目ごとに、zod-form-mantine の spec（jsdom）で、描画・入力・送信を確かめる。§1.2 のとおり `z.*` と `zf.*` の両方で確かめる
- `getDefaultValue` の変更（#3・#5）は zod-form の spec で確かめる
- #3 は、固定値が出ないこと・値を書き込むこと・`hidden: false` で出ること、discriminatedUnion の腕の中に discriminator が出ないことを確かめる
- #1 は zod-form-widget の AutoForm の spec を足す（今は `@testing-library/react` が入っていないので、devDependencies に足す）
- form-demo に、pipe・transform・set・キーの決まった record・複数の値を持つ literal の例を足す（ページを足すか、既存のページに入れるかは実装のときに決める）
- 最後に `pnpm check-types`・`pnpm build`・`pnpm test` を通す

## 13. 決めたこと

- #1：dynamic の output を先に差し込んでから、静的な schema で parse する（§2.2）
- #7：`zf.file` を互換の別名として残さない
- #6：保存されていた値に使えないキーがあっても、送信は止めない。エラーと消すボタンを出す（§7.2）
- #7：文言のキー `zodFormMantine.file.*` も `zodFormMantine.externalFile.*` に変える（§8.2）
- #8：CSV の書き出し・読み込みでは、`zf.dynamic` の欄を今までどおり飛ばす（zod-tabular に `skip` を足す）
- #10：値は AutoForm で `getDefaultValue` を通して補い、固定値の部品からは書き込まない。「必須だが空」で始める使い方は無くす（§11）
