# 残りの非対応スキーマに対応するプラン

- ステータス: 実装済み
- 対象ブランチ: `claude/project-thread-e4chhv`
- 前提の main: 600252e（`unsupported-schemas.md` の #1〜#10 を取り込み済み。PR #32）
- 対象パッケージ: `@zodapp/zod-form`、`@zodapp/zod-form-react`、`@zodapp/zod-form-mantine`、`@zodapp/zod-form-mantine-lite`、`@zodapp/zod-form-widget`、`apps/form-demo`（ほか `zf.computed` を使っている apps）

---

## 1. 背景

main（600252e）で、zod 4 の型を 1 つずつ object の欄に入れ、jsdom の上で描画と送信を調べた。

| 調べた型                                                                                                       | 今の動き                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `z.file()`・`z.promise()`・`z.function()`・`z.success()`                                                       | 「Component not found」。送信が止まり、理由も出ない                                                                                 |
| `z.any()`・`z.unknown()`・`z.custom()`・`z.symbol()`・`z.map()`・`z.nan()`・`z.templateLiteral()`・`z.never()` | 「Component not found」。欄は出ないが、送信は通る                                                                                   |
| `.readonly()`・`.catch()`・`.nonoptional()`・`.prefault()`                                                     | 「Component not found」。`.readonly()` は object を包むと object ごと出ない。`.prefault()` は既定値も入らない                       |
| 数値の enum（`z.enum({ A: 1, B: 2 })`）                                                                        | 選択肢の名前が値（1・2）。数値の TS enum は、逆引きのキーまで選択肢に出る（Red・Blue・0・1）。Red・Blue を選ぶと zod の検証で落ちる |
| optional の付かない再帰（`z.lazy`）                                                                            | 描画が終わらない（`getDefaultValue` の無限の再帰は、AutoForm が例外を握る）                                                         |
| `zf.computed()`                                                                                                | 土台が `z.never()` なので、`.optional()` を付け忘れると「expected never」で送信が止まる                                             |

`.pipe()`・`.transform()`・`z.stringbool()`・codec・`z.int()`・配列の配列・record の record・looseObject・optional な再帰は、問題なく動いた。

### 1.1 このプランで扱わないもの

- `zf.dynamic` の変換と親の refine（別のスレッドで検討している）
- discriminatedUnion・`z.xor` の腕の名前、tuple の rest を足すボタン、tuple の入れ物の目印
- AutoTable・`hideSchemaFields` での各型の扱いの洗い出し
- 非同期の検証（`safeParseAsync` と TanStack Form の非同期の検証）への対応。§5.5 で例外を握るまでにとどめる
- `z.success()`（ドキュメントに無い API。個別の対応はせず、§5.6 の共通の扱いに任せる）

### 1.2 前のプランから引き継ぐ約束

`unsupported-schemas.md` §1.2・§1.3 のとおり、`z.*` と `zf.*` のどちらでも同じに動かし、meta は `useResolvedMeta` で読む。
画面の文言は辞書（en・ja）に足し、`console.error` の文言は英語にする。扱えないものは `UnsupportedNotice` でその欄の場所に出す。

---

## 2. 進める順

| #   | 内容                                                                                        |
| --- | ------------------------------------------------------------------------------------------- |
| 1   | `zf.computed()` を初めから optional にする（§3）                                            |
| 2   | enum の選択肢の名前（§4）                                                                   |
| 3   | 部品の無い型（§5）：包む型 → 値を保つ型・固定値 → 注記と例外 → templateLiteral → file → map |
| 4   | optional の付かない再帰を止める（§6）                                                       |

それぞれ 1 コミットにする（#3 は小項目ごとに分けてよい）。

---

## 3. `zf.computed()` を初めから optional にする（#1）

### 3.1 方針

- `zf.computed()` が optional を含む形を返す。値を持たない表示専用の欄なので、キーが無くても検証を通す
- 型の上でも、object の型で optional なキーになる
- apps・form-demo の `zf.computed().optional()` から `.optional()` を消す（二重でも害は無いが、書き方をそろえる）
- 値を持つ欄に computed の meta を付ける使い方（`ComputedMetaDef` の説明）は変えない

### 3.2 確かめること

- `z.object({ total: zf.computed() })` が `{}` を検証で通す（zod-form の spec）
- `expectTypeOf` で、キーが optional になる
- form-demo の computed の E2E が通る

