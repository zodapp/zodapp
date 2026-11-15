# `@zodapp/zod-form-widget` を公開できるようにするプラン

- ステータス: プラン（実装未着手）
- 対象ブランチ: `claude/project-thread-3gbpgw`（このプランと同じブランチに実装を積む）
- 対象パッケージ: `@zodapp/zod-form-widget`（影響を受ける利用側: `apps/form-demo`、`apps/survey`、`apps/taskmanager`）
- 範囲: **公開の準備だけ**。npm への公開そのものは、ほかの22個と同じ手順（`docs/releasing.md`）で行う

---

## 1. 背景

zod-form-widget は、zodapp から取り込んだ時点（cc96bb8）で `"private": true` だった。
npm 公開の準備（`docs/plans/npm-publish.md`）でも private のまま残し、changesets の `ignore` に入れた。
いまの状態では、次の理由で公開できない。

- exports が `./src/*.ts` を指していて、build も dist もない
- `src/table/AutoTable.module.css` を JS から import している（CSS Modules のソースのまま）
- `./i18n/ja` は import しただけで `z.config()` を呼び、利用者のアプリ全体の zod のエラーメッセージを書き換える
- `@mantine/dropzone` を dependencies に `^9.6.3` で持つ（peer の `@mantine/core` は `^8 || ^9`）
- README、LICENSE、`files`、`repository` などがない

UI の文言が日本語で固定されている問題は、zod-form-mantine・zod-form-mantine-lite にも同じものがあるため、
widget 独自の問題として扱わず、**このプランの範囲外**とする（別のスレッドと PR で扱う）。

---

## 2. 決まったこと

| 項目 | 決定 |
| --- | --- |
| CSS の配り方 | ビルドで `dist/styles.css` に書き出す。利用者が `import "@zodapp/zod-form-widget/styles.css"` を自分で書く（Mantine と同じ）。JS からは CSS を import しない |
| `@layer` | `@layer zodapp` で包んだ `dist/styles.layer.css` も出す（Mantine の `styles.layer.css` にならう） |
| クラス名 | 公開 API にしない（ビルドが付ける名前のまま。利用者は名前に依存しない） |
| テーマ | `white` 固定の背景を Mantine のテーマ変数に置き換える |
| `./i18n/ja` | 副作用をなくし、`jaErrorMap` を関数として export する。`z.config()` は利用者が呼ぶ |
| 依存とビルド | ほかの22個と同じ形にそろえる（機械的に直す） |
| UI 文言の i18n | 範囲外（別のスレッドと PR） |

---

## 3. やること

### 3.1 ビルドを tsup にし、dist を exports する

ほかのパッケージ（zod-form-mantine など）と同じ形にする。

- `tsup.config.ts` を足す。入口は `src/index.ts`、`src/table/index.ts`、`src/tabular/index.ts`、`src/form/index.ts`、
  `src/feedback/index.ts`、`src/i18n/ja.ts`（3.3）。`format: ["esm", "cjs"]`、`dts: true`、`splitting: true`、`.mjs` / `.cjs`。
- `package.json` の `main` / `module` / `types` / `exports` を dist に向ける。入口は今と同じ
  `.`、`./table`、`./tabular`、`./form`、`./feedback`、`./i18n/ja`。`./styles.css`、`./styles.layer.css`、`./package.json` を足す。
- `scripts` に `build`（`tsup`）、`watch`、`docs:typedoc` を足す。devDependencies に `tsup`、`tslib` を足す。
- `files`（`dist`、`README.md`、`README.ja.md`、`LICENSE`）、`repository`、`homepage`、`bugs`、`keywords`、
  `engines`、`publishConfig: { access: "public" }` を足す。値はほかのパッケージにそろえる。
- `"private": true` を外す。
- `LICENSE`（リポジトリ直下と同じ）と `README.ja.md` を足す。README には、styles.css の読み込み方（3.2）と
  `jaErrorMap` の使い方（3.3）を書く。

### 3.2 CSS を dist に書き出す

- `AutoTable.module.css` は CSS Modules のまま書く。tsup（esbuild）の `local-css` で、JS 側にはクラス名だけが残り、
  CSS は入口ごとの `.css` として出る。
