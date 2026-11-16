## apps/form-demo — フォームのデモ（@zodapp/zod-form-\* のサンプル）

`apps/form-demo` は、1 つの Zod スキーマから生成されるフォーム UI のカタログです。DB には依存しません。

- **ルーティング**: TanStack Router（コードベースルーティング）
- **UI**: React + Vite + Mantine
- **データ**: なし（ファイルの項目は `createMockFileResolver` で動かす）

DB を使うサンプルは別のアプリです（`apps/taskmanager`、`apps/survey`）。
外部キーやファイルを実際の保存先で扱う例は、そちらを参照してください。

参照: `apps/form-demo/README.ja.md`

---

## 最短起動（コピペ用）

```bash
# リポジトリルートで
pnpm install

# パッケージのビルド（apps はパッケージの dist を使う）
pnpm build

# Webアプリ起動
pnpm --filter form-demo dev

# 型チェック / ビルド
pnpm --filter form-demo check-types
pnpm --filter form-demo build
pnpm --filter form-demo build:pages   # GitHub Pages 向け（base: /zodapp/）

# E2E（Playwright。Vite は起動していなければ自動で起動する）
pnpm --filter form-demo e2e
```

E2E は `e2e/` に、デモページ 1 つにつき spec を 1 つ置きます。spec の手順は、そのページを開いて試す手順と同じにします。
`all-pages.spec.ts` は、サイドバーのすべてのページと、e2e 用のページがすべて開けて例外が起きないことを確かめます。

- ポートは `E2E_PORT`（既定 3000）で変えられる。別の作業コピーの dev サーバーを相手にしないよう、作業コピーごとに分けるときに使う（例：`E2E_PORT=3100 pnpm --filter form-demo e2e`）

### e2e のケースの置き場所

e2e で確かめたいことは、重なるデモページ（メニューに出るデモ）に置き、それに対して e2e を書きます。e2e が失敗したら、同じ URL を開いて同じ手順を手で試せます。

- 欄が足りなければ、そのデモに欄を足す
- 遅延の分け方の選択・止めておいた取得の「届ける」「失敗させる」・選択肢を届け直すボタンなど、フォームの外から動きを起こす操作は、「動きを試す」の枠（`src/shared/demo/TryBehavior.tsx`）にまとめる。説明は人が読んで分かる日本語で書く
- 人が開いたときの既定は、デモの見やすいふるまい（ms の遅延など）のままにする。テストは「動きを試す」で分け方を選んでから進める

#### e2e 用のページ（デモに向かないものだけ）

デモに向かないケース（わざと不正な値や古い形の初期値を持たせるなど）だけを、メニューに出ない e2e 用のページに置きます。今は `e2e-open-rewrite` だけです。

- 置き場所：`src/pages/form/schemas/e2e/`。登録簿は `schemas/e2e/index.ts` の `e2eSchemas`（コードのタブは `e2eCodes`）
- formId は `e2e-` で始める。`/form/detail?formId=e2e-…` で開ける（GitHub Pages のビルドにも含む）
- サイドバー・一覧・トップは `formSchemas` だけを使うので、e2e のページはメニューに出ない
- モジュールの形（`formId`・`title`・`description`・`schema`・`defaultValues`・`Component`）は、ほかのデモと同じ
- ページの説明（`description`）に書く手順と、spec の手順をそろえる

### 見るための部品（`E2eHarness`）と `window.__formDemo`

すべてのデモページに、見るための部品を置きます（`src/components/E2eHarness.tsx`。AutoForm の `actionComponents` に `createE2eHarness({ formId })` を渡す）。詳細ページの汎用の描画は、自動で置きます。

- 画面に、今の値・欄ごとのエラー・isDirty・送信した値と回数・ログ（開閉できる）を出す。「送信」のボタンも持つ
- 同じ中身を `window.__formDemo` に置く（`formId`・`values`・`errors.fields`・`errors.form`・`isDirty`・`submitted.count`・`submitted.values`・`log`）
- e2e は、値・エラー・回数・ログを `page.evaluate` で読む（`e2e/helpers.ts` の `formDemo`・`previewValue`・`logOf`）。変わるのを待つときは `expect.poll` を使う。プレビューの文字を JSON として読まない
- 利用者が見るもの（欄の表示・選択肢・エラーの文言・読み込み中や再試行の表示）は、画面で確かめる

部品を置かない（または一部だけの）ページと、その理由。e2e では、これらのページの値やエラーは画面で確かめる。

