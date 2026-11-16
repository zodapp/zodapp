# UI 文言を差し替え可能にする（i18n-messages）プラン

- ステータス: プラン（未実装）
- 対象ブランチ: `claude/project-thread-fmjain`（main から。このプランと同じブランチに実装を積む）
- 対象パッケージ: 新設 4 個（`@zodapp/i18n-messages`、`@zodapp/i18n-messages-react`、`@zodapp/i18n-messages-zod`、`@zodapp/eslint-plugin-i18n-messages`）と、文言を持つ既存 4 個（zod-form-react、zod-form-mantine、zod-form-mantine-lite、zod-form-widget）、apps 3 個（form-demo、survey、taskmanager）
- 範囲: 仕組みの新設と、既存 4 個の日本語固定の文言・ロケールをすべて置き換えること。apps は動き続けるようにし、言語の切り替えで確かめられるようにする（最小限）。zod-form-widget の公開準備とは別の PR にする

---

## 1. 決まったこと

| 項目 | 決定 |
| --- | --- |
| 仕組みの置き場所 | zod-form から独立した i18n のパッケージとして新設する。React 依存は別パッケージ（リポジトリの `zod-form` / `zod-form-react` と同じ分け方） |
| パッケージ名 | `@zodapp/i18n-messages`（本体）、`@zodapp/i18n-messages-react`、`@zodapp/i18n-messages-zod`、`@zodapp/eslint-plugin-i18n-messages` |
| 外部ライブラリ | i18next や react-intl には依存しない。相互運用は `messagesFromTranslator(t)` 1 つ |
| 辞書の型 | 型を足していく interface `RegisteredMessages`。各パッケージが module augmentation で自分の名前空間を足す（`Registered*` 系と同じやり方） |
| キー | `.` 区切りの平らな文字列で、名前空間付き。公開 API として固定する |
| 辞書 | ja と en を TS で各パッケージから export する。利用者は一部だけ上書きできる |
| 差し込む値 | 名前付きのオブジェクトを受け取る関数（`({ count }) => …`） |
| 優先順位 | props で個別に渡された値（`selectorLabel`、`submitLabel` など）> Provider の辞書 > パッケージの既定（en） |
| Provider が無いときの言語 | en |
| Provider | 専用の `I18nMessagesProvider`。既存の `ZodFormContextProvider` には足さない |
| ロケール | Provider に `locale` を持たせ、dayjs・`toLocaleString`・`localeCompare`・月表示の書式もそこから取る |
| throw している文言 | コード付きのエラーにし、表示するときに辞書で訳す |
| 開発者向けの文言 | 辞書に入れず英語にする |
| エラーの文言 | `key?a=1&b=2`（URLSearchParams の書式）の文字列にし、**表示するときに message を辞書で引く**。キーでなければそのまま出す。経路を問わない |
| params の型 | `Record<string, string>`。数値・日付への変換は訳の関数が行う |
| zod 既定のエラー | エラーマップでこちらが決めた `zod.*` のキーと params に変換する。zod の issue の形に依存するのはこのマップの中だけ |
| 既存の `jaErrorMap` | `@zodapp/i18n-messages-zod` の ja 辞書に置き換え、`@zodapp/zod-form-widget/i18n/ja` は削除する |
| 識別子 | `RegisteredMessages`、`defineMessages`、`msgKey`、`resolveMsg`、`messagesFromTranslator`、`I18nMessagesProvider`、`useMsg`、`useLocale`、`createUseMsg`、`zodMsgKeyErrorMap` |
| meta の文言 | `label`・`description`・`placeholder`・enum の選択肢のラベルも `msg.resolve` に通す。キーなら訳し、普通の文字列ならそのまま |
| サーバー | 想定しない。サーバーのエラーは zod 既定の英語のままでよい |
| apps | 最小限（10 章の (A)）。アプリ自身の文言の多言語化（(B)）はいずれ必要だが、この作業の後に別に行う |
| 呼び出し側の読みやすさ | キーの直後のブロックコメントに基準の言語の文言を書く（`msg("k" /* 送信 */)`）。ESLint で辞書と突き合わせ、`--fix` で書き込む。実行時のコストはゼロ |

