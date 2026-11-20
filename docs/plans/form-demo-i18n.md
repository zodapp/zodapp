# form-demo の本文・説明・フォームの中身を言語の切り替えに追従させる

- ステータス：プラン（未実装）

## 1. 背景

PR #33 で form-demo のヘッダーに言語の切り替え（日本語 / English）を入れた。切り替えで変わるのは、ライブラリの文言・zod の既定のエラー・日付の表示と、`i18nMessages` のデモ 1 ページだけである。
アプリの枠（トップ・一覧・サイドバー・タブ・見るための部品・「動きを試す」）、各デモの title / description、フォームの中身（ラベル・選択肢・エラーの文言・computed の説明文）は、日本語のまま出る。

この作業で、form-demo のどの画面も English で読めるようにする。あわせて、ライブラリで i18n の仕組みに乗っていない所（computed の表示値、mantine の computed のラベル）を直し、meta に `placeholder` を足す。

## 2. 決まり

### 2.1 何を辞書のキーで書くか

| 対象                                                                                                                                                                                                | 書き方                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| アプリの枠（`top/home`・`form/list`・`form/Layout`・`detail` のタブ・`demos.tsx`・`CommonLayout` の aria-label・`E2eHarness`・`TryBehavior`・`fetchControl`・各デモの「外から書き込む」ボタンなど） | アプリの辞書（`src/messages`）のキーを `useMsg` で引く                          |
| 各デモの `title`・`description`                                                                                                                                                                     | アプリの辞書のキー。`detail`・`list`・サイドバーで `msg` を通して出す           |
| フォームの中身：meta の `label`・`trueLabel`・`falseLabel`・`emptyMessage`・`selectorLabel`・`unselectedLabel`・`placeholder`                                                                       | `msgKey(...)`                                                                   |
| フォームの中身：スキーマに書いたエラーの文言（`.min(3, "…")`・refine の message・`zf.literal(true, "…")`）                                                                                          | `msgKey(...)`。zod の既定のエラーで足りるものは、文言を書かずに既定に任せてよい |
| フォームの中身：computed・formatter が返す文字列（説明文・badge・icon・link の label）                                                                                                              | `msgKey(...)` を返す（§3.1 で訳されるようにする）                               |
| データ：初期値・suggestions・resolver の選択肢（人・住所など）                                                                                                                                      | 辞書にしない。英語の値に書き換える（§2.3）                                      |
| コード中のコメント                                                                                                                                                                                  | 訳さない（日本語のまま）                                                        |

- `msgKey` のキーの直後のコメント（`/* i18n: … */`）は、ESLint（`@zodapp/i18n-messages/comment`）の自動修正で入れる。手で書かない。
- コードのタブには `msgKey(...)` とコメントがそのまま出る。それでよい（i18n の書き方の例にもなる）。
- 既定の言語は今のまま ja。

### 2.2 辞書のキー

- 英語の辞書（`src/messages/en.ts`）を型の基準にし、日本語の辞書（`ja.ts`）は `satisfies MessagesOf<typeof en>` で確かめる（今と同じ）。
- キーの形：
  - アプリの枠：`formDemo.app.<場所>.<名前>`（例：`formDemo.app.detail.tabCode`）
  - デモの title / description：`formDemo.page.<file>.title`・`formDemo.page.<file>.description`
  - フォームの中身：`formDemo.<file>.<欄の path>`（例：`formDemo.basicInput.lastName`）。`<file>` はデモのファイル名（拡張子なし）。e2e 用のページの formId はハイフンを含み、キーの区切りに使えないため、formId ではなくファイル名にする。選択肢は `….<値>`、エラーは `….<欄>.<決まり>`（例：`formDemo.unionArms.text.min`）
  - 複数のデモで共有する部品（`shared/demo/*`）：`formDemo.shared.<部品>.<名前>`
