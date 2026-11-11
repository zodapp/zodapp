## コントリビュート（Contributing）

**zodapp** への貢献に興味を持っていただきありがとうございます。

## 開発環境のセットアップ

- 必要要件
  - Node.js **>= 22**
  - pnpm（ルートの `packageManager` を参照）

```bash
pnpm install
pnpm lint
pnpm check-types
pnpm dynamodb:start   # zod-dynamodb 系とサンプルのテストが使う DynamoDB Local（Docker）
pnpm test
pnpm dynamodb:stop
pnpm build
```

## モノレポに関する補足

- パッケージは `packages/*` 配下です
- サンプルは `apps/*` 配下です（`form-demo`：DB 非依存のフォームのデモ、`taskmanager`・`survey`：DynamoDB を使うサンプル。E2E は各アプリの README を参照）
- 特定のパッケージ/アプリに対して script を実行する場合:

```bash
pnpm --filter <name> <script>
```

例:

```bash
pnpm --filter form-demo dev
pnpm --filter @zodapp/zod-form test
```

## Pull Request

- 可能な限り変更は小さく・焦点を絞ってください
- 挙動が変わる場合はテストを追加/更新してください
- 公開APIを変更した場合はドキュメントも更新してください
- ローカルでCI相当が通ることを確認してください（`pnpm lint && pnpm check-types && pnpm test`）

## セキュリティ報告

公開Issueでの報告は **行わないでください**。`SECURITY.md` を参照してください。