---

## 2. 現状

main（ab9ae5c）でテストとコメントを除いて数えたもの。

- **zod-form-react**（5 か所）: `mediaResolvers/audio.tsx`・`video.tsx` の「お使いのブラウザは…」、`common/schemaRegistry.ts` の issue の message「読み込み中」「取得できませんでした」、`common/dynamic.tsx` の開発者向けのエラー
- **zod-form-mantine**（約 31 か所、15 ファイル）: `record_entries.tsx`（7）、`enum.tsx`（「（不正な値）」「選択肢に無い値です…」「選択肢がありません」）、`file.tsx`、`dynamic.tsx`（「取得できませんでした」「再試行」「読み込み中」）、`union.tsx` の「タイプ」、`boolean_select.tsx` の「はい／いいえ」、`time.tsx` の形式のエラー、`object.tsx` の aria-label など
  - ロケール: `components/date.tsx` に `import "dayjs/locale/ja.js"`、`locale: "ja"`、`monthLabelFormat: "YYYY年M月"`
- **zod-form-mantine-lite**（約 9 か所、7 ファイル）: `badgeSelect.tsx`（「クリア」「見つかりません」）、`valueAction.tsx`・`renderComputedValue.tsx`・`reactiveComponents/externalKey.tsx` の「…を開く」、`tableComponents/boolean.tsx`、`tableComponents/dynamic.tsx`、`mediaResolvers/generic.tsx`
  - ロケール: `reactiveComponents/date.tsx` に `dayjs/locale/ja` と `locale="ja"`、`tableComponents/date.tsx` に `toLocaleString("ja-JP")`
- **zod-form-widget**（約 136 か所、10 ファイル）: `TableSettingDrawer.tsx`（28）、`ImportModal.tsx`（19）、`DynamicImportModal.tsx`（14）、`FetchMore.tsx`（11）、`AutoForm.tsx`（8）、`ExportModal.tsx`（8）、`DeleteModal.tsx`（5）、`dynamicTabular.ts` の throw（3）、`useAutoTableScroll.tsx`（2）、`AutoTable.tsx`（1）
  - ロケール: `AutoTable.tsx` の `localeCompare(…, "ja")`
  - `src/i18n/ja.ts`: zod の `jaErrorMap`（`./i18n/ja` で公開。import しただけでは何も変わらず、利用者が `z.config` に渡す）
- フォームの検証は `FormRuntime.wrapValidator`（zod-form-react）が `safeParse` している。AutoForm はこれを使う。AutoSearch は schema をそのまま validators に渡している。

全パッケージ `0.0.0` で npm には未公開なので、既定の言語を en に変えても外の利用者への影響はない。

---

## 3. パッケージの構成と依存

| パッケージ | 中身 | 依存 |
| --- | --- | --- |
| `@zodapp/i18n-messages` | `RegisteredMessages`、`defineMessages`、`msgKey`、`parseMsgKey`、`resolveMsg`、`messagesFromTranslator`、型 | なし |
| `@zodapp/i18n-messages-react` | `I18nMessagesProvider`、`useMsg`、`createUseMsg`、`useLocale` | 本体、react（peer） |
| `@zodapp/i18n-messages-zod` | `zodMsgKeyErrorMap`、`zod.*` の型と ja/en 辞書（`/messages` サブパス） | 本体、zod（peer） |
| `@zodapp/eslint-plugin-i18n-messages` | ルール `comment` | eslint（peer）、`@typescript-eslint/parser`（辞書の解析用） |

既存パッケージの依存の向き:

- zod-form-react → i18n-messages、i18n-messages-react、i18n-messages-zod（parse ごとにエラーマップを渡すため）
- zod-form-mantine、zod-form-mantine-lite、zod-form-widget → i18n-messages（辞書の定義）、i18n-messages-react（使う）

i18n-messages-zod から zod-form 系への逆向きの依存（意味の上でも）は無い。確かめたこと:

