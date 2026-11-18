# zod-form の非対応スキーマに対応するプラン

- ステータス: プラン（レビュー中）
- 対象ブランチ: `claude/project-thread-e4chhv`
- 対象パッケージ: `@zodapp/zod-form`、`@zodapp/zod-form-react`、`@zodapp/zod-form-mantine`、`@zodapp/zod-form-mantine-lite`、`@zodapp/zod-form-widget`、`apps/form-demo`（ほか `zf.file` を使っている所）

---

## 1. 背景

main（28ab1ea）で、約 90 種類の zod スキーマを jsdom の上で描画・入力・送信して調べた。
その結果を「対応した方が良いもの」「非対応で良いが落ち方を決めたいもの」「今のままで良いもの」に分け、
このプランでは、次の 7 つに対応する。

| #   | 内容                                                               | 今の症状                                                                           |
| --- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| 1   | AutoForm の onSubmit に parse した値を渡す                         | 型は `z.output` だが、生のフォームの値が届く（`.trim()`・`.default()` が効かない） |
| 2   | pipe を入口（in）の型で描く                                        | `.transform()` は欄が出ない。codec・stringbool などは何を入れても送信できない      |
| 3   | 複数の値を持つ literal（`z.literal(["a","b"])`）を選べるようにする | 値を表示するだけで選べない。`getDefaultValue` が例外を投げる                       |
| 4   | set を描く                                                         | 部品が無く、欄が出ない（`zf.set` は meta だけある）                                |
| 5   | キーを列挙できる record を、固定のキーで描く                       | キーが足りないエラーがどこにも出ず、送信できない                                   |
| 6   | `.`・`[`・`]` を含むキーを弾く                                     | record の値を編集すると `{ "a.b": "x", a: { b: "y" } }` に分かれて壊れる           |
| 7   | `zf.file` を `zf.externalFile` に改名する                          | `z.file()` が zf.file の部品に回り、フォームごと落ちる                             |

### 1.1 このプランで扱わないもの

- 包むだけの型（`.readonly()`・`.prefault()`・`.nonoptional()`・`.catch()`）の対応
- 部品の無い型（`any`・`unknown`・`null`・`function`・`map` など）の落ち方の整理（Not found の出し方、送信が止まる理由の出し方）
- `z.promise` の検証が例外を投げて送信が終わらない件
- tuple の rest を足すボタン、`z.templateLiteral`、数値の enum の選択肢の名前、discriminatedUnion の腕の名前
- AutoTable・hideSchemaFields での各型の扱い
- 入れ物（object・intersection）の path なし refine のエラーの件（別スレッドで対応中）

---

## 2. onSubmit に parse した値を渡す（#1）

### 2.1 今

`AutoForm` は TanStack Form の `onSubmit` で受け取ったフォームの値（`value`）を、そのまま `onSubmit` に渡している。
型は `(data: z.output<T>) => void` だが、中身は parse 前の値（z.input の形）。

### 2.2 方針

`FormRuntime` に `parse(staticSchema, value)` を足し、送信のときにその結果（output）を `onSubmit` に渡す。

ただし、`zf.dynamic()` の土台は `z.never()` なので、静的な schema だけで parse すると dynamic の欄で必ず失敗する
（検証は、登録された path の issue を差し替えることで通している）。そこで次の手順で output を作る。

1. 静的な schema の dynamic の所を `z.unknown()` に置き換えた schema で parse する（値はそのまま通る）
2. 登録された path ごとに、登録された schema で、その path の値を parse する（深い path から）
3. 1 の結果の、その path の所を 2 の結果で置き換える

- 置き換えた schema は、静的な schema ごとに覚えておく（WeakMap）
- dynamic の path より外側に transform があり、output の形が input と変わるときは、3 の置き換え先が正しく取れない。
  この組み合わせは非対応とし、開発中に警告を出す（transform の有無は、dynamic の所までの schema をたどって調べる）
- `onCancel` は今のまま、フォームの値（z.input）を渡す
- `ReactiveAutoForm` ほか、送信の値を外に出す所を調べ、同じくそろえる

### 2.3 確かめること

- `.trim().toLowerCase()`・`.default("d")`・`z.coerce.number()`・`.transform()` の結果が onSubmit に届く
- dynamic を含むフォーム（form-demo の zf.dynamic のページ）で、onSubmit に resolve した schema の output が届く

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

## 4. 複数の値を持つ literal を選べるようにする（#3）

### 4.1 今

- literal の部品は値を表示するだけで、選ぶ欄が無い
- `getDefaultValue` の literal の処理が `schema.value` を読むので、値が複数あると zod が例外を投げる

### 4.2 方針

- literal の部品は、値（`schema.def.values`）が 2 つ以上なら、enum の部品で描く（`uiType` の `select`・`badge` も enum にそろえる）
  - 選択肢・空の扱い・`unlisted` は enum と同じ
  - 値が 1 つなら、今どおり表示だけ
