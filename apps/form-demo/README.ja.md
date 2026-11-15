# apps/form-demo

zodapp のフォームのデモです。1 つの Zod スキーマから生成されるフォーム UI のカタログ（入力型・レイアウト・カスタムウィジェット・動的スキーマなど）を収録しています。

- ルーティング：TanStack Router（コードで定義。`src/pages/router.tsx`）
- UI：React + Vite + Mantine
- データ：なし（DB に依存しない。ファイルの項目は `createMockFileResolver` で動かす）

DB を使うサンプルは、別のアプリにしています。

| アプリ                                         | 内容                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| [`apps/taskmanager`](../taskmanager/README.md) | タスク管理（DynamoDB、Cognito、S3、リアルタイム）                    |
| [`apps/survey`](../survey/README.md)           | アンケート（定義をデータとして保存し、実行時にスキーマを組み立てる） |

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
- e2e で確かめたいことは、メニューに出ない e2e 用のデモページ（`src/pages/form/schemas/e2e/`、formId は `e2e-` で始める）に置きます。`/form/detail?formId=e2e-dynamic` のように開けます
- すべてのデモページに、見るための部品（今の値・欄ごとのエラー・isDirty・送信した値と回数・ログ）を出します。同じ中身を `window.__formDemo` に置くので、e2e はそれを読みます

詳しくは `AGENT.md` を参照してください。

## GitHub Pages

main への push で、`.github/workflows/pages.yml` が `https://<owner>.github.io/zodapp/` に公開します。

- `pnpm --filter form-demo build:pages` は、`VITE_BASE=/zodapp/` でビルドし、直接開いた URL のために `index.html` を `404.html` にコピーします
- ルーターの `basepath` とロゴの URL は、`import.meta.env.BASE_URL` に合わせています
- 初回は、リポジトリの Settings → Pages で Source を「GitHub Actions」にします