- zod-form 系（zod-form、zod-form-react、mantine、s3、zod-extendable）は独自の issue（`refine`・`addIssue`・独自の code）を出さない。`z.custom` は型付けにだけ使っている。マップが知るのは zod 本体の issue だけ。
- 今の `jaErrorMap` もこの辞書も、欄のラベルや path を使わない。
- zod-form-react 自身の issue（「読み込み中」「取得できませんでした」）は zod-form-react の辞書（`zodFormReact.*`）に置く。
- `zod.required`（input が `undefined`/`null`）は、フォームでは mantine の部品が空の入力を `undefined` にするので空欄に当たる。ただし意味は「値が無い」という zod の水準のもので、フォームの外でも成り立つ。
- 将来、文言に欄のラベルを入れたくなったら（「{label}は必須です」）、zod-form-react が表示するときに params に `label` を足して resolve する。-zod の側は変わらない。

ほかの公開パッケージと同じく tsup で ESM・CJS・型を出し、changesets の `fixed` に加える。

---

## 4. 本体（`@zodapp/i18n-messages`）

### 4.1 型

```ts
/** 各パッケージが module augmentation で足していく */
export interface RegisteredMessages {}

export type MessageKey = keyof RegisteredMessages & string;
export type MessageValue = string | ((params: any) => string);
export type Messages = Partial<{ [K in MessageKey]: RegisteredMessages[K] }>;
```

各パッケージ側:

```ts
declare module "@zodapp/i18n-messages" {
  interface RegisteredMessages {
    "zodFormWidget.import.title": string;
    "zodFormWidget.import.rowCount": (p: { count: number }) => string;
  }
}
```

- `msgKey` 経由（文字列を経由する）で使うキーは、params を `Record<string, string>` の部分型で受け取るように宣言する（例：`(p: { length: string }) => string`）。
- UI から直接呼ぶキーは、number などをそのまま受け取ってよい（文字列を経由しないため）。

### 4.2 `defineMessages`

```ts
export const defineMessages = <T extends Messages>(messages: T): T => messages;
```

型を確かめ、params の型を推論させるだけで、中身はそのまま返す。

### 4.3 `msgKey` / `parseMsgKey`

```ts
msgKey("myapp.nameTooShort", { length: 3 }) // → "myapp.nameTooShort?length=3"
parseMsgKey("myapp.nameTooShort?length=3")  // → { key: "myapp.nameTooShort", params: { length: "3" } }
```

- 書式は `key` または `key?` + `URLSearchParams` の文字列。
- params の値は `string | number | boolean | Date` を受け取り、`String()`（Date は ISO 文字列）で詰める。
- キーは `[A-Za-z0-9_.-]+` に限る。`?` より前がこの形でなければ、キーではない（普通の文章）とみなす。

### 4.4 `resolveMsg`

```ts
resolveMsg(messages, "myapp.nameTooShort?length=3") // 辞書にあれば訳す
resolveMsg(messages, "3文字以上で入力")              // キーでなければそのまま返す
```

- 辞書に無いキーも、そのまま返す（文字列全体）。
- 値が string なら、そのまま返す。関数なら params を渡して呼ぶ。

### 4.5 `messagesFromTranslator`

```ts
messagesFromTranslator(i18n.t, { keys?: MessageKey[] })
```

- 辞書と同じ形の Proxy を返す。キーを引かれたら `t(key, params)` を呼ぶ関数を返す。
- 訳が無いときの判定（i18next はキーをそのまま返す）は、`t` の戻り値がキーと同じならパッケージの既定に落とす。

---

## 5. React（`@zodapp/i18n-messages-react`）

```tsx
<I18nMessagesProvider
  locale="ja"
  messages={{ ...formMantineJa, ...widgetJa, "zodFormWidget.import.title": "取込" }}
>
```

- `messages` は、入れ子の Provider では親の辞書にマージする（子が優先）。`locale` は子の指定で置き換える。
- Provider が無いときは `locale: "en"`、辞書は空。

### 5.1 `createUseMsg` / `useMsg`

各パッケージは自分の en 辞書を既定にした hook を作る。Provider の外でも en で出せるようにするため。

