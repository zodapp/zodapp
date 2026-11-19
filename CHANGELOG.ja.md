## 変更履歴（Changelog）

本プロジェクトの主な変更はこのファイルに記録します。

フォーマットは [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) に基づき、
また可能な限り [Semantic Versioning](https://semver.org/spec/v2.0.0.html) に従います。

## 未リリース（Unreleased）

- OSS公開の初期リリース準備
- zod-dynamodb: サーバーのコードが `live` のクエリを購読する `subscribeOnServer` を追加。サーバー専用のクエリ（`authorize` なし）にも `live` を付けられるようにした（Realtime Gateway は公開しない）
- taskmanager: メンバーの変更を revocations として配り、Realtime Gateway が複数の台でも、すべての台で接続の認証コンテキストを作り直すようにした
- zod-transform: intersection で、left 側の変換結果が right 側の素通しした値で上書きされる不具合を修正。あわせて、片側が `$remove` したキーは、もう片側が素通ししただけなら取り除くように変更
- zod-form-widget: AutoForm を `<form>` 要素で包み、入力欄で Enter を押すと送信できるようにした。Enter で押されるのは、最初の `type: "submit"` のアクション（`onSubmit` prop の送信ボタンを含む）で、そのボタンは HTML の `type="submit"` で描く。`custom` のアクションを Enter の対象にするときは、ボタンに `type="submit"` を付ける。**振る舞いの変更**：送信ボタンのある AutoForm では、テキスト欄で Enter を押すと送信されるようになる（テキストエリアは改行のまま）
- zod-form-widget: AutoForm に `actionsPosition`（`"top"` | `"bottom"`、既定は `"top"`）を追加し、ボタンの行を入力欄の下にも置けるようにした
- taskmanager・survey: ログイン・新規登録・確認コード・パスワード再設定の画面で、ボタンを入力欄の下に横幅いっぱいで置くようにした
- zod-form-mantine: `uiType: "badge"` の enum で、選択肢だけでなく選択済みの値もバッジで出すようにした。ドロップダウンを開いている間は文字入力になり（選択済みのラベルを placeholder に出す）、打ち込んだ文字で絞り込む。打ち込んだ文字が選択済みのラベルに足されることもなくなった。読み取り専用表示もバッジにした。`@zodapp/zod-form-mantine-lite/utils` に追加した `BadgeSelect` で組んでいる
- zod-form-mantine: `uiType: "multipleEnumBadge"` で、選択済みの値も × で外せるバッジで出し、読み取り専用表示もバッジにした
- zod-form-mantine: **破壊的変更**：`uiType: "multipleEnumBudge"` を `"multipleEnumBadge"` に改名（旧綴りは認識しない）
- zod-form-mantine-lite: バッジ（enum の選択肢・選択済み・読み取り専用、複数選択、表の computed のバッジ）の文字色を背景色から決めるようにした。濃さ付きのテーマ色（`"blue.6"`）や RGB（`#3b82f6`・`rgb()`・`hsl()`）の指定では、背景をその色そのものにし、文字は同じ色相で背景より暗い色（OKLCH の明るさを 0.45 下げた色）、暗い背景や白の方が見やすい背景では白にする。濃さなしのテーマ色（`"blue"`）は今の Mantine の `light` のまま。`@zodapp/zod-form-mantine-lite/utils` に `ColorBadge`・`computeBadgeColors` を追加
- zod-form-mantine: discriminator のない union（`zf.union`）で、object の腕を選ぶとセレクトが空欄に戻り、腕の欄が出ない不具合を修正。選んだ腕を覚え、値がまだ腕の検証に通らなくてもその腕を出す。値が外から変わり、別の腕にだけ通るようになったらその腕に切り替える。初期値がどの腕にも通らないときは、object の腕の literal の欄（例: `type: "phone"`）が一致する腕を 1 つに絞れればそれを出す。腕の切り替えでは、discriminatedUnion と同じく検証しない
- zod-form-react: **破壊的変更**：`ZodFormProps` の `required?: boolean` を `optional?: boolean` に裏返した（外側の `.optional()`・`.default()` の中で `true`。書かないときは必須）。あわせて `nullable?: boolean` を足し、zod-form-mantine-lite の `NullableComponent` は `optional` ではなく `nullable` を渡すようにした。`useDynamicSchema` の `{ required }` も `{ optional }` にした。自作の部品は `required !== false` を `!(optional || nullable)` に、`required={false}` を `optional={true}` に読み替える
- zod-form-react: `FormRuntime.validate` が zod の issue をまるごと残すようにした（一番外の path にだけ前置きを付け、`invalid_union` の腕ごとの `errors` などはそのまま）。部品の欄のエラー（`wrapComponent`・配列の欄）は `invalid_union` を除いた最初のエラーにした
- zod-form-mantine: discriminator のない union（`zf.union`）のエラーの表示を修正。どの腕にも型が合わない値（数値の腕が空のときなど）のエラーを、選んだ腕の欄に出す（AutoForm では何も出ず、`useZodForm` に schema を直接渡すと描き直しが止まらなくなっていた）。腕のエラーは、`invalid_union` を残したまま同じ欄の errorMap の `onDynamic` に足す。同じ欄に union が重なっても、object の腕の子の欄に union があっても、その union の腕の欄に出す。腕が未選択で検証に落ちているとき（必須の union が空、値がどの腕にも合わない）は、腕を選ぶ欄に「選択してください」を出す
- zod-form-mantine: optional・nullable の `zf.union` で、× を押すと腕を外して空にする。腕を選んだ直後に空なら、空の値を書く。空の値は optional なら `undefined`、nullable だけなら `null`（両方なら `undefined`）
- zod-form-mantine: `zf.union` で腕を選んだ直後の最初の送信が、検証されずに止まる不具合を修正
- zod-form-mantine: `zf.union` の object の腕の子の欄で、型のエラー（空の数値など）を欄を離れずに直しても、エラーが消えない不具合を修正。discriminatedUnion で腕が未選択のとき（必須で値が空）も、腕を選ぶ欄に「選択してください」を出す。入れ子の union が、無い欄（`value.value` など）にエラーを書いていた不具合を修正
- zod-form-mantine: discriminator のない保存値の discriminatedUnion で、エラーが描かれない欄に付いて何も出ずに送信だけが止まっていた不具合を修正。腕を選ぶ欄に「選択してください」を出す
- zod-form-react・zod-form-mantine: **破壊的変更**：nullable だけの欄を空にすると（複数選択の欄も含む）、`undefined` ではなく `null` を書く（「必須」のエラーにならず、空のまま送信できる）。optional の欄（optional と nullable の両方を含む）は今までどおり `undefined`。空の値を決める `emptyValueOf` を zod-form-react から export する。`useDynamicSchema` に `{ nullable }` を足した
- zod-form-mantine-lite: reactive 版の部品で、消した値を `onBlur`・`onConfirm` に渡すとき、空の値（""・null）を欄に合わせて置き換える（optional なら `undefined`、nullable だけなら `null`）。`useConfirmableState` に `emptyValue` のオプションを足した
- zod-form-mantine-lite: reactive 版の日付の欄は、`onBlur`・`onConfirm` にピッカーの文字列ではなく保存の形式（Date・数値・文字列）で渡す。`useConfirmableState` に `toValue` のオプションを足した
- zod-form-mantine: bigint の欄は、先頭の「-」と数字以外の文字を受け付けない
- zod-form: `getDefaultValue` は、optional と nullable の両方が付いた欄（`.optional().nullable()`）の初期値を `null` ではなく `undefined` にする（欄を空にしたときに書く値とそろえる）
- zod-form: `getDefaultValue` は、object の子の値が undefined のときキーを置かない（`{ x: undefined }` ではなく `{}`）。optional でないのに undefined を通す子（`z.unknown()` など）のキーは残す
- zod-form: `getDefaultValue(schema, value)` で、今の値を持ったまま schema を歩き、値が無いところだけを既定値で補えるようにした（配列の要素・record の値・union の腕の中も補う）。`adaptValueToSchema` もこの補い方にした
- zod-form-react・zod-form-widget: `zf.dynamic` の schema が最初に決まったとき、値が無いところを決まった schema の既定値で補う（削らない）。補いは `FormRuntime` に登録し、AutoForm は `useDefaultValuesWithFills` で defaultValues にも入れる（開いただけでは「変更あり」にならず、reset でも残る）
- zod-form-mantine: literal だけの union（`zf.union([zf.literal(10), zf.literal("abc")])`）に `uiType: "select"`・`"badge"` を付けると、enum と同じ選択の欄で選べるようにした（`union_select`・`union_badge`）。数値と文字列を混ぜられ、`literal(10)` と `literal("10")` も区別する。literal ごとの `label`・`color` を選択肢に使う。配列の `uiType: "multipleEnum"`・`"multipleEnumBadge"` の要素にも使える。必須のまま空なら「必須」のエラー、選択肢に無い値は enum と同じ扱い（`zf.union` の登録に `unlisted` を足した）。literal に入る値（文字列・数値・bigint・boolean・null・undefined）をすべて選べ、値を複数持つ literal は値ごとに出す。`z.null()`・`z.undefined()` の腕も選べ（ラベルは `zf.common.registry` で付ける）、undefined の腕があれば外側の optional、null の腕があれば外側の nullable より腕を優先する（外側の空を腕がすべて受け持つなら × を出さない）。選択肢を作る `choicesOf`・`useChoices`・`isEmptyOption` を `@zodapp/zod-form-mantine-lite/utils` に追加し、`BadgeSelect` に `clearable` を足した
- zod-form・zod-form-mantine: `zf.intersection` を足し、intersection（`a.and(b)`）を描けるようにした。両側を同じ path に並べ、入れ物は object と同じ uiType で決める。object・union・intersection に `uiType: "flat"` を足し、入れ物を出さずに欄を外側の並びに入れられるようにした（横並びでも同じ行に並ぶ。自分のエラーがあるときだけ、赤い Alert でエラーを出す）。同じ path のエラーは intersection が 1 回だけ出す（zod-form-react の `ZodFormProps` に `hideError` を足した）。腕そのもののエラー（腕の object の path を指定しない `.refine()`）も intersection が出すので、腕の中に出したいときは `.refine()` の path で欄を指す。`ZodFormProps` に `errorToken` を足し、union は context ではなくこれで腕に渡す。intersection の中の union は、intersection が空の値のエラーを出すときは「選択してください」を重ねて出さない。discriminatedUnion の選んでいない腕のキーの `unrecognized_keys` は、「（腕を選ぶ欄のラベルを「と」でつないだもの）を選択してください」と出す（intersection は入れ物に、discriminatedUnion は腕を選ぶ欄に出す）。`getDefaultValue` で intersection の初期値が出ず、`pruneValueToSchema` で intersection の値がすべて消えていた不具合を修正。union の腕を切り替えるとき、どの腕にも無いキーを消さないようにした
- zod-form-react・zod-form-mantine: 入れ物（object・intersection・array・record・union）が、子の欄を触ったこと・変えたことを自分のこととして扱うようにした。入れ物の path のエラー（path を指定しない `.refine()`）は、送信しなくても、入れ物から出たとき（最後の欄を離したとき・入れ物より後ろの欄にフォーカスしたとき）に出る。送信でエラーが出たあと子の欄を直すと、入れ物のエラーが消えて送り直せる（いままでは直しても送信が止まったままだった）。zod-form-react に、入れ物が子の欄の後ろに置く `ContainerMarker` を足した
- i18n-messages・i18n-messages-react・i18n-messages-zod・eslint-plugin-i18n-messages: 文言の辞書を引く仕組みを足した。`@zodapp/i18n-messages` は型付きの辞書（`RegisteredMessages` に module augmentation で登録）と、params を文字列に詰めたキー（`msgKey("myapp.nameTooShort", { length: 3 })` → `myapp.nameTooShort?length=3`）、辞書にあれば訳し無ければそのまま返す `msg.resolve` を持つ。`@zodapp/i18n-messages-react` は `I18nMessagesProvider`（入れ子にでき、内側が勝つ）・`useMsg`・`useLocale`・`createUseMsg` を持つ。`@zodapp/i18n-messages-zod` は zod の issue を辞書のキー（`zod.*`）にする error map と、その ja・en の辞書を持つ。`@zodapp/eslint-plugin-i18n-messages` のルール `comment` は、キーの直後に基準の言語の文言をコメントで書かせる（`msg("key" /* 文言 */)`、`--fix` で書き込む）
- zod-form-react・zod-form-mantine-lite・zod-form-mantine・zod-form-widget: 部品の固定の日本語の文言を辞書のキーにし、`./messages` で `ja`・`en` の辞書を公開した（依存するパッケージと zod のエラーの辞書も含む）。meta の文言（`label`・`trueLabel`・`falseLabel`・`emptyMessage`・`selectorLabel`・`unselectedLabel`、選択肢の label、表の列の見出し）が辞書のキーなら訳す。`FormRuntime` の検証は zod のエラーを辞書のキーにする（AutoForm に加えて AutoSearch も `FormRuntime` で検証する）。日付の欄のロケールと表の並べ替えは `useLocale()` に従う。`parseDynamicTabularFile` は `TabularImportError`（`code`）を投げる
- zod-form-react・zod-form-mantine-lite・zod-form-mantine・zod-form-widget: **破壊的変更**：`I18nMessagesProvider` が無いときの文言を、日本語から英語にした。日本語にするときは、ルートを `I18nMessagesProvider` で包み、`@zodapp/zod-form-widget/messages`（widget を使わなければ `@zodapp/zod-form-mantine/messages` など）の `ja` を渡す
- zod-form-widget: **破壊的変更**：`@zodapp/zod-form-widget/i18n/ja`（`jaErrorMap`）を削除した。`FormRuntime` で検証すれば `z.config` は要らず、zod のエラーは `@zodapp/i18n-messages-zod` の辞書で訳す
- zod-form-mantine-lite: **破壊的変更**：`UNLISTED_LABEL` を削除し、`useUnlistedLabel()` にした。`externalKeyDisplayLabel` は 4 つめの引数で選択肢に無い値の表示を受け取る
- form-demo・survey・taskmanager: ルートを `I18nMessagesProvider` で包み、ヘッダーに日本語・English の切り替えを付けた（localStorage に保存。アプリ自身の文言は日本語のまま）。form-demo に、meta の文言を辞書のキーで書く多言語化のデモページ（i18n-messages）を足した
