# zf.union：選んだ腕を表示し続け、腕のエラーを正しい欄に出す

今の仕様は [zf.union](../../packages/zod-form-mantine/docs/union.ja.md)、[欄のエラーの受け渡し](../../packages/zod-form-react/docs/errors.ja.md)、zod-form-react の README の「部品の props」にあります。

## 目的

discriminator の無い `zf.union` で、腕を選ぶとセレクトが空欄に戻り、腕の欄が出てこなかった。どの腕を表示するかを、今の値がどの腕に通るかだけで決めていたので、選んだ直後の（まだ検証に通らない）値では、どの腕も選ばれなかった。あわせて、腕の欄のエラーが出ない、× で空に戻せない、nullable の union が null に戻らない、など、腕のエラーと空の値に関わる不具合をまとめて直す。

## 決めたこと

- **利用者が選んだ腕を覚えておく。** 値が外から変わったときだけ値から腕を決め直す。どの腕にも通らない保存値は、literal の欄で腕を推定する（途中まで入力して保存したデータを開き直したとき、腕が空欄にならないように）
- **腕の切り替えでは検証しない。** 切り替えた直後に、まだ触っていない欄が赤くならないようにするため（discriminatedUnion と同じ）
- **zod の issue を作り直さずにまるごと残す。** `FormRuntime.validate` が issue を `{ message, path, code }` に詰め直していたので、`invalid_union` の中の腕ごとの issue が落ち、union が腕のエラーを取り出せなかった
- **腕のエラーは、同じ欄の errorMap の `onDynamic` に、書いた union の目印（`writtenBy`）を付けて足す。** ほかの枠（onChange・onBlur・onSubmit・onMount）は、AutoForm や TanStack が上書きしたり消したりするため。目印で、同じ欄に重なった union が自分の書いたものだけを片付けられる
- **腕が未選択で検証に落ちていれば、セレクトに「選択してください」を出す。** `invalid_union` の文言は空で、選んだ腕も無いので、どこにもエラーが出ずに送信だけが止まっていた
- **部品の props の `required` を `optional` に裏返し、`nullable` を足す。** 空にするときの値（optional なら `undefined`、nullable だけなら `null`）を部品が決められるようにするため。この値は `emptyValueOf` として全部の部品で使い、nullable だけの欄を空にしたら `null` を書くようにした（破壊的変更）

## 採らなかった案

- **腕のエラーを、React の context で腕の欄に渡す。** errorMap に足す案と並べて実験し、errorMap に足す形を選んだ
- **切り替えのあとに、フォームの検証を走らせ直す（`form.validate("change")`）。** 新しい値の `invalid_union` がフォーム全体の onChange に入り、送信が止まったままで、切り替えた直後に欄のエラーも出てしまうため。フォーム全体のエラーを消す形にした