- 今の `formDemo.i18n.*`（`i18nMessages` のデモ）は、ほかのデモにそろえて `formDemo.i18nMessages.*` にする。
- 辞書はデモのファイルごとに分ける（`src/messages/{en,ja}/<file>.ts`。アプリの枠は `app`、共有の部品は `shared`）。`en.ts`・`ja.ts` が 1 つにまとめて渡す。
- ESLint の `@zodapp/i18n-messages/comment` のための、キーの接頭辞と辞書のファイルの対応は、`eslint.config.js` が `src/messages/ja/` のファイル名から作る。

### 2.3 データを英語にする

- 初期値・suggestions・resolver の選択肢（`shared/demo/resolvers.tsx` の人の名前など）は、英語の値にする。
- 例外：言語の違いを見せるために置いている値（record のキー `ja` に「こんにちは」、`zh` に「你好」など）は残す。
- 住所のカスケードは、言語で中身を切り替えない。米国の住所を主にし、日本の住所を別のサンプルとして残す。どちらも言語に関わらず出す。
  - topic はデータの種別ごとにフラットにし、国を接尾辞で付ける。

    | 国   | 1 段目           | 2 段目                 | 3 段目                  |
    | ---- | ---------------- | ---------------------- | ----------------------- |
    | 米国 | `states_us`      | `cities_us/<州>`       | `neighborhoods_us/<市>` |
    | 日本 | `prefectures_jp` | `cities_jp/<都道府県>` | `towns_jp/<市区町村>`   |

  - 親が空のときの topic（今の `cities/`・`towns/`）も、それぞれの名前で持つ（`cities_us/`・`cities_jp/` など）。
  - カスケードを使う `selectAndExternalKey`・`dynamicAdvanced` に、米国の住所の欄と日本の住所の欄を並べる。
  - e2e は今と同じく日本の住所の欄を相手にする（手順はほぼ変えない）。topic の名前を見ている所（`dynamic-advanced.spec.ts` の `cities/osaka`）は `cities_jp/osaka` に直す。

## 3. ライブラリの修正

### 3.1 computed の表示値を訳す（zod-form-mantine-lite）

- `renderComputedValue`・`renderComputedFieldValue`（`utils/renderComputedValue.tsx`）で、次を `msg.resolve` に通す。
  - 値が string のとき、その文字列
  - `{ type: "badge" | "icon" | "link", label }` の `label`
- 今は hook を呼べない関数なので、string と label を出す所を小さな部品にして、その中で `useMsg` を呼ぶ。
- これで computed（form・reactive・table）と、string・number の `formatter` の表示が訳される。
- `msg.resolve` は、キーの形でない文字列と辞書に無いキーを、受け取った文字列のまま返す。今の computed の値は変わらない。
  キーの形で辞書にもある文字列がたまたま訳されることは、仕様として受け入れる。
- `msg.resolve` のフォールバック（辞書に無いときに受け取った文字列をそのまま返す）は変えない。

### 3.2 mantine の computed のラベルを訳す（zod-form-mantine）

- `components/computed.tsx` は `getMetaReact` の `label` をそのまま出している。reactive 版（mantine-lite）と同じく、`useResolveText` で訳す。

### 3.3 meta に `placeholder` を足す（zod-form・zod-form-mantine・zod-form-mantine-lite・zod-form-react）

- `placeholder?: string` を、入力欄を持つ型の meta に足す：`string`・`number`・`bigint`・`date`・`enum`・`externalKey`。
  - `time` には足さない。Mantine の TimePicker は時・分の入力が分かれていて、1 つの placeholder を出す所が無いため。
  - 共通の meta（`zodExtendableCommonDefSchema`）には足さない。object・array などに意味が無いため。
- `TEXT_META_KEYS`（`zod-form-react/src/common/i18n.ts`）に `placeholder` を足し、`msgKey` で書けば訳されるようにする。
- 各部品が meta の `placeholder` を Mantine の入力に渡す。部品が自分の placeholder（「読み込み中」、enum の選択済みラベルを出す placeholder、複数入力の「入力してEnterで追加」など）を出す所では、部品の placeholder を優先する。
  どの部品のどの状態で meta の値を出すかは、実装で一覧にして確かめる。