---

## 4. enum の選択肢の名前（#2）

### 4.1 今の仕様

| 書き方                                            | 選択肢の名前                                      |
| ------------------------------------------------- | ------------------------------------------------- |
| `z.enum(["a", "b"])`                              | 値                                                |
| `z.enum({ A: "a" })`・文字列の TS enum            | 値（キーは使わない）                              |
| `z.enum({ A: 1 })`・数値の TS enum                | 値。数値の TS enum は逆引きのキーまで選択肢に出る |
| `zf.enum([zf.literal(…).register(…, { label })])` | literal の label。無ければ値                      |
| literal の union ＋ `uiType: "select"`・`"badge"` | 腕の label。無ければ値                            |
| `z.literal(["a", "b"])`                           | 値                                                |

### 4.2 方針

- object の形で書いた enum（`def.entries` のキーと値が違うもの。TS enum を含む）は、label が無ければキーを選択肢の名前にする。
  配列で書いた enum（キーと値が同じ）は今のまま
- zod の検証を通らない値を選択肢から外す。数値の TS enum の逆引きのキー（`"Red"` など）は、`options` に入るが検証は通らないので、これで消える
- 名前を自由に付けたいときは、引き続き `zf.enum`・literal の union を使う（label が最優先）
- enum・`enum_badge`・`multipleEnum`・set の複数選択・`union_select` の選択肢を作る所（mantine-lite の `utils/enum.tsx`）で同じ規則にする。
  表の表示（AutoTable の enum の列）も同じ名前にそろえる

### 4.3 確かめること

- `z.enum({ A: 1, B: 2 })` の選択肢が A・B になり、選ぶと 1・2 が書かれる
- 数値の TS enum の選択肢が、名前のキーだけになる（逆引きのキーが出ない）
- `z.enum(["a", "b"])`・`zf.enum` の名前は今のまま

---

## 5. 部品の無い型（#3）

### 5.1 中の型で描く（包む型）

`.readonly()`・`.catch()`・`.nonoptional()`・`.prefault()` を、optional・default と同じく、包みを外して中を描く基本の部品にする（mantine-lite の `baseComponents`）。

- `.readonly()`：中をそのまま描く（readOnly の表示にはしない。zod の readonly は値を凍らせるだけで、入力の可否ではないため）
- `.catch()`：中をそのまま描く。検証は zod に任せる（送信では parse が catch の値に置き換える）
- `.nonoptional()`：中を必須として描く（外側の optional を打ち消す）
- `.prefault()`：中をそのまま描く。`getDefaultValue` に prefault の処理を足し、値が無ければ prefault の値（関数なら呼んだ結果）を入れる

### 5.2 欄を出さず、値を保つ

`z.any()`・`z.unknown()`・zf の型でない `z.custom()`・`z.symbol()`・`z.function()`・`z.never()`。

- 欄は出さない。値はそのまま保ち、そのまま送る
- 値が無いなど、その欄にエラーがあれば、エラーだけを出す（固定値と同じ）
- 部品は固定値の共通の部品と同じ作りにする（既定で出さない・エラーがあれば出す）。`hidden: false` でも中身は出さない
- `getDefaultValue` は値を入れない
- 形だけを確かめたい値（then を持つかなど）は、`z.custom` で書けばここに入る

### 5.3 固定値として扱う：`z.nan()`

- 値が NaN の 1 つに決まるので、値が 1 つの literal と同じ固定値の部品で扱う（既定で出さない。`hidden: false` なら「NaN」と出す）
- `getDefaultValue` に `z.nan()` の処理を足し、NaN を入れる（`z.literal(NaN)` は今も入る）
- 値の比べ方：`isEqualValue`・TanStack Form の比較は `Object.is` なので、NaN 同士は等しい。変えない
- literal の union の選択肢は値を `===` で探しているので、`Object.is` に変える（NaN の腕を選べるようにする）
- NaN は JSON にすると null になる（サーバーへの送信・DynamoDB の保存で NaN のまま届かない）ことを、ドキュメントに書く

### 5.4 文字列の欄で描く：`z.templateLiteral()`

- 文字列の入力欄で描く。形は zod の検証で確かめる
- meta・uiType は `zf.string` と同じものを受けない（必要になったら別に考える）

