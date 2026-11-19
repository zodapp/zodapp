# 最近の機能のデモと E2E を form-demo に足すプラン

- ステータス: 実装済み
- 対象ブランチ: `claude/project-thread-t5tgbw`
- 対象: `apps/form-demo`（デモ・e2e 用のページ・spec）、`@zodapp/zod-form-mantine-lite` と `@zodapp/zod-form-mantine`（lazy の上限の数え方）

---

## 1. 背景

PR #28〜#34 で入った機能の多くが、form-demo（E2E のベース）で試せない。
`zodBuiltins`（「zod の型をそのまま使う」）は一部の型だけを扱っている。

また、`zodBuiltins` の `outline`（optional な再帰。`maxDepth: 3`）で、4 段目に「これより深い階層は表示できません」の注記が出る。
lazy の上限は「optional の付かない再帰」（関数で深さを決めた再帰など）のための安全装置なのに、実装がルートからの lazy をすべて数えているため。

## 2. 方針

- 利用者が画面で触る UI は、メニューに出るデモに置く
- 利用者が画面で触らない機能（送信値の変換・そのまま送る型・扱えない型の注記など）は、デモを細かく作らず、メニューに出ない e2e 用のページ（`src/pages/form/schemas/e2e/`）と spec だけにする
- e2e 用のページの形は今の `e2e-open-rewrite` と同じ（formId は `e2e-` で始める。`e2eSchemas`・`e2eCodes` に登録する。description に書く手順と spec の手順をそろえる）
- `AGENT.md` の「e2e 用のページ（デモに向かないものだけ）」の説明を、上の方針に合わせて直す
- 機能が古いのに spec の無いページ（basicInput・arrayFields など）は、このプランでは扱わない

## 3. ライブラリ：lazy の上限の数え方

### 3.1 今

`zod-form-mantine-lite/src/baseComponents/lazy.tsx` の `LazyComponent` は、`LazyDepthContext` でルートからの lazy の入れ子を数え、上限（既定 10、lazy の meta の `maxDepth`）を超えたら注記を出す。
間に optional があっても数える。

### 3.2 直したあと

上限で数えるのは、「値が無くても中を描く」所だけで続いている lazy の連なりにする。
値が無ければ中を描かない部品を通ったら、数を 0 に戻す（`maxDepth` は引き継ぐ）。そこから先の描画は値の深さで止まるため。

数を 0 に戻す部品：

- optional（値が無いと ＋ だけを出す）
- nullable
- array（要素の数だけ描く）
- record の entries（`uiType: "entries"`）・Map（組の数だけ描く）
- union・discriminatedUnion（選んだ腕だけ描く）

キーの決まった record（キーごとに必ず欄を出す）・object・intersection・tuple・pipe などは、数を戻さない。

作り：

- `lazy.tsx` から、数を 0 に戻す Provider（`ResetLazyDepth`）を export する
- 上の部品が、中の欄を描く所をそれで包む（mantine-lite と mantine の該当の部品）
- 関数で深さを決めた optional なしの再帰（`const level = (n) => n === 0 ? leaf : z.object({ child: z.lazy(() => level(n - 1)) })`）は、今までどおり数え、上限を超えたら注記を出す

テスト（`zod-form-mantine/src/components/lazy.spec.tsx`）：

- optional な再帰は、`maxDepth` より深い値でも注記を出さずに全部描く
- 配列を通る再帰も同じ
- optional なしの再帰は、今までどおり上限で注記を出し、その先の値を消さない
- 関数で深さを決めた再帰（上限以下）は、全部描く

changeset を足す（patch）。

## 4. デモ（メニューに出すもの）

### 4.1 zf.record のページ（`recordEntries`）に欄を足す

| 欄 | 書き方 | 見せること |
| --- | --- | --- |
| キーが enum | `z.record(zf.enum(["ja", "en"]) に label, z.string())` | 選択肢の label をキー名にして、キーごとの固定の欄で並ぶ |
| キーが複数値の literal | `z.record(z.literal(["small", "large"]), z.number())` | 同じく固定の欄 |
| キーが enum の partialRecord | `z.partialRecord(z.enum([...]), z.string())` | 固定の欄にならず、entries の見た目で組を足す。キーは文字の入力で、enum に無いキーはエラーになり、直すまで値から外す |
| Map | `z.map(z.string(), z.number())` | record の entries と同じ見た目で、Map を書く |

page の説明（description とページ内の説明）に、キーの型で見た目が変わることを書く。

### 4.2 固定値のページを新しく作る（`fixedValues`、カテゴリ Standard）

`hidden: false` を主役にする。

