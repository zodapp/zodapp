# apps/web

> この README は日本語版です。英語版は日本語レビュー・整合性チェック後に翻訳予定です。

## 概要

`apps/web` は、zodapp のデモ/検証用の Web アプリです。

- ルーティング: TanStack Router（コードベースルーティング）
- UI: React + Vite + Mantine
- データ: Firebase（Firestore）

## 開発

### 依存関係のインストール（リポジトリルートで）

```bash
pnpm install
```

### 開発サーバー

```bash
pnpm --filter web dev
```

- `http://localhost:3000`

### ビルド / 型チェック

```bash
pnpm --filter web check-types
pnpm --filter web build
```

## ルーティング構成

- ルート定義は `src/pages` 配下（例: `src/pages/router.tsx`）
- `src/routes` は使用していません

## Firebase 設定（必須）

`@repo/firebase` がリポジトリルートの `firebaseConfig.json` を読み込みます（gitignore 済みのためコミットしません）。

- ルートに `firebaseConfig.json` を作成し、Firebase コンソールの Web アプリ設定値を記入してください。

例:

```json
{
  "apiKey": "...",
  "authDomain": "...",
  "projectId": "...",
  "storageBucket": "...",
  "messagingSenderId": "...",
  "appId": "...",
  "measurementId": "..."
}
```

