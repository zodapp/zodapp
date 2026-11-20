# Changesets

公開する `@zodapp/*` に変更を入れたら、`pnpm changeset` で changeset を足してください。
27個は同じバージョンで出します（`config.json` の `fixed`）。
changeset は英語で書きます（npm の CHANGELOG に載るため）。

最初の公開（0.1.0）までは changeset を足しません。`initial-release.md`（27個すべてを minor、本文は「Initial release.」）の1件で出します。

公開の流れは [docs/releasing.md](../docs/releasing.md) を参照してください。
