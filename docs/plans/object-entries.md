# object の uiType: entries（項目を後から足し、外側で消す）

- ステータス：プラン（レビュー中）

## 1. 背景

検索条件の設定のように、「使う項目だけに値を入れる」フォームを作りたい。
キーが enum の `z.partialRecord` で試したところ（form-demo に試作。未コミット）、次の問題があった。

- 値の型をキーごとに変えられない（タイトルは文字列、価格は範囲、などができない）。検索条件には object の方が合う。
- 条件の外し方が値の部品ごとにばらばら。string は空にする、enum は ×、optional な object は ⊖。
  optional な object は ⊕ を押すだけで `{}` が入り、意味のない条件として送れてしまう。
- 既定の見た目では、候補の項目を全部並べる。項目が多いと使いにくい。
- partialRecord の entries は、行の値に必須の `*` が付く（⊖ で消せる行なのに必須に見える）。全体の枠も無く、どこまでがひとまとまりか分からない。

そこで object に、partialRecord の entries と同じ考え方の見た目を足す。

1. optional の項目の「有る・無い」は、子の部品ではなく親（object）が扱う。行ごとに ⊖ を付けて、キーごと消す。
2. 項目を全部は並べず、値にある項目だけを並べる。下の選択で後から足す。

あわせて、record（partialRecord）の entries の挙動を object の entries にそろえる。

## 2. 決まり

### 2.1 指定のしかた

```ts
const condition = zf
  .object({
    keyword: zf.string().register(zf.string.registry, { label: "キーワード" }),
    title: zf.string().register(zf.string.registry, { label: "タイトル" }).optional(),
    price: priceRange.optional(), // 以上・以下の object
    sort: zf.enum([...]).optional(),
  })
  .register(zf.object.registry, {
    label: "検索条件",
    uiType: "entries",
    keyOrder: "definition", // 省略時 definition
  });
```

- 名前は record と同じ `uiType: "entries"`。部品は `object_entries` として登録する（Switch は `${schema.type}_${uiType}` で探す）。
- `keyOrder`（`"definition" | "value"`）を object の meta にも足す。意味は record と同じ（§2.5）。

### 2.2 どの項目が行になるか

- **optional の項目**（`schema._zod.optin === "optional"`。`.optional()`・`.default()` など、キーが無くても通るもの）は、値にキーがあるときだけ行として出す。行には ⊖ を付ける。
- **必須の項目**は、常に行として出す。⊖ は付けない。
- `hidden` の項目は、ふつうの object と同じく出さない。
- 「値にキーがある」は `key in value` で見る（値が undefined でも、キーがあれば行を出す）。

### 2.3 行の中身（undefined の扱いを外に出す）

- optional の項目の行では、子に optional の分の取り消しの UI（object の ⊖・⊕、enum の × など）を出させない。項目を外す手段は、親の ⊖ だけになる。
- 外すのは optional の包みだけ。nullable の包みは子に残し、null は今までどおり子が扱う（§2.4）。
- 子が欄を空にしたときに書く値は、今の `emptinessOf` と同じく undefined を優先する（nullish でも undefined）。
  optional の包みを外すと outer が nullable だけになり、空の値が null になってしまうので、
  「取り消しの UI は出さないが、空の値は undefined」を子に伝える手段を outer に足す（名前などは実装時に決める）。
- meta が `.optional()` の外側に付いている書き方（`x.optional().register(...)`）でも label が消えないよう、外す前の meta を引き継ぐ。
- 行のラベル（項目の label）は親が描き、子には `label={false}` を渡す。そのため、行のいちばん上に必須の `*` は付かない。
  範囲の object の中の「以上」など、行の中の必須の欄には、今までどおり `*` が付く。
- 子の欄が空になって undefined を書いても、キーは残る（行は消えない）。行を消すのは ⊖ だけ。

### 2.4 optional・nullable・nullish の意味

| 項目の書き方  | 扱うのは         | 行                                   | 空にしたとき                 | 保存すると         |
| ------------- | ---------------- | ------------------------------------ | ---------------------------- | ------------------ |
| `.optional()` | 親               | 値にキーがあるときだけ出す。⊖ で消す | undefined（行は画面に残る）  | 未入力の行は消える |
| `.nullable()` | 子               | 常に出す。⊖ は付けない               | null                         | null のまま残る    |
| `.nullish()`  | 行は親、中身は子 | optional と同じ                      | undefined（optional と同じ） | 未入力の行は消える |
| 必須          | —                | 常に出す。⊖ は付けない               | 子の部品の決まりのまま       | —                  |