### 5.5 `z.promise()` と非同期の検証

zod 4 の `z.promise()` は、値を `Promise.resolve(value).then(中の schema で検証)` とするので、検証の結果が必ず Promise になる。
同期の `safeParse` は、Promise が返った時点で例外を投げて検証全体を打ち切る（`.refine(async …)` も同じ）。
そのため今は、ほかの欄の検証結果も返らず、送信の処理が例外で終わり、押しても何も起きないように見える。

- `FormRuntime` の検証（`validate`・包んだ validator）と `parse` で、この例外を握る。`console.error` を出し、
  「このフォームでは非同期の検証を扱えない」ことを、送信が止まった理由として出す（送信はできない）
- `z.promise()` の欄には、扱えない注記を出す。形だけを確かめるなら `z.custom` を使う、と書き添える
- 非同期の検証への対応は、このプランでは扱わない（§1.1）

### 5.6 部品を作る

- `z.file()`：File を値に持つファイルの入力欄（Mantine の `FileInput`）。`.mime()`・`.max()` などの検査は zod に任せ、エラーは欄に出す。
  `zf.externalFile`（外に置いたファイルを指す文字列）とは別のもの
- `z.map()`：set と同じく、record の entries の見た目で Map を書く。キーの schema は string・number だけを受け、それ以外は扱えない注記を出す。
  値の欄は TanStack Form のパスで割り当てられないので、set と同じく欄を 1 つにし、エラーはすべてこの欄に出す

### 5.7 共通の扱い

どの部品にも当たらないときの「Component not found」（英語の固定の文）を、辞書の文言の「扱えない」注記（`UnsupportedNotice`）と
`console.error`（型の名前を入れる）に置き換える。`z.success()` などのドキュメントに無い型も、ここで扱う。

---

## 6. optional の付かない再帰を止める（#4）

### 6.1 方針

lazy の部品（mantine-lite の `baseComponents/lazy.tsx`）が、自分より上にある lazy の数を React の context で数え、入れ子が上限を超えたら止める。
schema が同じかどうかは見ない（同じ schema かどうかの判定は zod の内部の動きに頼ることになり危ういため、入れない）。

- 既定の上限は 10
- `z.lazy` の meta の `maxDepth`（`.register(zf.common.registry, { maxDepth: 30 })`）で、その lazy から下の上限を変えられる。
  `zf.common.registry` の meta に `maxDepth` を足す
- 関数の中で決まった階層で止まる書き方は、上限より前に終わるので、止めずに描ける

止めた所には、扱えない注記（`maxDepth` で上限を変えられることも書く）を出し、`console.error` も出す。その先の値は消さず、そのまま送る。

### 6.2 確かめること

- `const node = z.lazy(() => z.object({ child: node }))` が、上限で止まり、注記が出る
- `const node = () => z.object({ child: z.lazy(() => node()) })` が、上限で止まる
- 値で入れ子になったデータ（optional な再帰の木）が、上限までは今までどおり描ける
- `maxDepth` で上限を変えられる

---

## 7. テスト

- 各項目を zod-form-mantine の spec（jsdom）で、描画・入力・送信まで確かめる。`z.*` と `zf.*` の両方で確かめる
- `getDefaultValue` の変更（prefault・NaN）は zod-form の spec で確かめる
- `FormRuntime` の例外を握る所は zod-form-react の spec と、zod-form-widget の AutoForm の spec で確かめる
- enum・computed の型は `expectTypeOf` で確かめる
- form-demo の「zod の型をそのまま使う」デモに、file・map・readonly・数値の enum・再帰の上限の例を足す
- 最後に `pnpm build`・`pnpm check-types`・`pnpm lint`・`pnpm test`・form-demo の E2E を通す

## 8. 決めたこと

- enum：object の形で書いた enum は、label が無ければキーを名前にする。検証を通らない値は選択肢から外す
- 再帰：深さの上限（既定 10、meta の `maxDepth` で変える）だけで止める。同じ schema の検出はしない
- `zf.computed()`：初めから optional を含める
- `z.nan()`：固定値として扱う
- `z.symbol()`・`z.function()`：欄を出さず、値を保つ
- `z.promise()`・async の refine：例外を握り、送信が止まった理由として出す。非同期の検証への対応は別にする
- `z.success()`：個別の対応はしない
