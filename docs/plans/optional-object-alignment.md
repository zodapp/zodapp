# optional な object の縦位置と、空の検索条件の扱いを直すプラン

- ステータス: プラン（未実装）
- 対象ブランチ: `claude/project-thread-ua9i58`（このプランと同じブランチに実装を積む）
- 対象パッケージ: `@zodapp/zod-form-mantine`（`components/object.tsx`）
- 対象アプリ: `apps/taskmanager`、`apps/survey`（`web/components/mingoQuery.ts`）

---

## 1. 背景

taskmanager のプロジェクト一覧で、検索条件の UI が崩れている。

- 「プロジェクト名」に +/- ボタンが出る
- 隣の「ステータス」と縦位置（下端）がそろわない

原因は検索スキーマ（`apps/taskmanager/src/web/pages/taskManager-workspace/projects.route.ts`）の
`name` が `optional( object({ $contains: optional(string) }) )` になっていること。

1. zod-form-mantine の object コンポーネントは、optional な object（`required === false`）を
   0..1 の UI（`OptionalObjectImplement`）で描く。これが +/- の正体
2. `OptionalObjectImplement` は `marginTop: 15`・`marginBottom: 15`、枠線と padding を持つ。
   親の `horizontal-wrap` は `alignItems: flex-end`（下揃え）なので、この余白の分だけ隣と下端がずれる
3. `uiType: "flatten"` はどのパッケージにも実装がなく、何も効いていない

タスク一覧の `dueAt`（期限 From/To）も同じ optional object なので、同じ状態になっている。

あわせて、検索条件の値にも不具合がある。＋を押した直後や、入力を消した後の値は `{ name: {} }` になる。
`cleanQuery` は undefined しか落とさないため、mingo には `{ name: {} }` がそのまま渡る。
mingo 7 ではこれが「name が空 object と等しい」という条件になり、**0 件ヒット**になる。

---

## 2. 決まったこと

| 項目 | 決定 |
| --- | --- |
| 方針 | optional object の UI（+/-）は残し、縦位置だけをそろえる（バグ修正として扱う） |
| 検索スキーマの形 | 変えない。mingo のクエリと 1 対 1 の形（`q.name.$contains`）を保つ |
| `uiType: "flatten"` の実装 | しない（自動判定・オプトインのどちらも、今回は範囲外） |
| 空の検索条件 | `cleanQuery` で、中身を落とした結果が空になった object も落とす |
| survey の `mingoQuery.ts` | 同じコピーなので、同じ修正を入れる |

検討して採らなかった案:

- 検索スキーマを平らにして、mingo への変換を別の層で行う案。+/- もずれも根本から消えるが、
  mingo のクエリと 1 対 1 で対応する良さを失う
- optional object の下が「自分で空を表せる部品」ならパススルーする案。object には「空」を表す
  自然な値がなく（`{}` と undefined が同じかは用途による）、判定も再帰になるため、固定分岐では済まない

---

## 3. 変更内容

### 3.1 `OptionalObjectImplement` の縦位置（zod-form-mantine）

`packages/zod-form-mantine/src/components/object.tsx`

- 中身を包む `div` の `marginTop: 15`・`marginBottom: 15` を見直し、下端に余計な余白が残らないようにする
- 未設定（＋だけ）の状態: ＋ボタンの行の高さを、隣の入力欄（Mantine の Input の高さ）に合わせ、
  下揃えで＋が入力欄と同じ高さに来るようにする
- 設定済みの状態: 枠の中の入力欄の下端が、隣の入力欄の下端とそろうように、枠の padding と margin を調整する
- 縦並び（通常の object の中）でも、行間が不自然に詰まったり広がったりしないことを確かめる。
  縦並びで見た目が悪くなる場合は、横並びのときだけ効く形（親の `horizontal` / `horizontal-wrap` を
  context で子に伝えるなど）に切り替える。この切り替えが要るかどうかは実装中に判断し、要るなら止めて相談する

同じ 0..1 の余白（`marginTop: 15` / `marginBottom: 15`）は `array.tsx`・`record_entries.tsx`・`union.tsx`
にもある。今回は **object だけ**を直し、ほかは範囲外とする（同じ問題が見つかれば別途扱う）。

### 3.2 `cleanQuery` で空の object を落とす（taskmanager・survey）

`apps/taskmanager/src/web/components/mingoQuery.ts`、`apps/survey/src/web/components/mingoQuery.ts`

- 再帰で undefined を落とした結果、空になった plain object も undefined として落とす
  - 例: `{ name: { $contains: undefined }, status: "active" }` → `{ status: "active" }`
  - 例: `{ name: {} }` → `{}`（条件なし＝全件）
- Date / Set / Map と配列は、今と同じ扱いにする（空配列は落とさない）

### 3.3 検索スキーマの掃除（taskmanager）

`projects.route.ts` の `name` に付いている、効いていない `uiType: "flatten"` を外す。
`dueAt` は `horizontal-wrap` のままにする。

---

## 4. 確かめ方

- 単体テスト
  - `object.spec.tsx` の 0..1 UI のテスト（追加・削除）がそのまま通ること
  - `cleanQuery` のテストを足す（空 object を落とす、Date・配列は残す、ネストした空 object を落とす）
- 見た目（スクリーンショットで修正前後を比べる）
  - form-demo の `nestedObject`（縦並びの optional object）など、optional object を含むページ
  - taskmanager のプロジェクト一覧とタスク一覧の検索条件（＋だけの状態と、設定済みの状態）
    - taskmanager の起動はユーザーの Mac で行う。起動してよいかは事前に確認する
- `pnpm check-types` と `pnpm build` が通ること（AGENT.md の必須チェック）
- form-demo の e2e（`apps/form-demo/e2e/all-pages.spec.ts` など）が通ること
