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

# Webアプリ起動
pnpm --filter form-demo dev

# 型チェック / ビルド
pnpm --filter form-demo check-types
pnpm --filter form-demo build
pnpm --filter form-demo build:pages   # GitHub Pages 向け（base: /zodapp/）
```

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