```ts
// zod-form-widget/src/messages/useMsg.ts
export const useMsg = createUseMsg(en);
```

```tsx
const msg = useMsg();
msg("zodFormWidget.import.title" /* データインポート */);
msg("zodFormWidget.import.rowCount" /* ${count} 件を取り込み予定 */, { count });
msg.resolve(error.message); // キーなら訳し、キーでなければそのまま
```

- 引く順は、Provider の辞書 → `createUseMsg` に渡した既定の辞書 → キーそのもの。
- params が要るかどうかは型で決める（関数の項目は params が必須、文字列の項目は渡せない）。
- `@zodapp/i18n-messages-react` からも、既定の辞書なしの `useMsg` を export する（アプリが自分のキーに使う）。

### 5.2 `useLocale`

`I18nMessagesProvider` の `locale`（BCP 47 の文字列）を返す。日付や並べ替えの部品が使う。

---

## 6. エラーの文言

### 6.1 書き方

```ts
name: z.string().min(3, msgKey("myapp.nameTooShort" /* {length}文字以上で入力 */, { length: 3 }))
```

- スキーマに直接書いた文言は zod で最優先なので、キーの文字列がそのまま issue の message になる。
- 生の文字列を書けば、そのまま表示される。

### 6.2 zod 既定のエラー（`@zodapp/i18n-messages-zod`）

`zodMsgKeyErrorMap` は確定前の issue（`input` を持つ）を受け取り、`zod.*` のキーと params にして `msgKey` で詰める。

| zod の issue | キー | params |
| --- | --- | --- |
| `invalid_type`・`invalid_value` で input が `undefined`/`null` | `zod.required` | なし |
| `invalid_type` | `zod.invalidType` | `expected`、`received` |
| `invalid_value` | `zod.invalidValue` | `values` |
| `too_small` | `zod.tooSmall.{string,number,bigint,array,set,file,date}` | `minimum`、`inclusive` |
| `too_big` | `zod.tooBig.{…}` | `maximum`、`inclusive` |
| `invalid_format` | `zod.invalidFormat.{email,url,uuid,datetime,date,time,regex,startsWith,endsWith,includes,other}` | `format`、`pattern`・`prefix` など |
| `not_multiple_of` | `zod.notMultipleOf` | `divisor` |
| `unrecognized_keys` | `zod.unrecognizedKeys` | `keys`（`, ` 区切り） |
| `invalid_key`・`invalid_element`・`invalid_union`・`custom` ほか | `zod.invalidKey`・`zod.invalidElement`・`zod.invalid` | なし |

- 日付の `minimum`/`maximum` は ISO 文字列で詰める。
- ja 辞書の文言は、今の `jaErrorMap` の文言を引き継ぐ。en 辞書は新しく書く。
- zod の形が変わったときに直すのはこのマップだけで、キーと params（公開 API）は変えない。

### 6.3 どこで渡すか

- **フォーム**: `FormRuntime.wrapValidator` の `safeParse` に `{ error: zodMsgKeyErrorMap }` を渡す。AutoSearch も wrapValidator を通すように変える。利用者の操作は要らない。
- **サーバー**: 想定しない。サーバーのエラーは zod 既定の英語のままでよい。スキーマに `msgKey` で書いた文言は、サーバーで検証してもキーのまま返るので、クライアントで表示すれば訳される。-zod はどこでも使えるが、文書では勧めない。
- エラーマップを渡していない経路では、zod 既定の英語がそのまま出る（キーではないので resolve でもそのまま）。

### 6.4 表示する側

zod-form-react の `wrapComponent` で、部品に渡す `error.message` を `msg.resolve` に通す。部品の側では何もしない。

### 6.5 meta の文言

スキーマの meta の `label`・`description`・`placeholder`、enum の選択肢のラベルも `msg.resolve` に通す。

```ts
z.string().register(zf.string.registry, { label: "myapp.phone" /* 電話番号 */ })
```

