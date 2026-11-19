# ESLint ルール `comment` のキーを文字列の形で見つける（i18n-messages）プラン

- ステータス: 実装中（このブランチ）
- 対象ブランチ: `claude/project-thread-fmjain`（main から作り直す。このプランと同じブランチに実装を積む）
- 対象パッケージ: `@zodapp/eslint-plugin-i18n-messages`、`@repo/eslint-config`。`--fix` でコメントを書き込むファイル（各パッケージ・apps）
- 前提: [i18n-messages](./i18n-messages.md)（PR #30）でルール `comment` を足した

---

## 1. 目的

今のルールは、呼び出す関数の名前が `msg`・`msgKey`（オプション `callees`）のときに、第 1 引数の文字列だけを見ている。次のキーを見逃す。

- キーを受け取って別の関数に渡す関数を挟んだ呼び出し
- 関数の引数ではない場所のキー（`errorMap.ts` が返すタプル `["zod.required", { expected }]` など）
- 呼び出す側が名前でない式（`useMsg()("zodFormMantineLite.unlisted")`）

関数の名前ではなく、文字列の形でキーを見つけるようにする。

## 2. キーの見つけ方

- 対象は、文字列リテラルと、`${}` を含まないテンプレートリテラル
- 値の全体が「`dictionaries` のプレフィックス＋キーの残り（＋ `?params`）」の形に合えば、キーとみなす
  - 残り: `[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*`
  - その後ろ: `(\?.*)?`
- プレフィックスが重なるとき（`zodForm.` と `zodFormMantine.`）は、長い方を使う（今と同じ）
- 呼び出しの中かどうかは見ない

## 3. 見ない場所

- オブジェクトのキー（computed でないもの）。辞書の `"zod.required": …` がこれにあたる
- import・export の `from "…"`（`ImportDeclaration`・`ExportNamedDeclaration`・`ExportAllDeclaration`・`ImportExpression` の source）
- 型の位置の文字列（`TSLiteralType`）

## 4. JSX の属性

`label="zodFormMantine.x"` には後ろにコメントを置けない。報告は今と同じに出し、`--fix` は `label={"zodFormMantine.x" /* 文言 */}` に書き換える。

## 5. オプション

- `callees` を消す（プラグインは未公開なので、残して無視することはしない）
- `dictionaries` のプレフィックスは `^([A-Za-z][A-Za-z0-9]*\.)+$`（ドットで終わる 1 段以上の識別子）に限る。外れたら、ルールの起動時に設定の誤りとして例外を投げる
- 名前は `dictionaries` のまま。`referenceLocale` も今のまま

## 6. 報告と修正

今と同じ（`missing`・`mismatch`・`malformed`・`invalidEscape`・`unknownKey`）。

## 7. リポジトリへの反映

`pnpm lint --fix` でコメントを書き込む。新しく対象になるのは次の 3 種類。

- `errorMap.ts` のタプルのキー
- `useMsg()("…")` のように、名前でない式から呼んでいるもの
- spec の中のキー（`expect(…).toBe("zod.required")` など）。spec にもコメントを付ける

## 8. テスト

RuleTester に足すケース:

- 関数を挟んだ呼び出し、タプル、配列、`useMsg()(...)`、JSX の属性（修正後の形）
- 見ない場所（オブジェクトのキー、import・export、型）
- キーの形に合わない文字列（`"zod.dev/docs"`、末尾がドット、空白を含むもの）
- 不正なプレフィックスでの例外

`callees` のテストは消す。

## 9. ドキュメント

- プラグインの README から `callees` を消し、キーの見つけ方とプレフィックスの決まりを書く
- CHANGELOG（ja・en）の、まだリリースしていない i18n の項目と、`.changeset/i18n-messages.md` の説明を直す。プラグインは未公開なので、破壊的変更としては扱わない

## 10. 限界

`` `zod.${code}` `` のように組み立てたキーは確かめられない。README に書く。

## 11. 進め方

PR #30 はマージ済みなので、ブランチ `claude/project-thread-fmjain` を main から作り直し、新しい PR にする。
