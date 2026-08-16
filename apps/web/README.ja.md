# apps/web

> この README は日本語版です。英語版は日本語レビュー・整合性チェック後に翻訳予定です。

## 概要

`apps/web` は、zodapp のデモ/検証用の Web アプリです。

- ルーティング: TanStack Router（コードベースルーティング）
- UI: React + Vite + Mantine
- データ: Firebase（Firestore）

### 収録デモ

| デモ | パス | 内容 |
| --- | --- | --- |
| フォームデモ | `/form` | 1 つの Zod スキーマから生成されるフォーム UI のカタログ（入力型・レイアウト・カスタムウィジェット・動的スキーマなど） |
| タスク管理デモ | `/taskManager` | マルチテナントの CRUD アプリ。一覧・検索（URL 連動）・CSV 入出力・列設定プロファイル・一括操作・権限制御 |
| アンケートデモ | `/survey` | 質問定義をデータとして保存し、**実行時にスキーマを組み立てて**回答フォームを生成。設定 + プレビューの 2 カラムビルダー、回答のアンケート横断一覧 |

アンケートデモはタスク管理と同じワークスペース（テナント）・同じ認証を共用しています。
見た目も共通なので、いまどちらを見ているかはヘッダーのバッジで分かるようにしています。

アンケートの回答ページ（`/survey/workspaces/:workspaceId/surveys/:surveyId/answer`）は
回答者向けの画面なので、管理画面のサイドバーは出ません。

### テストデータの投入

タスク管理・アンケートのどちらも、一覧ページの「…」メニュー →「テストデータ」から
専用ページへ移動できます。いま開いているワークスペースにデモ用のデータを作ります。

- **冪等な投入**: ID 固定のアンケート定義。何度実行しても増えません
- **繰り返し投入**: ダミーの回答・タスク。実行するたびに増えるので、
  無限スクロールや `useGrowingList` の挙動確認に使えます

アンケートのテストデータページからは「回答ページを開く」で回答ページを別タブで開けます。
ダミー回答を投入しながら手で回答して、同じ一覧に並ぶ様子を確認できます。

アンケート定義は CI のセキュリティルールテストと同じフィクスチャを使っているため、
テストと同じデータで実機の挙動を確認できます。

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

## エミュレータモード（本番プロジェクト不要）

`VITE_FIREBASE_EMULATOR=1` を付けて起動すると Firebase Emulator Suite
（auth: 9099 / firestore: 8080 / storage: 9199）に接続します。
`firebaseConfig.json` はダミー値で構いません。認証はメール/パスワードの
新規登録がそのまま使えます。

```bash
# ターミナル1: エミュレータ起動（リポジトリルート）
pnpm emulator

# ターミナル2: エミュレータ接続で起動
VITE_FIREBASE_EMULATOR=1 pnpm --filter web dev
```