- `reactiveBasicInput`・`reactiveEnumSelect`・`reactiveNestedObject`・`reactiveReadOnly`・`reactiveRecord`：`ReactiveAutoForm` で描く。`ReactiveAutoForm` には `actionComponents` が無いので、部品も `window.__formDemo` も無い（今のプレビューだけ。`ReactiveAutoForm` に `actionComponents` は足さないと決めた）
- `tableView`：フォームではなく表（`AutoTable`）だけなので、部品も `window.__formDemo` も無い
- `formActions`：部品は置くが `submit: false`（このページは actions のボタンが主題なので、部品の「送信」を出さない）。`window.__formDemo` はある

ログ（`log`）の 1 件は `{ type, at, … }`（`at` はページを開いてからの ms）。

- `value`：値の変更。`changes` に、変わった欄ごとの `path`・`before`・`after`
- `fetch`：dynamic の取得。`kind`（`subscribe` は externalKey の購読、`load` は dynamic の load）・`field`・`key`・`result`（`called`・`delivered`・`failed`）。externalKey の resolver は欄を知らないので、`field` と `key` は topic
- `dynamic-status`：DOM の `data-dynamic-status` の移り変わり。`statuses` に、読み込み中・失敗の欄の `label` と `status`
- `submit`：送信。`result` は `attempted`・`passed`・`blocked`

### 遅延の分け方

デモページで取得の時機を作るときは、ms ではなく、何と競るかで分けます（`src/shared/demo/fetchControl.tsx`。`FetchControlPanel` を「動きを試す」の枠に置く。使っているページ：`dynamicAdvanced`・`externalKeyFilter`）。

- すぐ届く：externalKey は値のある topic を購読する。load は解決済みの Promise を返す
- 1 フレーム後・2 フレーム後：`requestAnimationFrame` を重ねてから届ける
- 止めておく：「届ける」「失敗させる」のボタンを押すまで届けない。読み込み中の操作はこれで作る
- 見やすい遅延：人が開いたときの既定（ms）。テストはこの数字に頼らない

テストは時間を待たず、画面の状態と `window.__formDemo` を待ちます。

---

## ディレクトリマップ（どこに何があるか）

- **エントリポイント**: `src/main.tsx` → `src/App.tsx`
- **ルーティング**
  - ルートツリー組み立て: `src/pages/router.tsx`（`basepath` は `import.meta.env.BASE_URL`）
  - ルート定義: `src/pages/**/*.route.ts`
- **共通UI**
  - 共通レイアウト: `src/components/CommonLayout.tsx`
  - 自動フォーム: `src/components/AutoForm.tsx`（`@zodapp/zod-form-widget/form` の re-export）
- **デモの一覧**: `src/shared/demos.tsx`（トップページのカードとヘッダーのバッジが共有する）
- **アプリ固有型（設計の拡張ポイント）**
  - file: `src/shared/types/fileConfig.ts`（Mock だけ）
  - resolverContext: `src/shared/types/resolverContext.ts`

---

## 逆引き（作りたいもの別）

### 1) フォームデモ（pages/form）に項目を追加したい

- スキーマファイルを `src/pages/form/schemas/` に追加し、
  `schemas/index.ts` に登録する（`?raw` import でコード表示タブも埋まる）
- AutoForm の props だけで表現できないデモは、スキーマモジュールから
  `Component` を export すると detail ページがそれを描画する
  （例: `schemaTransform.tsx` / `formActions.tsx` / `customWidget.tsx`）

### 2) カスタムフィールドウィジェットを作りたい

- **使うもの**: `wrapComponent` + `ZodFormInternalProps` + `useZodField`、
  componentLibrary への `{zodType}_{uiType}` キー登録
- **参照**: `src/pages/form/schemas/customWidget.tsx`
  （星評価 / カスケード選択の 2 例。`AutoForm` の `componentLibrary` prop で差し込む）

### 3) ページ/ルートを追加したい

- `src/pages/**/*.route.ts` にルートを定義し、`src/pages/router.tsx` のツリーに足す
- searchParams は route 側の `validateSearch` で型を決める（例: `src/pages/form/detail.route.ts`）

---

## @zodapp/\* 関連ドキュメント（入口）

- `@zodapp/zod-form`: `packages/zod-form/README.ja.md`
- `@zodapp/zod-form-react`: `packages/zod-form-react/README.ja.md`
- `@zodapp/zod-form-mantine`: `packages/zod-form-mantine/README.ja.md`
- `@zodapp/zod-searchparams`: `packages/zod-searchparams/README.ja.md`

---

## よくある落とし穴（このテンプレ特有）

- **画像などの URL は `import.meta.env.BASE_URL` から作る**
  - GitHub Pages では `/zodapp/` の下に置くため、`/` から始まる絶対パスは壊れる（`index.html` の中は Vite が書き換える）
- **searchParams は route 側で型を決める**
  - 画面側で好き勝手に `search` を組むのではなく、`*.route.ts` の `validateSearch` とセットで設計する
