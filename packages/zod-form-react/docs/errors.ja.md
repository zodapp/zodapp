# 欄のエラーの受け渡し

[English](errors.md)

1 つの欄（path）に、いくつもの部品が重なることがあります。optional・nullable・default などの包み、intersection の両側、union の腕は、どれも同じ path に描かれます。この文書は、同じ欄のエラーを、どの部品が出すかの決まりです。

## 検証の結果を残す

`FormRuntime.validate` は、zod の issue を作り直さずにまるごと残し、一番外の issue の path にだけ前置きを付けます（`{ ...issue, path: [前置き, ...issue.path] }`）。`invalid_union` の `errors` の中の path は、その union の値からの相対のまま残し、union の部品が自分の欄から絶対の path に直します。dynamic の「読み込み中」「取得できませんでした」の issue は、別に作ります。評価のために dynamic の所に差し込む目印を弾いた issue は、`invalid_union` の腕の中も含めて捨てます（[dynamic.ja.md](dynamic.ja.md) の「検証と送信する値」）。

## issue の 3 つの種類

| 種類                   | 何か                                                 | 出す部品                                         |
| ---------------------- | ---------------------------------------------------- | ------------------------------------------------ |
| 読み込み中             | dynamic の読み込み中の issue                         | どの部品も出さない                               |
| union が解釈する issue | `invalid_union` と、union の腕の `unrecognized_keys` | union が読み、腕に配るか、腕を選ぶ欄の文言にする |
| それ以外               | ふつうの issue（`writtenBy` 付きのものを含む）       | その path のいちばん外側の部品                   |

表示の共通関数（`wrapComponent` と、配列の欄の `useArrayField`）は、部品に渡すエラーを `isDisplayedIssue` で選びます。

```ts
const isDisplayedIssue = (issue, { hideError, errorToken }) =>
  !isPendingIssue(issue) &&
  !isUnionIssue(issue) &&
  !(errorToken && isUnrecognizedKeysIssue(issue) && !issue.writtenBy) &&
  !hideError;
```

## `hideError`

`ZodFormProps` の `hideError?: boolean` は、「この部品の path のエラーは祖先が出すので、出さない」という意味です。intersection は子に `hideError={true}` を渡し、自分の入れ物で 1 回だけ出します。

- 同じ path に描く包み（optional・nullable・default・pipe・lazy・dynamic・externalKey・preprocess）は `{...props}` で子に渡すので届きます。path が変わる部品（object・record・tuple・array）は子の props を 1 つずつ書くので届きません
- union は受け取った `hideError` を腕に渡します。union は「それ以外」の issue を表示しないので、外側の役を取りません
- 入れ子の intersection では、いちばん外の intersection だけが出します

## `errorToken` と `writtenBy`

`ZodFormProps` の `errorToken?: object` は、同じ欄で、すぐ外側の union の目印（union が部品ごとに持つ ref）です。union は腕の `Switch`（と Suspense の fallback）に `errorToken` を渡します。同じ path の包みは `{...props}` で渡すので届き、path が変わる部品には渡りません。

union は、腕そのもの（path が union の欄）の issue を、`writtenBy: 自分の目印` を付けて同じ欄に足します。`errorToken` の使い道は 2 つです。

1. 入れ子の union が `invalid_union` を読み分ける：`errorToken` があれば `writtenBy === errorToken` のもの、無ければ `writtenBy` の無いものを読みます
2. 表示の共通関数が、部品が union の腕かを知る：union の腕には、`writtenBy` の無い `unrecognized_keys` を渡しません（union が腕を選ぶ欄の文言にするため）

## union の腕のエラーの置き場所

union が腕に配るエラーは、欄の errorMap の `onDynamic` に書きます。書くときは今の値を読み、自分の分だけを入れ替え、ほかの union の分は残します。

`onDynamic` を使うのは、ほかの枠が使えないためです。onChange・onBlur・onSubmit は AutoForm の検証が上書きし、`wrapComponent` は値の変更で onBlur を消します。onMount は値を書くたびに TanStack が消します。onDynamic は、既定の検証の流れ（`defaultValidationLogic`）では TanStack が読みも書きもしません。`revalidateLogic` や欄ごとの `validators.onDynamic` を使うフォームでは、この枠がぶつかることがあります。