- ビルドのあとに小さなスクリプト（`packages/zod-form-widget/scripts/build-css.mjs`、tsup の `onSuccess` から呼ぶ）で、
  - 入口ごとに出た `.css` を1つにまとめて `dist/styles.css` にする（同じ CSS が複数の入口に出るので重複を除く）
  - `@layer zodapp { ... }` で包んだ `dist/styles.layer.css` を作る
  - 入口ごとの `.css` は消す（JS から参照されていないことを確かめたうえで）
- `sideEffects` を `["*.css"]` にする（3.3 で i18n の副作用がなくなるため）。
- **実装で確かめること**：esbuild が付けるクラス名が、ESM・CJS・各入口で同じになること。
  ずれる場合は、tsup の `esbuildOptions` でクラス名の付け方を固定するか、CSS だけ別の esbuild で1回ビルドする。
- `src/env.d.ts` の `*.module.css` の宣言は残す（tsc と dts のため）。dts のビルドで CSS の import が型として通ることも確かめる。

### 3.3 `./i18n/ja` の副作用をなくす

- `src/i18n/zod-errormap.ja.ts` を `src/i18n/ja.ts` にし、末尾の `z.config({ customError: jaErrorMap })` を消して
  `export const jaErrorMap` にする。
- 利用者は次のように書く（README と apps に載せる）。
  ```ts
  import { z } from "zod";
  import { jaErrorMap } from "@zodapp/zod-form-widget/i18n/ja";
  z.config({ customError: jaErrorMap });
  ```
- apps の `zod-errormap.ja.ts`（form-demo、survey）を上の形に直す。

### 3.4 テーマへの追従

`AutoTable.module.css` の `white` を置き換える。

- `.stickyHeaderRow`、`.headerCell` の `background-color: white` → `var(--mantine-color-body)`
- `.previewHeaderCell[data-focused='true']` の `color-mix(..., white)` → `color-mix(..., var(--mantine-color-body))`

### 3.5 依存の宣言をそろえる

- `@mantine/dropzone` を dependencies から外し、peerDependencies に `^8.2.7 || ^9.0.0`、devDependencies に `^9.6.3` で入れる
  （zod-form-mantine と同じ）。
- zod-form-mantine が peer に持つ `@mantine/dates` も peer に足す（widget を入れた利用者が満たす必要があるため）。
- そのほかの依存（`@dnd-kit/*`、`@tanstack/react-virtual`、`lodash` など）は、ほかのパッケージと版をそろえる。

### 3.6 apps

- `main.tsx`（form-demo、survey、taskmanager）で、`@mantine/*/styles.css` のあとに
  `import "@zodapp/zod-form-widget/styles.css";` を足す。
- 3.3 の errormap の書き換え。
- ワークスペースでも dist を使うので、apps の dev / build の前に widget がビルドされることを確かめる（turbo の `^build`）。

### 3.7 公開の設定と検査

- `.changeset/config.json` の `ignore` から `@zodapp/zod-form-widget` を外す（`fixed` の `@zodapp/*` に入り、23個が同じバージョンになる）。
- `tools/check-pack.mjs`
  - `FORBIDDEN` の `/\.css$/` を、`dist/` の下の CSS は許すように変える
  - exports の行き先の確認（3）と Node での読み込み（8）で、`.css` の入口は「tarball にあること」だけを確かめ、`import()` / `require()` はしない
- 文書
  - `docs/releasing.md`：公開しないものから widget を外し、22個 → 23個にする
  - `docs/plans/npm-publish.md`：widget を private とした記述に、このプランで公開に変えたことを書き足す
  - `AGENT.md:46` の「（private）」を消す

---

## 4. 確かめること

1. `pnpm build`、`pnpm check-types`、`pnpm lint`、`pnpm test` が通る
2. `pnpm check:pack` が通り、widget の tarball に `dist/styles.css` と `dist/styles.layer.css` が入り、`src` が入らない
3. `dist/styles.css` のクラス名と、dist の JS（ESM・CJS）が参照するクラス名が一致する
4. `changeset version` を空の changeset で試し、widget がほかの22個と同じバージョンに上がることを確かめる（コミットはしない）
5. apps（form-demo、survey、taskmanager）がビルドでき、form-demo の AutoTable の見た目が変わっていないことを、
   ライトとダークの両方でスクリーンショットで確かめる

---

## 5. 範囲外

- UI 文言の i18n（mantine・mantine-lite と一緒に、別のスレッドと PR で扱う）
- AutoTable に `classNames` / `styles` の prop を足すこと（公開後に要望が出てから）
- 英語の README、npm への公開そのもの（ほかの22個と同じく、リリースの直前に行う）
