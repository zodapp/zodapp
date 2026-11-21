# entries の横並び（uiType: entries-horizontal）

- ステータス：プラン（決定済み。実装中）
- 前提：[object の uiType: entries](./object-entries.md)（PR #47）

## 1. 背景

`uiType: "entries"` は、項目を縦に並べる。検索条件のように、画面の上に横一列で条件を並べたい場合がある。
form-demo に CSS を当てた試作（スクショ 5-h2-\*）で、次の形が良さそうと分かった。

- 項目ごとのカード（今の entries と同じ薄い枠）を横一列に並べる。並びきらない分は横にスクロールする（項目はいくつでも足せる）。
- ⊖ はカードの右上に置く。カードの左に置くと、⊖ がカードとカードの間に来て、どちらのカードのものか分からない（スクショ 5-h1-2）。
- 「項目を追加」は、スクロールする範囲の外（下の左）に置く。スクロールしても常に見える。
- カードの幅は、表（array の table）の列と同じく、共通の meta の `width`・`widthWeight` で決める。

## 2. 決まり

### 2.1 指定のしかた

```ts
zf.object({ ... }).register(zf.object.registry, {
  label: "検索条件",
  uiType: "entries-horizontal",
  keyOrder: "definition", // entries と同じ
});
```

- 新しい uiType `entries-horizontal` にする。object の `horizontal`・`horizontal-wrap` と同じ名付け。
- キーが enum・literal の `z.partialRecord` でも使える（entries と同じ部品を使うため）。
- キーを自由に入力する record（`record_entries`）と Map は対象外（縦のまま）。

### 2.2 変えないこと

どの項目が行（カード）になるか、行の中身の扱い（undefined を外に出す）、optional・nullable・nullish の意味、keyOrder、足す・消すの動きは、すべて entries と同じ（[object-entries.md](./object-entries.md) §2.2〜§2.6）。違うのは見た目だけ。

### 2.3 見た目

- 全体の枠（Fieldset、label は legend）は entries と同じ。
- 枠の中に、横にスクロールする並びを置き、カードを左から右へ 1 列に並べる。折り返さない。
- カードの中身は entries と同じ（上に項目の名前、その下に値の部品。名前に必須の `*` は付けない）。
- カードの高さは、並びの中でいちばん高いカードにそろえる。
- ⊖ はカードの右上。名前と重ならないよう、カードの右に ⊖ の分の余白を取る。必須・nullable の項目には ⊖ が無い。
- 「項目を追加」は、並びの下の左に置く（スクロールしない）。足せる項目が無ければ出さない。
- 項目を足したら、足したカードが見えるところまで並びをスクロールする（keyOrder: definition では途中に入ることがあるため）。
- 入れ物のエラーは、枠の下（entries と同じ）。
- `readOnly` では ⊖ と「項目を追加」を出さない。

### 2.4 カードの幅

表（`array_table.tsx`）の列の幅と同じ決め方にする。

1. カードの幅の下限は、項目の meta の `width`（px）。meta は、包み（optional・nullable・default など）と pipe（transform の入口）をたどって探す（label を探すのと同じ）。
2. `width` が無いときの既定：
   - object（入れ子。価格の以上・以下など）は、中の欄の幅の合計（それぞれ 1・2 で決める）＋間の余白。
   - それ以外は 280px（試作と同じ）。
3. カードの幅の合計が並びの幅より小さいときは、余りを `widthWeight`（無ければ幅）の比で配って広げる。大きいときは広げず、横スクロールにする。並びの幅は ResizeObserver で測る（表と同じ）。

表の幅の計算（`getColumnWidth`・`getColumnWidthWeight`・`getDistributedColumnWidth`）は、表と entries-horizontal の両方から使えるよう、共通の場所（`utils/` など）に移す。表の動きは変えない。

## 3. 変えるところ

- `packages/zod-form-mantine/src/components/entries_layout.tsx`：横並び用の並び（スクロールする入れ物）と、⊖ を右上に置く行を足す。
- `object_entries.tsx`・`record_partial_entries.tsx`：`entries-horizontal` のときに横並びの見た目で描く（中身の動きは同じ）。
- `packages/zod-form-mantine/src/index.ts`：uiType `entries-horizontal` を object と partialRecord に登録する。
- 幅の計算を表から共通の場所に移し、表と entries-horizontal から使う。
- `packages/zod-form/src/def/index.ts`：uiType の説明（あれば）に `entries-horizontal` を足す。

## 4. デモとテスト

### 4.1 form-demo

- `objectEntries` のデモに 3 つ目の枠「検索条件（横並び）」を足す。項目は 1 つ目の枠と同じで、価格（入れ子）と、`width` を指定した項目を 1 つ入れる。
- 説明の文と、ja・en の辞書を足す。

### 4.2 単体テスト（zod-form-mantine、jsdom）

- 幅の計算：`width` があればその値、object は中の欄の合計、それ以外は 280。余りを `widthWeight` の比で配る。並びより大きければ広げない。
- `entries-horizontal` でも、行・⊖・足す・消す・readOnly が entries と同じに動く（entries のテストの一部を両方の uiType で回す）。

### 4.3 e2e（form-demo、Playwright）

- カードが横一列に並ぶ（どのカードも同じ高さの位置にある）。
- 項目を全部足すと並びが横にスクロールでき、「項目を追加」はスクロールしても見えている。
- 足したカードが見える位置までスクロールする。
- ⊖ がカードの右上にあり、押すとキーごと消える。
- `width` を指定した項目のカードの幅が、指定の幅以上になる。

## 5. 決めたこと

1. 指定のしかた：新しい uiType `entries-horizontal` にする（entries に meta を足す案はとらない）。
2. 既定の幅：いったん 280px で作り、できた見た目を見て判断する。