- キーなら訳し、普通の文字列ならそのまま出すので、今のスキーマはそのまま動く。
- 通す場所は、meta を読む共通の箇所（zod-form-react の `wrapComponent`、mantine-lite の表の見出しなど）に寄せ、部品ごとに書かない。実装のときに箇所を洗い出す。
- ESLint のルールは、`callees` の呼び出しだけでなく、`label`・`description`・`placeholder` のプロパティの値がキーの形の文字列リテラルのときも対象にする（オプション `properties`、既定 `["label", "description", "placeholder"]`）。
`schemaRegistry.ts` の「読み込み中」「取得できませんでした」も、`zodFormReact.dynamic.loading` などのキーにする。

---

## 7. ロケール

| 場所 | 変更 |
| --- | --- |
| zod-form-mantine・mantine-lite の date | `locale` を `useLocale()` から取る。`monthLabelFormat` は辞書のキーにする（`zodFormMantine.date.monthLabelFormat`）。 |
| `dayjs/locale/ja` の import | 部品からは外し、ja の辞書のモジュール（`@zodapp/zod-form-mantine/messages` の `ja`）で import する。そのファイルを `sideEffects` に加える |
| mantine-lite の `toLocaleString("ja-JP")` | `useLocale()` の値を渡す |
| widget の `localeCompare(…, "ja")` | `useLocale()` の値を渡す |

---

## 8. 既存パッケージの移行

### 8.1 キーの名前空間

パッケージ名のキャメルケースにする: `zodFormReact.*`、`zodFormMantine.*`、`zodFormMantineLite.*`、`zodFormWidget.*`。その下は部品名で区切る（例：`zodFormWidget.tableSetting.saveAs`）。

### 8.2 辞書の公開

各パッケージに `src/messages/`（`types.ts`、`ja.ts`、`en.ts`、`useMsg.ts`）を置き、`./messages` のサブパスで `ja` と `en` を export する。

### 8.3 props の既定値

`submitLabel = "保存"` のような既定値はやめて、`submitLabel ?? msg("zodFormWidget.autoForm.submit" /* 保存 */)` にする（props が辞書より優先）。

### 8.4 throw している文言

`dynamicTabular.ts` の 3 か所は `TabularImportError`（`code: "emptyFile" | "noHeader" | "noRows"`）を throw し、ImportModal・DynamicImportModal でコードから訳す。`e.message` を表示している他の箇所（`解析エラー: ${e.message}` など）は、プレフィックスを辞書にして、`e.message` は `msg.resolve` に通す。

### 8.5 開発者向けの文言

`array_table.tsx` の「table 表示は object 配列のみ対応しています。」、`dynamic.tsx` の throw、`extendSchema.ts` のエラーは英語にする。

### 8.6 apps

10 章。

---

## 9. ESLint（`@zodapp/eslint-plugin-i18n-messages`）

### 9.1 ルール `@zodapp/i18n-messages/comment`

```ts
msg("zodFormWidget.import.title" /* データインポート */)
msgKey("myapp.nameTooShort" /* {length}文字以上で入力 */, { length: 3 })
```

- 対象: `callees`（既定 `["msg", "msgKey"]`）の呼び出しで、第 1 引数が文字列リテラルのもの。名前だけで絞る（別名の import は拾わない）。
- コメント: キーの直後（カンマの前）の **1 つのブロックコメント**だけを見る。
  - 無い・食い違う → 警告。`--fix` で辞書の文言を書き込む。
  - 2 つ以上ある、またはコメントの中に改行がある → 警告。`--fix` で 1 つにまとめる。
- 書き込む文言（基準の言語の辞書の項目のソースから作る。辞書は実行しない）:
  - 文字列リテラル → その値
  - 本体がテンプレートリテラルだけの関数 → テンプレートの中身（`${count} 件を取り込み予定`）
  - それ以外 → 本体のソースそのまま
- エスケープ: `\n`（改行）、`\\`、`*\/`（`*/`）。ほかの `\x` はエラー。
- 突き合わせ: エスケープを戻し、空白の連続を 1 つにまとめ、前後を取り除いてから比べる。
- 辞書に無いキー → 警告（`--fix` はしない）。

### 9.2 オプション