- **optional**：「表示しただけで未入力」の行は、メモリ上だけ `{ key: undefined }` で持ち、保存（JSON など）すると消える。これを仕様とする。
  初期状態として未入力の行を出したいときは、defaultValues に `{ key: undefined }` と書く（getDefaultValue は、渡した値にある undefined のキーを残す）。
- **nullable**：getDefaultValue が null を入れるので、初めから行が出る。中身の null と値の切り替えは子の部品が行う。
- **nullish**：値の動きは optional と同じで問題は無いが、null を受け付けるのに UI からは null が入らず、意味が分かりにくい。
  値が object だと、行の ⊖ に加えて子の ⊖・⊕ も出る（子の ⊖ は中身を undefined にし、行は空のまま残る）。検索用には非推奨とドキュメントに書く。
- **未入力の行を送れるか**は schema に任せる。object は項目を optional にすれば `{ key: undefined }` が通る。
  partialRecord は値を optional にすれば通る（`z.partialRecord(keys, z.string().optional())`。確かめ済み）。付けなければ zod の検証でエラーになる。

- **空の object（range の `{}` など）**：ライブラリは消す処理を持たない。送信の値から消したいときは、schema に transform を書く。
  例：`range.transform((v) => (isEmpty(v) ? undefined : v)).optional()`。pipe は入口の型で描き、送信では parse した出力を渡すので、
  画面の上では `{}` のまま行が残り、送信の値からは消える想定。entries の外のふつうの `object().optional()` でも同じ書き方が使える。
  - 入力の値をそのまま保存するアプリ（URL に入力を同期するなど）では `{}` が残る。そうしたアプリは、保存や検索の実行のときにアプリ側で消す。
  - この書き方が本当に動くか（entries で pipe の項目を optional と判定できるか、optional の包みを外せるか、getDefaultValue が通るか、送信の値から消えるか）は、
    実装したあとに単体テストと e2e で確かめる。動かなければ、その結果を見て対応策（ライブラリでの手当てなど）を考え、このプランに書き足す。

### 2.5 並び（keyOrder）

- `definition`（既定）：`meta.properties`、無ければ shape の順。必須の項目と、値にある optional の項目を、この順に並べる。
- `value`：値の object のキーの順。足した項目は値の末尾に入るので、実質足した順になる。必須の項目で値に無いもの（ふつうは既定値で入っている）は後ろに並べる。
- JS の object の、整数に見えるキーの並びの注意は record と同じ（meta の説明に書く）。

### 2.6 足す・消す

- 下に Mantine の `Select`（searchable）を置き、まだ値に無い optional の項目を、label で選べるようにする。足せる項目が無くなったら出さない。
- 足したときの値は `getDefaultValue(子の schema)`。string・number・enum・boolean は undefined、object は `{}`（中も補う）、array は `[]`、`.default()` があればその値。
- ⊖ を押すと、キーごと消す。配下の欄に残ったエラーの meta も消す（`OptionalContainer` の消し方と同じ）。
- 消す・足すは `runAsUserEdit` の中で行う（ユーザーの編集として扱う）。

### 2.7 見た目

- 全体を枠で囲む（`uiType: "box"` と同じ `Fieldset`。label は legend）。どこからどこまでがひとまとまりかを見せる。
- 行ごとの見た目は、今の partialRecord の entries と同じ（左に ⊖、中身は薄い枠の中）。必須の行は ⊖ の幅だけ空ける。
- 選択の文言は「項目を追加」（新しい i18n のキー `zodFormMantine.object.addField`。en は "Add a field"）。
- `readOnly` では ⊖ と選択を出さず、値にある項目と必須の項目だけを並べる。
- 横並び（horizontal）とは組み合わせない（uiType は 1 つ）。

### 2.8 その他

- object 自体が optional なら、今の object と同じく `OptionalContainer`（⊖・⊕）で包む。
- 入れ物のエラーと `ContainerMarker` の扱いは、ふつうの object と同じ。
- shape に無いキーが値にあっても描かない（ふつうの object と同じ）。