- ドキュメント（`zod-form` の README の meta の説明）に `placeholder` を足す（英語・日本語の両方）。

### 3.4 テスト

- computed：string の値・badge の label を `msgKey` で書くと、辞書の文言で出ること。辞書に無いキー・キーの形でない文字列は、そのまま出ること。
- mantine の computed のラベルが訳されること。
- `placeholder`：各部品で meta の値が出ること。`msgKey` で書くと訳されること。

## 4. form-demo の修正

1. **アプリの枠**：§2.1 の対象を辞書に移す。`Language.tsx` の「アプリ自身の文言は日本語のまま」というコメントを直す。
2. **title / description**：各デモのモジュールの `title`・`description` を辞書のキーにする。`detail`・`list`・`form/Layout`（サイドバー）・`top/home` で `msg` を通す。
3. **フォームの中身**：デモ（e2e 用のページを含む）のラベル・選択肢・エラー・computed の文字列を `msgKey` にする。`customWidget` の自作部品の placeholder（都道府県・市区町村）は `useMsg` で引く。
4. **データ**：§2.3 のとおり英語にし、住所のカスケードを分ける。
5. **`apps/form-demo/AGENT.md`**：「「動きを試す」の説明は人が読める日本語で書く」を、「画面に出る文言は辞書のキーで書き、en・ja の両方を書く」に直す。デモを足すときの決まりとして §2.1・§2.2 を書く（main の英語版の AGENT.md に対して直す）。

## 5. e2e

- 既定は ja のままなので、日本語のラベル・文言で探している今の spec は、そのまま通る。
- データを英語にした所（初期値・選択肢の値を見ている所）は、spec の期待値を直す。
- `all-pages.spec.ts` に、English に切り替えてすべてのページ（e2e 用のページを含む）を開き、次を確かめるケースを足す。
  - 画面の文字に、訳されていないキー（`formDemo.` で始まる文字列）が出ていない。辞書を `I18nMessagesProvider` に渡し忘れたときもここで分かる。
  - 画面の文字に、日本語が残っていない。ただし、日本の住所のサンプル、言語の違いを見せる値、言語の切り替えの「日本語」、コードのタブは除く。
- 住所の米国の欄は、`all-pages` でページが開けることだけを確かめる。
- 見るための部品（`window.__formDemo`）に残るエラーは、訳す前のキーのまま。e2e でエラーを `window.__formDemo` から読む所は、キーで比べる（画面のエラーは訳した文言で比べる）。
- 実装で分かったこと：英語の画面で、array の table の列見出しが訳されていなかった（`zod-form-mantine` の `array_table`）。あわせて直す。
- 日本語のまま残してよい値に、カナの読みの欄（`objectLayout` のセイ・メイ）を加える。日本語の名前の読みを入れる欄で、言語の違いを見せる値と同じ扱いにする。

## 6. 進め方

- ブランチ `claude/project-thread-woygx8` に、次の順でコミットを分けて積む。PR は 1 本にする。
  1. ライブラリ：computed の表示値とラベルを訳す（§3.1・§3.2）
  2. ライブラリ：meta に `placeholder` を足す（§3.3）
  3. form-demo：アプリの枠と title / description（§4 の 1・2）
  4. form-demo：フォームの中身（§4 の 3。量が多いので、デモのまとまりごとに数コミットに分ける）
  5. form-demo：データの英語化と住所のカスケード（§4 の 4）
  6. form-demo：e2e の追加と、AGENT.md の決まり（§4 の 5、§5）
- 実装が済んだら、仕様は README・docs に移し、このプランは意図だけに縮めて `docs/archive/` に移す。

## 7. ほかの作業との重なり

- PR #40（ReactiveAutoForm の `value` 化）：form-demo では `detail.tsx` の 1 行だけを変える。先にマージされたら取り込む。
- PR #41（英語化）はマージ済み。`apps/form-demo/AGENT.md` は英語 1 本になっているので、それに対して直す。