```js
{
  callees: ["msg", "msgKey"],
  referenceLocale: "ja",
  dictionaries: {
    "zodFormWidget.": "packages/zod-form-widget/src/messages/ja.ts",
    "myapp.": "src/messages/ja.ts",
  },
}
```

- 名前空間（前方一致）ごとに辞書ファイルを対応づけ、出てきた名前空間の辞書だけを読む。
- 基準の言語の辞書は、静的なオブジェクトリテラル（`defineMessages({ … })` か `export const ja = { … }`）で書く。スプレッドや計算したキーは追えないので使わない。

### 9.3 性能

- 見るのは CallExpression だけで、型情報（parserServices）は使わない。
- 辞書はモジュールのスコープで構文木を作ってキャッシュし、各ファイルの最初に `statSync` で mtime を見て、変わっていれば読み直す（エディタの ESLint サーバーのように長く動くプロセスのため）。

### 9.4 リポジトリでの使用

`@repo/eslint-config` に加え、zod-form-react・mantine・mantine-lite・widget で有効にする。基準の言語は ja。

---

## 10. apps（最小限）

3 つとも `zod-errormap.ja.ts` で `jaErrorMap` を `z.config` に渡しているので、手を入れないと壊れる。アプリ自身の日本語の文言は form-demo 約 590 行、survey 約 320 行、taskmanager 約 260 行で、半分以上がスキーマの meta。

### (A) この作業でやること

- 3 つとも、ルートを `I18nMessagesProvider` で包み、各パッケージ（zod-form-react、mantine、mantine-lite、widget、i18n-messages-zod）の ja・en を渡す。
- `zod-errormap.ja.ts` と、それを import している箇所を消す。
- ヘッダーに ja / en の切り替えを付ける。選んだ言語は localStorage に保存し、既定は ja。切り替えると、ライブラリの文言・zod のエラー・日付の表示が変わる。アプリ自身の文言は日本語のまま。
- form-demo に、meta の文言をキーで書いた多言語化のデモページを 1 つ足し、ラベル・説明・選択肢・`msgKey` のエラーの切り替えを確かめられるようにする。そのページのキー（`formDemo.*`）の ja・en 辞書を form-demo に置き、ESLint のルールも form-demo で有効にする。

### (B) 後でやること（この作業の範囲外）

アプリ自身の文言とスキーマのラベルをすべてキーにし、ja・en の辞書を書く。(A) で仕組みが動くことを確かめてから行う。survey のアンケートの中身は利用者が作るデータなので対象外。

### e2e

- 既存の e2e（form-demo、survey）は日本語の文言で要素を探しているので、既定の ja のまま通す。
- form-demo に、en に切り替えてライブラリの文言と zod のエラーが英語になることを確かめる e2e を 1 本足す（多言語化のデモページを使う）。

---

## 11. テスト

- 本体: `msgKey`/`parseMsgKey` の往復（数値・真偽・Date・記号を含む値）、キーでない文字列の判定、`resolveMsg` のフォールバック。
- React: Provider の入れ子のマージ、Provider が無いときの en、`createUseMsg` の既定、props の優先。
- zod: 6.2 の表の各行、スキーマに直接書いた文言がマップより優先されること。
- ESLint: `RuleTester` で、コメント無し・食い違い・複数・改行・エスケープ・テンプレート・分岐する関数・辞書に無いキー。
- 既存パッケージ: 既存のテストの日本語の期待値は、テストで Provider に ja を渡して通す。Provider なしで en が出るテストを部品ごとに 1 つ足す。

---

## 12. CHANGELOG・changeset

- 新設 4 個の追加。
- **破壊的変更**: Provider が無いときの文言が日本語から英語になる。`@zodapp/zod-form-widget/i18n/ja`（`jaErrorMap`）を削除し、`@zodapp/i18n-messages-zod` に置き換える。

---

## 13. 範囲外

- apps のアプリ自身の文言の多言語化（10 章の (B)）。
- サーバーのエラーの多言語化。

- 文言の翻訳の品質の見直し（ja は今の文言を引き継ぐ。en は新しく書く）。
- ja・en 以外の言語。
- 数値の書式（桁区切り）の切り替え。今は数値を書式化している箇所が無い。
