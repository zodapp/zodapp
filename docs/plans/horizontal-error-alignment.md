# 横並びの欄のエラーの位置をそろえる

- ステータス：実装済み（単体テスト・型・build・form-demo の e2e 176 件が通る）

## 1. 背景

`uiType: "horizontal"`・`"horizontal-wrap"` の入れ物で、エラーの出た欄だけラベル・入力欄が上にずれる。
並んだ欄ごとに、エラーメッセージの縦位置もそろわない。

原因は、横並びの行が `alignItems: "flex-end"`（各欄の下端そろえ）になっていること。
エラーが出た欄は、その分だけ背が伸びる。下端をそろえると、ラベルと入力欄が上に押し上げられ、エラーの無い欄と高さがずれる。
ラベルなしの入れ子 object（From・To など）では、エラーが出ると入れ子の中の欄どうしもずれる。

該当箇所：

- `packages/zod-form-mantine/src/components/container.tsx`（`FieldContainer`。object・intersection・固定キーの record で共通）
- `packages/zod-form-mantine-lite/src/reactiveComponents/object.tsx`（reactive 版の object）

## 2. 決まり

### 2.1 横並びは上端でそろえる（案 A）

横並びの行の `alignItems` を `"flex-end"` から `"flex-start"` に変える。

- ふつうの入力欄が並ぶときは、ラベル・入力欄・エラーの高さがそろう。
- エラーが出ても、ほかの欄は動かない。
- 上にラベルを持たない欄（`uiType: "checkbox"` のチェックボックス、boolean の `uiType: "inline"`）は、入力欄の横ではなくラベルの高さに来る。
  部品の側で高さを合わせる手当て（案 A'）はしない。そろえたいときは、ラベル付きの入れ子 object で包む（§4）。
- ラベル付きの入れ子 object は、自分のラベルの分だけ中の入力欄が下がる。これは仕様とする。

### 2.2 ラベルなしの入れ物は、上の余白を 0 にする

ラベルなしの入れ物（`InputWrapper`）は、`inputWrapperStyle` の上の余白（既定 5px）を付けない。横並びの中かどうかに関わらない。

- 横並び（flex）の中では、マージンが相殺されない。入れ物の 5px と中の欄の 5px が 2 回効いて、ラベルなしの入れ子の中の欄だけ 5px 下がる。これを直す。
- 縦並びでは、入れ物の上の余白と最初の子の上の余白が相殺され、もともと 5px 分しか効いていない。0 にしても見た目は変わらない（ブラウザで確かめた）。
- 例外：上の余白が 5px より小さい部品が先頭に来ると、縦並びでもその差だけ詰まる。標準の欄は 5px 以上の余白を持つので、ふつうの使い方では出ない。
- ラベルのある入れ物と、`uiType: "box"`（Fieldset）は今のまま。
- `--zod-form-input-wrapper-margin-top` で余白を変えている利用者も、ラベルなしの入れ物では 0 になる。相殺により、縦並びでは子の余白がそのまま効くので、見た目は変わらない。

## 3. 変えるところ

### 3.1 zod-form-mantine-lite

- `utils/styles.ts`：ラベルの有無から入れ物の style を返す関数を足す（例：`containerWrapperStyle(label)`）。
  ラベルがあれば `inputWrapperStyle`、なければ `{ ...inputWrapperStyle, marginTop: 0 }`。`utils/index.ts` から公開する。
- `reactiveComponents/object.tsx`：横並びの `alignItems` を `"flex-start"` にする。入れ物の style を上の関数にする。
- `reactiveComponents/record.tsx`：入れ物の style を上の関数にする（横並びは無いが、ラベルなしの入れ物の決まりをそろえる）。

### 3.2 zod-form-mantine

- `components/container.tsx`：横並びの `alignItems` を `"flex-start"` にする。既定の入れ物（box・flat 以外）の style を上の関数にする。
  ファイル冒頭の説明に、上端でそろえることと、ラベルなしの入れ物は上の余白を付けないことを書く。
- `components/record.tsx`：キーを変えられる record（entries）の入れ物の style を上の関数にする。

### 3.3 form-demo

`zf.object（並べ方）`（`objectLayout.ts`）に、エラーの出る横並びの例を足す。

- 必須の欄とエラーの無い欄を横に並べ、送信するとエラーが出る例
- ラベル付きの入れ子 object にチェックボックスを入れて、入力欄とそろえる例
- ラベルなしの入れ子 object（期間の From・To）を横並びに入れる例

並行してデモの多言語化が動いているので、ラベルの書き方はその時点の main に合わせる。

### 3.4 テスト

- form-demo の e2e（Playwright）に、上の例で送信してエラーを出し、並んだ欄の入力欄の上端と、エラーメッセージの上端がそろうことを確かめるテストを足す。
- zod-form-mantine の単体テスト（jsdom）はレイアウトを計算しないので、`alignItems` と余白の値だけを見るテストは足さない。

## 4. 利用者向けの書き方

チェックボックスを横並びの入力欄とそろえたいときは、ラベル付きの object で包む。

```ts
z.object({
  keyword: zf.string().register(zf.string.registry, { label: "キーワード" }),
  filter: z
    .object({
      active: zf.boolean().register(zf.boolean.registry, {
        label: "有効のみ",
        uiType: "checkbox",
      }),
    })
    .register(zf.object.registry, { label: "絞り込み" }),
}).register(zf.object.registry, { uiType: "horizontal-wrap" });
```

この書き方を、container.tsx の説明か、デモの例のコメントに書く。

## 5. 確かめること

- `pnpm check-types`・`pnpm build`・単体テスト・form-demo の e2e が通る
- form-demo の各ページ（縦並び・box・intersection の flat・union の腕）で見た目が変わらないことを、スクリーンショットで前後比較する
- taskmanager・survey の検索欄（`horizontal-wrap`）の見た目を確かめる

## 6. しないこと

- チェックボックスなど、上にラベルの無い部品の高さを横並びに合わせる手当て（案 A'）
- CSS grid（subgrid）でラベル・入力欄とエラーを別の行に分けること（案 B）

## 7. 実装後の確かめ

form-demo の全 41 ページを、変更の前後でスクリーンショットに撮って比べた。

- 横並び（`zf.object（並べ方）`）のほかは、縦の並び方は変わらない。
- 根の object（ラベルなし）の上の余白が無くなり、フォーム全体が 5px 上に上がるページがある（reactive 版のページ、file・mediaPreview・selectAndExternalKey など）。
  根の入れ物が flex の中（Stack）にあると、入れ物の余白と最初の欄の余白が相殺されず、2 回効いていたため。
  ほかのページと同じ間隔になる。
- 先頭の欄の上の余白が 5px より小さいページ（booleanVariants の Switch は 3px）は、フォーム全体が 2px 上に上がる（§2.2 の例外）。
- taskmanager・survey の検索欄は、DB とログインが要るため見ていない。
