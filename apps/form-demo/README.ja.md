# apps/form-demo

zodapp のフォームのデモです。1 つの Zod スキーマから生成されるフォーム UI のカタログ（入力型・レイアウト・カスタムウィジェット・動的スキーマなど）を収録しています。

- ルーティング：TanStack Router（コードで定義。`src/pages/router.tsx`）
- UI：React + Vite + Mantine
- データ：なし（DB に依存しない。ファイルの項目は `createMockFileResolver` で動かす）

DB を使うサンプルは、別のアプリにしています。

| アプリ                                            | 内容                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| [`apps/taskmanager`](../taskmanager/README.ja.md) | タスク管理（DynamoDB、Cognito、S3、リアルタイム）                    |
| [`apps/survey`](../survey/README.ja.md)           | アンケート（定義をデータとして保存し、実行時にスキーマを組み立てる） |

## 起動

リポジトリのルートで依存関係を入れてから、開発サーバーを起動します。

```bash
pnpm install
pnpm build                    # apps はパッケージの dist を使う
pnpm --filter form-demo dev
```

- `http://localhost:3000`

## E2E

```bash
pnpm --filter form-demo e2e   # Vite は起動していなければ自動で起動する
E2E_PORT=3100 pnpm --filter form-demo e2e   # ポートを変える（既定 3000）
```

- spec は `e2e/` に、デモページ 1 つにつき 1 つ置き、手順はそのページを開いて試す手順と同じにします
- e2e で確かめたいことは、重なるデモページに置きます。遅延の分け方や選択肢を届け直すボタンなど、フォームの外から動きを起こす操作は、ページの「動きを試す」の枠にまとめます
- デモに向かないもの（わざと不正な値や古い形の初期値を持たせるなど）だけを、メニューに出ない e2e 用のページ（`src/pages/form/schemas/e2e/`、formId は `e2e-` で始める）に置きます。利用者が画面で触らない機能（送信する値の変換・そのまま送る型・扱えない型の注記・入れ物の refine・再帰の上限など）も、デモを細かく作らずここに置きます（`/form/detail?formId=e2e-open-rewrite` など）
- すべてのデモページに、見るための部品（今の値・欄ごとのエラー・isDirty・送信した値と回数・ログ）を出します。同じ中身を `window.__formDemo` に置くので、e2e はそれを読みます

詳しくは `AGENT.md` を参照してください。

## GitHub Pages

main への push で、`.github/workflows/pages.yml` が `https://<owner>.github.io/zodapp/` に公開します。

- `pnpm --filter form-demo build:pages` は、`VITE_BASE=/zodapp/` でビルドし、直接開いた URL のために `index.html` を `404.html` にコピーします
- ルーターの `basepath` とロゴの URL は、`import.meta.env.BASE_URL` に合わせています
- 初回は、リポジトリの Settings → Pages で Source を「GitHub Actions」にします