- 同じ形の object を 2 つ、上下に並べる。上は既定（欄を出さない）、下は各欄に `hidden: false`（readOnly と同じ見た目で値を出す。必須の印は付けない）。左右（`uiType: "horizontal"`）は下揃えになり、高さの違う枠どうしで見比べにくいので使わない
- 欄：値が 1 つの literal（文字列 `"article"`・数値 `2`）、`z.null()`、discriminatedUnion の腕の中の discriminator
- `z.null()` は中身が無いので、`hidden: false` でも出さない（ライブラリの仕様）。ページの説明に書く
- どちらも送信値に固定値が入ることを、`E2eHarness` の今の値・送信値で見せる
- ページ内の説明に「固定値は既定で出さない。見せたいときは `hidden: false`」と書く

### 4.3 z.lazy のページ（`recursiveSchema`）に例を足す

- 関数で深さを決めた optional なしの再帰（部 → 課 → 係 の 3 階層。`z.lazy` を使う）を足し、上限の注記なしで全部描けることを見せる

### 4.4 「zod の型をそのまま使う」（`zodBuiltins`）

- `outline` から `maxDepth: 3` を外し、optional な再帰として深く描けるようにする。説明とコメントも直す
- Map とキーの決まった record は残す（zf.record のページを正の置き場にする）

## 5. e2e 用のページ（メニューに出さない）

| formId | 中身 |
| --- | --- |
| `e2e-parsed-submit` | 送信値の変換：`.trim()`・`.default()`・`z.coerce.number()`・`z.stringbool()`・`z.codec()`・`.pipe()`・`.prefault()`・`.catch()`。開いただけでは isDirty にならない |
| `e2e-passthrough` | 欄を出さずにそのまま送る型：`z.any()`・`z.unknown()`・`z.custom()`・`z.symbol()`・`z.function()`・`z.never()`（optional）、固定値の `z.nan()`、文字列の欄になる `z.templateLiteral()`、包みを外す `.nonoptional()` |
| `e2e-unsupported` | 扱えない型の注記：rest 付きの tuple、uiType と要素が合わない配列、object を要素に持つ set、使えないキー名（`"a.b"`）。`z.promise()` と async の refine で送信が止まり、理由が出る |
| `e2e-container-refine` | 入れ物の path を指定しない `.refine()`：object・array・record・union。離すと出て、直すと消えて送り直せる |
| `e2e-lazy-limit` | optional なしの再帰で `maxDepth: 2`。注記が出て、上限の先の値は上の欄を編集しても消えない（終わりの無い型なので、送信は検証で止まる）。optional な再帰は深くても注記が出ない |
| `e2e-misc` | object の形の enum（`z.enum({ Small: "s", Large: "l" })`）、`zf.date` に `z.coerce.date()`、外部キーに `z.email()`（モックの topic に、メールを値に持つ `userEmails` を足す）、値が複数の literal を `multipleEnum` の要素にする |

## 6. spec

- 新しい spec：`record-entries.spec.ts`（4.1）、`fixed-values.spec.ts`（4.2）、e2e 用のページごとに 1 つ（`e2e-parsed-submit.spec.ts` など）
- 足すテスト：`recursive-schema.spec.ts`（4.3）、`zod-builtins.spec.ts`（4.4。今の maxDepth のテストは `e2e-lazy-limit.spec.ts` に移す）
- 値・エラー・送信値は `window.__formDemo`（`e2e/helpers.ts`）で読み、注記・欄の表示・エラーの文言は画面で確かめる
- `all-pages.spec.ts` は登録簿から全ページを開くので、新しいページは自動で入る

### 6.1 主なテスト

- record：キーが enum・literal の record は、キーの label の欄が並び、入力すると値のそのキーに入る。partialRecord はキーを足すと値に入る。Map は書き換えると Map に書く
- 固定値：左は欄が無く、右は readOnly の見た目で値が出る。送信値には両方とも固定値が入る
- 送信値の変換：入力した値と、送信値（parse 後）がそれぞれ期待どおり。開いた直後の isDirty は false
- そのまま送る型：欄が出ない。送信値に初期値がそのまま入る
- 扱えない型：該当の欄の場所に注記が出て、ほかの欄は描かれる。promise・async の refine では送信が止まり、理由が出る
- 入れ物の refine：入れ物の最後の欄を離すとエラーが出る。直すと消え、送信できる
- lazy：optional な再帰（`zodBuiltins` の `outline` を深くしたもの）には注記が出ない。関数で深さを決めた再帰は全部描ける。`maxDepth` を超えた所に注記が出て、フォームの値に先の値が残る

## 7. 確かめること

- `pnpm check-types`・`pnpm lint`・`pnpm build`
- `pnpm --filter @zodapp/zod-form-mantine test`（lazy.spec を含む）
- `pnpm --filter form-demo e2e`

## 8. コミットの分け方（実装のとき）

1. lazy の上限の数え方の修正とテスト、changeset
2. デモ（4.1〜4.4）と、その spec
3. e2e 用のページと spec、`AGENT.md` の説明
