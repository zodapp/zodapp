# `@zodapp/*` を npm に公開できる形にする

公開の準備だけを行った記録です（npm への公開そのものは [docs/releasing.md](../releasing.md) の手順で行う）。今の形は [公開するパッケージの形](../releasing.md#公開するパッケージの形) にあります。

## 目的

`packages/` の `@zodapp/*` を、npm から入れてそのまま使える形にする。取り込んだ時点では、6 個が `src` の TS を exports していて npm から使えず、どのパッケージも `files` を持たず、テストや設定ファイルまで tarball に入る状態だった。`@zodapp/zod-form-widget` は、はじめ private のまま残し、あとで公開に変えた。

## 決めたこと

- **公開する範囲**：`@zodapp/*` の 23 個。`@repo/*` と apps は公開しない
- **バージョン**：23 個を同じバージョンで出す（changesets の `fixed`）。最初は `0.1.0`
- **dist だけを exports する**：ワークスペースの中でも dist を使い、利用者と同じものを試す
- **ESM は `.mjs`、CJS は `.cjs`**：`"type"` なしで ESM を `.js` に出すと、Node が CJS として読んで動かなかった。`"type": "module"` にするとソースの相対 import に拡張子が要るので、拡張子で分けた
- **JS から CSS を import しない**：利用者のバンドラーに CSS の扱いを求めないため。zod-form-mantine の CSS Modules は Mantine の `styles` prop に移した。CSS が要る zod-form-widget は、ビルド済みの `dist/styles.css` と `@layer zodapp` 付きの `styles.layer.css` を出し、利用者が import する（Mantine と同じ）
- **import しただけで副作用を起こさない**：zod-form-widget の `./i18n/ja` は `z.config()` を呼んでアプリ全体の zod の文言を書き換えていたので、`jaErrorMap` を export するだけにし、`z.config()` は利用者が呼ぶ
- **中身を検査する**：`pnpm check:pack` で、tarball の中身、exports の行き先、publint・attw、Node での `import()` / `require()` を毎回 CI で確かめる。煙試験で、dependencies の漏れや拡張子なしの import など、公開してから気づく誤りが見つかった
- **公開の認証**：trusted publishing（OIDC）。npm のトークンは CI に置かない。trusted publisher はパッケージが npm にあることが前提なので、最初の `0.1.0` だけは手元から出す
- **公開のワークフロー**：準備の段階では手動でしか動かさない（認証のないまま main への push で公開を試みないため）

## 採らなかった案

- **承認待ちの公開（`npm stage publish`）を標準にする**：CI が乗っ取られても勝手に公開されない一番固い形だが、changesets が対応しておらず、リリースごとに 23 個の承認が要る。CI から直接出し、人の確認は「Version Packages」の PR のマージで挟む形を基本にした（[docs/releasing.md](../releasing.md) の「公開するときに決めること」）