## 3. record の entries をそろえる

### 3.1 キーが enum・literal の partialRecord（`PartialRecordEntriesComponent`）

- 全体を枠で囲む（§2.7）。
- 行の値の部品に `label={false}` を渡し、key の label は行で親が描く。行のいちばん上の `*` は付かない（§2.3）。
- `keyOrder`・足すときの値（getDefaultValue）・⊖ の動きは今のまま（object がこれに合わせる）。
- ⊖ で消すときに、配下の欄のエラーの meta も消す（object とそろえる）。
- 値の schema の optional・nullable・nullish は、§2.3・§2.4 と同じ決まりで扱う（optional の包みだけを外し、空の値は undefined を優先する）。

### 3.2 キーを自由に入力する record（`record_entries`）

- 全体を枠で囲み、⊖ の位置を同じにする。キーの入力・名前の変更などの動きは変えない。

### 3.3 共通の部品

行（⊖＋薄い枠）、全体の枠、足す選択を、`entries_layout.tsx`（仮）にまとめ、object・partialRecord・自由キーの record の 3 つから使う。

## 4. 変えるところ

- `packages/zod-form/src/def/index.ts`：object の meta に `keyOrder` を足す。record の `keyOrder` の説明を、object にも当てはまる書き方にする。
- `packages/zod-form-mantine/src/components/object_entries.tsx`（新規）：§2 の部品。`index.ts` に `object_entries` として登録する。
- `packages/zod-form-mantine/src/components/entries_layout.tsx`（新規）：§3.3 の共通部品。
- `packages/zod-form-mantine/src/components/record_partial_entries.tsx`・`record_entries.tsx`：§3 のとおり共通部品に寄せる。
- `packages/zod-form-mantine/src/messages/{ja,en}.ts`：`zodFormMantine.object.addField`。
- `packages/zod-form-react/src/common/outer.ts`：「取り消しの UI は出さないが、空の値は undefined」を伝える手段（§2.3）。
- optional を外して meta を引き継ぐ処理は、`zod-form-react` か `zod-form` の utils に置く（どちらに置くかは実装時に、既存の unwrap の処理に合わせる）。

## 5. デモとテスト

### 5.1 form-demo

- 新しいページ「検索条件（object の entries）」を足す。キーワード（必須）、タイトル・著者（string）、価格・ページ数（以上・以下の object）、並べ替え（enum）を optional の項目として持つ。
  価格の range には §2.4 の transform を付ける。nullable の項目（常に出る）、defaultValues の `{ key: undefined }` で初めから出す未入力の行、`keyOrder: "value"` の例も置く。
- 試作した partialRecord の検索条件のページ（未コミット）は使わず、消す。
- `zf.record` のページの partialRecord の entries は、枠と `*` が変わるのでスクショで前後を比べる。

### 5.2 単体テスト（zod-form-mantine、jsdom）

- 値にある optional の項目と必須の項目だけが行になる。
- 選択で足すと、`getDefaultValue` の値が入り、行が増える。足せる項目が無くなると選択が消える。
- ⊖ でキーごと消え、配下のエラーも消える。必須の行には ⊖ が無い。
- 行のいちばん上に `*` が付かない。optional な object の行に、子の ⊖・⊕ が出ない。
- optional の行の欄を空にすると undefined になり、行は残る。nullish でも undefined になる。
- nullable の項目は初めから行が出て、⊖ が無く、空にすると null になる。
- defaultValues の `{ key: undefined }` で、初めから未入力の行が出る。
- partialRecord で値を optional にすると、未入力の行を送れる。付けないとエラーになる。
- transform を付けた object の項目（pipe）が、optional の項目として行になり、足す・消すができる。
- `keyOrder` の definition・value の並び。
- `readOnly` で ⊖ と選択が出ない。
- partialRecord の entries の既存のテストを、枠と `*` の変更に合わせる。

### 5.3 e2e（form-demo、Playwright）

- 新しいページで、項目を足す・値を入れる・⊖ で消す・送信する、を通す。送信した値に、消した項目が無いことを確かめる。
- 足して何も入れていない optional の行が、送信した値（JSON）に入らないことを確かめる。
- transform を付けた価格の range で、以上・以下を入れてから両方空にして送信すると、価格が送信した値に入らないことを確かめる。
