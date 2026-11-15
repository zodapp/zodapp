---
"@zodapp/zod-form": minor
"@zodapp/zod-form-react": minor
"@zodapp/zod-form-mantine-lite": minor
"@zodapp/zod-form-mantine": minor
---

関数を受け取る meta の入力を `{ value, parent, context }` にそろえ、dynamic を実行時に決まる schema の土台として広げる。後方互換はない。

- `zf.derived` を `zf.computed` にまとめる。`compute` は `({ value, parent, context })` を受け取り、親を使うときは `dependsOnParent: true` を書く
- dynamic の resolve は `{ schema, key }`（同期）、`{ key, load }`（一度だけ届く）、`{ key, subscribe }`（何度でも届く）を返す。取得の key が同じあいだは取り直さない。key が利用者の編集で変わったときだけ値を新しい schema に合わせる。取り直し中は送信を止め、失敗は再試行できる
- 値の変更の出どころを記録する `useRunAsUserEdit` を足す
- string に `uiType: "select"` と `valueAction` を、enum に `valueAction` を足す。`externalKeyActionConfig` / `externalKeyActionResolver` は `valueAction` / `valueActionResolver` に改名
- externalKey を dynamic + ラッパーで作る。externalKey と file の config はただのデータにし、関数の形はなくす。externalKey に `allowUnlisted` と、config の同一性を書く `key`（省略可）を足す
- 表（AutoTable）で行の値を `TableRowProvider` で渡し、表用の dynamic の部品を足す
- 時刻だけを持つ `zf.time` を足す
- 開発用のモックを足す。`createMockTopic` は値を持って変更を購読者に届けるだけのオブジェクト、`createMockExternalKeyResolver` は topic の選択肢を届け、topic が変わるたびに届け直す。config の `filter` で、resolverContext を使って選択肢を絞れる
- `z.iso.datetime` の precision に合わせて書く。precision が無ければ `zf.time` と同じく unit の粒度で書く（minute / second は秒まで、millisecond はミリ秒まで）。unit が precision より細かいとエラーにする。union を包む preprocess を描画で外す
