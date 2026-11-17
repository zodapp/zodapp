# zf.dynamic：決まった schema の既定値を、今の値の足りないところに補うプラン

- ステータス: プラン（未実装）
- 対象ブランチ: `claude/union-arm-errors-v2`
- 対象パッケージ: `@zodapp/zod-form`（`getDefaultValue`・`prune.ts`）、`@zodapp/zod-form-react`（`dynamic.tsx`）

---

## 1. 背景

`zf.dynamic` は、実行時に決まる schema で欄を描く。決まった schema の中の `.default()` などの既定値が、フォームの値に入らないことがある。

今の `useDynamicSchema`（`packages/zod-form-react/src/common/dynamic.tsx` の `apply`）は、値を次のように扱う。

| いつ                                                                | 値への処理           |
| ------------------------------------------------------------------- | -------------------- |
| schema が最初に決まったとき                                         | 何もしない           |
| 利用者の編集がきっかけで、別の schema（別の key）に切り替わったとき | `adaptValueToSchema` |
| 利用者の編集以外で切り替わったとき                                  | 何もしない           |

`adaptValueToSchema`（`packages/zod-form/src/utils/prune.ts`）は次の組み合わせになっている。

```ts
fillMissing(pruneValueToSchema(value, schema), getDefaultValue(schema));
```

- `pruneValueToSchema`：新しい schema に合わない値を消す
- `getDefaultValue`：schema だけから初期値の木を作る（今の値は見ない）
- `fillMissing`：今の値に無いキーだけを、初期値の木で埋める（plain object のキーだけを重ねる）

### 1.1 問題

1. **最初に決まったときに補わない。** 新しく開いたフォームでも、保存済みのデータを開いたときでも、決まった schema の `.default()` は値に入らない。
   送信で渡るのはフォームの値そのもの（`AutoForm.tsx` の `onSubmit: ({ value }) => …`）なので、値に入っていない既定値は送信結果にも入らない。
2. **`fillMissing` は、初期値の木と今の値を object のキーだけで重ねるので、次の場合に補えない。**
   - 配列：初期値の木は `[]`（または min の長さの undefined）。今の値の各要素の中の足りないキーは埋まらない
   - record：初期値の木は `{}`。今の値の各値の中は埋まらない
   - union：初期値の木は「undefined に通る最初の腕」で作る。今の値が別の腕だと、違う腕のキーを足すおそれがある

   2 は、利用者が切り替えたときの今の処理（`adaptValueToSchema`）にもある弱点。

externalKey も `useDynamicSchema` を使うが、後から決まるのは選択肢だけで、schema は部品が enum か string として作る。`.default()` が入る余地はないので、このプランでは扱いを変えない（同じ処理を通っても結果は変わらない）。

## 2. 方針

### 2.1 dynamic の規則

**schema が決まったら、値が無いところを既定値で補う。利用者が切り替えたときだけ、合わない値を削る。**

| いつ                                                  | 値への処理（変更後）   |
| ----------------------------------------------------- | ---------------------- |
| schema が最初に決まったとき                           | 補う（削らない）       |
| 利用者の編集がきっかけで、別の key に切り替わったとき | 削ってから補う         |
| 利用者の編集以外で切り替わったとき                    | 何もしない（今のまま） |

- 最初の回に削らないのは、そのときの値が保存済みのデータかもしれないから
- 補うのは値が undefined のところだけ。入っている値は変えない
- 最初の回の書き込みは、今の prune と同じく `dontValidate`・`dontUpdateMeta` で書き、「触った」「変えた」にしない。利用者の編集としても扱わない（`runAsUserEdit` で包まない）
- 補った結果が今の値と同じなら書かない（今の `isEqualValue` の判定を使う）

### 2.2 値を持ったまま schema を歩いて補う

初期値の木を別に作って重ねるのをやめ、今の値を持ったまま schema を歩く。

`getDefaultValue` は中で `preprocess(undefined, schema, …)` を呼んでいる。この最初の引数は「歩く値」で、今の値を渡すと、配列の各要素・record の各値・object の各キーを schema に沿って歩く。各処理は `obj ?? 初期値` の形なので、undefined のところだけが初期値になり、入っている値は変わらない。

そこで、値を受け取れる形にする。

```ts
export const getDefaultValue = (schema: z.ZodTypeAny, value?: unknown) =>
  preprocess(value, schema, …);
```

- `value` を省くと、今と同じ結果（スキーマだけから作る初期値）
- object の処理（undefined になるキーは置かない、ただし optional でないのに undefined を通す子のキーは残す）は、今のまま使える
- nullable の処理は、値があるときは `[z.null(), innerType]` で歩く（今のまま）。null の値は null のまま

名前は `getDefaultValue(schema, value)` の第 2 引数にするか、`fillDefaultValue(value, schema)` のように別の名前で出すかを、実装のときに決める（どちらも中身は同じ）。

### 2.3 union の腕の選び方

値がある union では、zod-transform は「埋めた結果が `safeParse` に通る最初の腕」を選び、どの腕も通らなければ invalid_union のエラーを投げる。必須の欄が空のままの値（入力の途中で保存したデータなど）では、どの腕も通らずにエラーになる。

そこで、`getDefaultValue` の union の処理で、値があるときの腕を次の順で選ぶ。`zf.union` の部品が腕を決める規則（`union-arm-selection.md` の 2）にそろえる。

1. discriminatedUnion なら、discriminator の値が一致する腕
2. 値がそのまま `safeParse` に通る腕があれば、その最初の腕
3. object の腕で、literal の欄の値が一致する腕が 1 つだけなら、その腕
4. 決められなければ、値をそのまま返す（補わない）

腕が決まったら、その腕の schema で歩いて補う。歩いた結果が検証に通るかどうかは問わない（入力の途中のデータを補うのが目的のため）。

### 2.4 `adaptValueToSchema` も同じ補い方にする

```ts
export const adaptValueToSchema = (value, schema) =>
  getDefaultValue(schema, pruneValueToSchema(value, schema));
```

`fillMissing` は使わなくなるので消す（外には出していない）。

## 3. 確かめること

実装のあとに、単体テストと e2e で確かめる。

1. dynamic の最初の回に値を書くと、フォーム全体の `isDefaultValue` が false になり、開いただけで「変更あり」に見えないか。
   見えるなら、最初の回だけは `form.options.defaultValues` の同じ path も補うなどの手当てを検討する
2. `form.reset()` で初期値に戻したあと、補った値が消えたままにならないか（dynamic は schema が同じなので、もう一度は補わない）
3. 配列の要素・record の値・union の腕の中の `.default()` が、最初の回にも切り替えのときにも補われること
4. 入っている値が変わらないこと（保存済みのデータを開いたとき）
5. 腕を決められない union の値が、そのまま残ること
6. 今の e2e（form-demo）がすべて通ること

## 4. このプランで扱わないこと

- **AutoForm がフォームを開くときに補うかどうか。** 今は AutoForm も `useZodForm` も `getDefaultValue` を通しておらず、渡された `defaultValues` をそのまま使う。静的な schema の `.default()` は、呼び出し側が `defaultValues` に入れない限りフォームに入らない。開くときにも `getDefaultValue(schema, defaultValues)` を通せば静的な schema と dynamic が同じ規則になるが、やるかどうかは未決
- **`.prefault()`。** `getDefaultValue` に prefault の処理が無く、`z.number().prefault(3)` の初期値が undefined になる。既存の不具合で、別に直す
