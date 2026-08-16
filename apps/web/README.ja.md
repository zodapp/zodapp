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
| アプリデモ（タスク管理） | `/taskManager` | マルチテナントの CRUD アプリ。一覧・検索（URL 連動）・CSV 入出力・列設定プロファイル・一括操作・権限制御 |
| アンケートデモ | `/survey` | 質問定義をデータとして保存し、**実行時にスキーマを組み立てて**回答フォームを生成。設定 + プレビューの 2 カラムビルダー、回答のアンケート横断一覧 |

アンケートデモはタスク管理と同じワークスペース（テナント）・同じ認証を共用しています。

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