- `getDefaultValue` の literal の処理は、値が 1 つのときだけその値を入れ、複数なら値を入れない（undefined）
- `array_multipleEnum` も、要素が複数の値を持つ literal のとき動くようにする（union_select のときと同じ広げ方）

---

## 5. set を描く（#4）

### 5.1 方針

set は順序の無い集合として扱う。並べ替えや、位置を指定した挿入は作らない。

- set の要素には、TanStack Form のパス（`f[0]` など）で欄を割り当てられないので、set の値全体を 1 つの欄として扱う
- 部品は `set`（`componentLibrary` に足す）。要素の schema で見た目を変える

| 要素の schema                                  | 見た目                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| enum・literal の union・複数の値を持つ literal | MultiSelect（`array_multipleEnum` と同じ見た目。書き込むのは Set） |
| string・number                                 | TagsInput（`array_multipleString` と同じ見た目。重複は入らない）   |
| それ以外（object など）                        | 非対応。その場所に「この set は非対応」と出す                      |

- `array_multipleEnum`・`array_multipleString` の中身を、配列と Set の両方で使えるように分ける
- 空のとき：必須なら空の Set、optional なら undefined、nullable だけなら null（`emptyValueOf` にそろえる）
- 読み取り専用：選んだ値を Pill で並べる（配列と同じ）
- エラー：set の下の issue（要素の検査のエラーを含む）を、すべて set の欄に出す

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
  - 欄の名前はキーそのもの（数値の値は文字にする。zod と同じ）
  - `uiType` が `entries` でも同じ（キーの追加・名前の変更はできないので、entries の見た目は使わない）
  - 値にあって、列挙に無いキーは、今どおり zod の unrecognized_keys として record の欄に出る
- `getDefaultValue` は、キーの決まった record の値が無いとき、列挙したキーごとに値の schema の初期値を入れる
  （初期値が undefined なら、そのキーは置かない。object と同じ扱い）
- `_zod.values` が無い record は、今の見た目のまま。ただし、キーの検査のエラー（`invalid_key`）が値の欄に出ているのを、
  キーの側に出す（entries ならそのキーの欄、既定の見た目なら record の欄）

---

## 7. `.`・`[`・`]` を含むキーを弾く（#6）

### 7.1 今

TanStack Form（1.33.2）の欄の名前は文字列だけで、エスケープの書き方が無い。
名前は `.`・`[`・`]` で区切られ、欄の状態もこの名前で持ち、zod のエラーの path も `.` でつないで欄に振り分ける。
そのため、`.`・`[`・`]` を含むキーは、1 つの欄として扱えない。

### 7.2 方針

これらのキーは非対応とし、場所ごとに次のように弾く。空文字のキーも、パスが親を指してしまうので同じ扱いにする。

- 判定の関数 `isUnsafeFieldKey(key)` を `zod-form-react` の `utils/path.ts` に置く
- **record の entries の見た目**：キーを入れた時点で「キーに . [ ] は使えません」のエラーにし、値に反映しない（重複のエラーと同じ扱い）
- **record に保存されていた値のキー**：そのキーの欄は描かず、record の欄に「使えないキーがあります：a.b」と出す。値は変えず、送信も止めない
- **object の shape のキー・キーの決まった record の列挙のキー**：スキーマを書く人が決めるので、その欄の場所に「このキー名は使えません」と出し、`console.error` も出す
- looseObject・catchall の shape に無いキーは、object の部品が描かないので、対象にしない
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
- 改名のあと、`z.file()` は部品の無い型の 1 つになる（Not found。§1.1 の落ち方の整理で扱う）
- CHANGELOG に破壊的変更として書く

---

## 9. テスト

- 各項目ごとに、zod-form-mantine の spec（jsdom）で、描画・入力・送信を確かめる
- `getDefaultValue` の変更（#3・#5）は zod-form の spec で確かめる
- #1 は zod-form-widget の AutoForm の spec を足す（今は `@testing-library/react` が入っていないので、devDependencies に足す）
- form-demo に、pipe・transform・set・キーの決まった record・複数の値を持つ literal の例を足す（ページを足すか、既存のページに入れるかは実装のときに決める）
- 最後に `pnpm check-types`・`pnpm build`・`pnpm test` を通す

## 10. 決めていないこと

1. #1 で、dynamic の外側に transform があるとき、警告を出して生の値を渡すか、送信を止めるか（案：警告を出し、その dynamic の所は parse 前の値のままにする）
2. #7 で、`zf.file` を互換のための別名として 1 つの版だけ残すか（案：npm にまだ出していないなら残さない）
3. #6 で、保存されていた値に使えないキーがあるとき、送信を止めるか（案：止めない。値は変えずに通す）
