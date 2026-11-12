# `@zodapp/*` を npm に公開できるようにするプラン

- ステータス: 実装済み（公開の準備まで）。実装で変えたところは 9章
- 対象ブランチ: `claude/project-thread-134yuz`（main から。このプランと同じブランチに実装を積む）
- 対象パッケージ: `packages/` の `@zodapp/*` のうち private でない22個
- 範囲: **公開の準備だけ**。npm への公開（Mac からの最初の公開、trusted publisher の登録）はこの作業では行わない

---

## 1. 決まったこと

| 項目 | 決定 |
| --- | --- |
| 公開する範囲 | `@zodapp/*` の22個。`@zodapp/zod-form-widget` と `@repo/*` は private のまま |
| バージョン | 全パッケージ同じバージョン（changesets の `fixed`）。最初の公開は `0.1.0`。この作業では `0.0.0` のまま |
| src を exports している6個 | ほかと同じく dist だけを exports する（ワークスペースでも dist を使う） |
| CSS Modules | `stringMultiline.module.css` をなくし、Mantine の `styles` prop に移す。公開するパッケージに CSS ファイルを持たない |
| 最初の公開 | `0.1.0` は Mac から手で出す。そのあと trusted publisher を登録し、以後は GitHub Actions から出す。この作業では手順書を書くだけで、実行しない |
| 公開の認証 | trusted publishing（OIDC）。npm のトークンは CI に置かない |
| 範囲外 | npm への公開そのもの、英語の README（リリースの直前に作る）、公開先のリポジトリ名の決定（掃除のスレッドで決める） |

公開する22個：

caching-utilities、react-storage、zod-dynamodb、zod-dynamodb-client、zod-dynamodb-express、
zod-dynamodb-mqtt、zod-dynamodb-node、zod-dynamodb-react、zod-dynamodb-realtime、zod-extendable、
zod-form、zod-form-dynamodb、zod-form-mantine、zod-form-mantine-lite、zod-form-react、zod-form-s3、
zod-form-s3-node、zod-propagating-registry、zod-searchparams、zod-tabular、zod-transform、zod-transport-json

（public なパッケージから private の zod-form-widget への依存はない。依存しているのは apps だけ）

---

## 2. 現状

- 15個は tsup で `dist` に ESM（`.js`）と CJS（`.cjs`）と型を出し、exports も dist を指している。
- 6個（react-storage、zod-form-mantine、zod-form-mantine-lite、zod-form-react、zod-searchparams、zod-tabular）は
  exports が `./src/*.ts(x)` を指していて、build は `rimraf dist && tsc`。npm から入れると TS のソースを読みに行くので使えない。
  - zod-form-mantine と zod-form-mantine-lite は `./components/*` のようなワイルドカードの exports を持つ。
- どのパッケージにも `files` がない。テスト、`tsconfig.json`、`eslint.config.mjs`、typedoc の `docs/api` まで入る。
- LICENSE はリポジトリの直下にしかない。各パッケージの README は `README.ja.md` だけ（npm は `README.ja.md` を自動では入れない）。
- zod-dynamodb 系の8個と zod-form-s3 系の2個は `repository`、`homepage`、`bugs`、`publishConfig` がない。
  ほかは `https://github.com/zodapp/zodapp.git` を指している。
- changesets も、公開のワークフローもない。

---

## 3. npm の trusted publishing について確かめたこと

npm のドキュメント（`npm/documentation` リポジトリの `trusted-publishers.mdx`、`npm-trust.mdx`、`staged-publishing.mdx`）から。

- npm CLI 11.5.1 以上、Node 22.14.0 以上が要る。GitHub-hosted runner だけで、self-hosted は使えない。
- ワークフローに `permissions: id-token: write` が要る。
- `package.json` の `repository.url` が、公開する GitHub リポジトリと完全に一致している必要がある。
- 登録するのは「GitHub の owner、リポジトリ名、ワークフローのファイル名（`.yml` まで）、任意で environment 名」。保存時には検証されず、間違いは公開するときに初めてわかる。
- **パッケージが npm 上にすでにあることが前提**（`npm trust` は「Package must exist」）。だから最初の `0.1.0` は Mac から出す。
- **登録してから2日以内に、最初の公開を成功させる必要がある。** 2日を過ぎると設定は失効し、作り直しになる。登録は、CI から最初に出す直前に行う。
- `npm trust github <pkg> --file release.yml --repo <owner>/<repo> --allow-publish --yes`（npm 11.15.0 以上）で、CLI からまとめて登録できる。最初の1回だけ 2FA を求められ、そこで「5分間 2FA を省く」を選べば、残りは続けて登録できる。呼び出しの間に2秒ほど空けることがすすめられている。
- 2026-09-03 以降に作った設定は、既定で `npm stage publish`（承認待ちの公開）だけが許される。CI から直接出すには `--allow-publish` を明示する。
- trusted publishing で出すと provenance は自動で付く。ただし **private リポジトリからは provenance が付かない**（公開そのものはできる）。
- 登録したら、パッケージの設定で「Require two-factor authentication and disallow tokens」にするのがすすめられている。

pnpm と changesets について：

- `changeset publish` は pnpm を検出すると `pnpm publish` を使う。pnpm 10 の `pnpm publish` は、tarball を作ったあと npm CLI に公開を任せるので、CI の npm が 11.5.1 以上なら OIDC が使える見込み。これは実装のときに確かめる（6.4）。
- `pnpm publish` は `workspace:*` を実際のバージョンに置き換える。

---

## 4. 変更の内容

### 4.1 6個を dist で出す

ほかの15個にそろえて tsup に切り替える。

- `tsup.config.ts` を足す。`format: ["esm", "cjs"]`、`dts: true`、`sourcemap: true`、`outExtension` で `.js` / `.cjs`。
  React のパッケージは `platform: "neutral"` ではなく `"browser"`、`external` は依存と peer をそのまま外に出す（tsup の既定）。
- entry は exports の各入口。ワイルドカードの exports（`./components/*`、`./baseComponents/*` など）は、
  そのディレクトリの `*.tsx` を glob で entry に入れ、dist の同じ場所に出す。
  ESM は `splitting` で共通部分を chunk にまとめる。
- exports を dist に書き換える（15個と同じ `types` / `import` / `require` の形）。ワイルドカードは
  `"./components/*": { "types": "./dist/components/*.d.ts", "import": "./dist/components/*.js", "require": "./dist/components/*.cjs" }`。
- `main`、`module`、`types` も15個と同じ形で足す。
- build を `tsup` に、`check-types` は `tsc --noEmit` のまま。
- mantine-lite の `./utils/*`（いまは CSS を外から読むためのもの）は、CSS をなくしたあとで要らなくなるので外す。
  ほかに使っているところがないかは実装のときに確かめる。

ワークスペースでも dist を使うようになるので、apps の dev でパッケージを書き換えたときはビルドが要る。

- 各パッケージに `"dev": "tsup --watch"` を足す（22個とも）。
- `turbo.json` の `dev` に `"dependsOn": ["^build"]` を足し、`pnpm --filter form-demo... dev` で依存のパッケージが watch で動くようにする。
- AGENT.md の開発コマンドの説明を合わせて直す。

### 4.2 CSS Modules をなくす

`packages/zod-form-mantine-lite/src/utils/stringMultiline.module.css` の1ルールを、
使っている2か所（mantine-lite の `reactiveComponents/string_multiline.tsx`、zod-form-mantine の `components/string_multiline.tsx`）で
Mantine の `styles` prop に移す。

```tsx
styles={{ input: { maxHeight: "var(--zod-form-string-multiline-max-height, none)", overflowY: "auto" } }}
```

- 呼び出し側から `styles` が渡されているときは、上書きせずにマージする（いまの `classNames` の扱いに合わせる）。
- 2か所で同じ値を使うので、mantine-lite の `utils` に定数として置き、zod-form-mantine はそれを import する。
- CSS ファイルを消し、mantine-lite と zod-form-mantine の `sideEffects` を `false` にする。
- `--zod-form-string-multiline-max-height` で上限を変える使い方は、そのまま残る。

zod-form-widget の `AutoTable.module.css` は、private のままなので今回は触らない。
将来公開するときは、ビルド済みの `styles.css` を `@layer` 付きで配る形を検討する。

### 4.3 npm に入れる中身を絞る

22個の `package.json` に `files` を足す。

```json
"files": ["dist", "README.md", "README.ja.md", "LICENSE"]
```

- `dist` の中のテストのビルド結果（あれば）が入らないよう、tsup の entry にテストを含めない。
- `LICENSE` は各パッケージのディレクトリに直下のものをコピーしてコミットする（npm は親ディレクトリのファイルを入れられないため）。
  直下の LICENSE と中身がずれていないかは、6.1 の検査で見る。
- `README.md`（英語）はこのプランの範囲外。いまはないので、`files` にあっても入らないだけで害はない。

### 4.4 package.json のメタデータをそろえる

22個すべてに、次をそろえる。

- `repository`（`type`、`url`、`directory`）、`homepage`、`bugs`、`publishConfig: { "access": "public" }`、`license: "MIT"`、`author`。
- `repository.url` は **公開先のリポジトリが決まってから** 入れる。決まるまでは、いまの `https://github.com/zodapp/zodapp.git` にそろえておく。
  trusted publishing は `repository.url` の完全一致を見るので、最初の公開の前に必ず確定させる。
- `engines.node` を `>=22` にそろえる（ルートに合わせる）。
- `version` はこの作業では `0.0.0` のまま。`0.1.0` にするのは公開する時点（5.1）。

### 4.5 `pnpm pack` の中身を確かめる検査

`tools/check-pack.mjs` を足し、ルートの `check:pack` から呼ぶ。`pnpm build` のあとに動かす。

22個それぞれについて `pnpm pack` で tarball を作り、次を確かめる。

1. **入っていてほしいもの**：`package.json`、`LICENSE`、`dist/`。
2. **入っていてはいけないもの**：`src/`、`*.test.*`、`tsconfig*.json`、`eslint.config.*`、`tsup.config.*`、`docs/`、`.turbo/`、`*.module.css`。
3. **exports の行き先がすべて tarball の中にある**：`main`、`module`、`types`、exports の各条件（ワイルドカードは展開して少なくとも1つ一致すること）。
4. **packed の `package.json` に `workspace:` が残っていない**。
5. **`repository.url` と `publishConfig.access` がそろっている**、`version` が全パッケージで同じ。
6. **LICENSE が直下のものと同じ**。

加えて、外部のツールを2つ使う（devDependencies に足す）。

- `publint`：package.json の exports や types の書き方の誤りを見る。
- `@arethetypeswrong/cli`（attw）：ESM / CJS それぞれの解決で型が正しく見えるかを見る。tarball を渡してローカルで動く。

さらに、tarball を一時ディレクトリに入れて、各入口を Node の `import()` と `require()` で読めるかを確かめる「インストールの煙試験」を足す。
React や Mantine を peer に持つパッケージは、peer を一時ディレクトリに入れたうえで読み込む。読み込みだけで描画はしない。

### 4.6 CI に検査を足す

`.github/workflows/ci.yml` の Build のあとに `pnpm check:pack` を足す。GitHub-hosted runner のふつうの Node 環境で動き、Docker 以外の外部サービスは使わない。

### 4.7 changesets

- `@changesets/cli` を devDependencies に足し、`.changeset/config.json` を置く。
  ```json
  {
    "$schema": "https://unpkg.com/@changesets/config/schema.json",
    "changelog": "@changesets/cli/changelog",
    "commit": false,
    "fixed": [["@zodapp/*"]],
    "linked": [],
    "access": "public",
    "baseBranch": "main",
    "updateInternalDependencies": "patch",
    "ignore": ["@zodapp/zod-form-widget"],
    "privatePackages": { "version": false, "tag": false }
  }
  ```
- ルートに `"changeset": "changeset"`、`"version-packages": "changeset version"`、`"release": "pnpm build && pnpm check:pack && changeset publish"` を足す。
- CONTRIBUTING（ja / en）に「変更には `pnpm changeset` で changeset を付ける」ことを足す。
- ルートの `CHANGELOG.md` / `CHANGELOG.ja.md` との関係：パッケージごとの CHANGELOG は changesets が作る。ルートのものは残し、扱いは実装のときに相談する。

### 4.8 公開のワークフロー

`.github/workflows/release.yml` を足す（trusted publisher にはこのファイル名で登録する）。

- きっかけ：**この作業では手動（`workflow_dispatch`）だけ**。main への push で動くと、npm の認証がないまま公開を試みて失敗するため。
  公開を始めるとき（5.2）に `push: branches: [main]` を足す。ファイルの先頭のコメントにもそう書いておく。
- `changesets/action` を使う。
  - 未公開の changeset があれば「Version Packages」の PR を作る（または更新する）。
  - その PR がマージされて changeset がなくなったら、`pnpm release` で公開する。
- permissions：`contents: write`、`pull-requests: write`、`id-token: write`。
- Node は 24（npm 11 が付いてくる）。念のため npm のバージョンを出力して 11.5.1 以上であることを確かめる手順を入れる。
- 公開のジョブは GitHub の environment `npm` で動かす。environment に「承認者」を付ければ、公開の直前に人の承認を挟める（7.1）。
- `NPM_TOKEN` は使わない。`setup-node` の `registry-url` も、OIDC の邪魔にならないよう付けない。
- リポジトリ名に依存する部分（trusted publisher の登録、`repository.url`）は、掃除のスレッドで決まる公開先に合わせる。
  ワークフローのファイル自体はリポジトリ名を書かずに済む。
- GitHub のリポジトリ設定で「Allow GitHub Actions to create and approve pull requests」を有効にしておく必要がある。

---

## 5. 公開の手順（ユーザが行うこと。この作業では実行しない）

手順書は `docs/releasing.md`（ja）として実装の中で書く。この作業で行うのは手順書と補助のスクリプトを用意するところまで。流れは次のとおり。

### 5.1 最初の公開（Mac から）

1. 公開先のリポジトリと `repository.url` が確定し、この作業が main に入っていること。
2. 22個の `version` を `0.1.0` にそろえるコミットを main に入れる。
3. Mac で npm 11.15.0 以上にする（`npm install -g npm@^11.15.0`）。npm のアカウントの 2FA を有効にしておく。
4. `npm login`。
5. `pnpm install --frozen-lockfile && pnpm build && pnpm check:pack`。
6. `pnpm -r --filter "./packages/*" publish --access public --no-git-checks`（private は自動で飛ばされる）。
   2FA の OTP を求められたら入力する。22個あるので、途中で失敗したら同じコマンドをもう一度実行すれば、出したものは飛ばされる。
7. `git tag` で各パッケージの `@zodapp/<name>@0.1.0` のタグを打って push する（`changeset tag` で打てる）。

この時点では provenance は付かない（手元から出すため）。

### 5.2 trusted publisher の登録（CI から最初に出す直前）

登録から2日以内に CI からの公開を成功させる必要があるので、最初の changeset を用意して「Version Packages」の PR ができてから行う。

1. 用意しておくスクリプト `tools/npm-trust-all.sh` を実行する。22個について
   `npm trust github @zodapp/<name> --file release.yml --repo <owner>/<repo> --env npm --allow-publish --yes` を2秒おきに呼ぶ。
   最初の 2FA で「5分間省く」を選ぶ。
2. release ワークフローに `push: branches: [main]` を足す。
3. 「Version Packages」の PR をマージし、release ワークフローの成功を確かめる。
4. 各パッケージの設定を「Require two-factor authentication and disallow tokens」にする（`npm access` で一括にできるかは実装のときに確かめ、できれば同じスクリプトに入れる）。

---

## 6. 確かめ方

1. `pnpm check-types`、`pnpm build`、`pnpm test`、`pnpm lint` が通る。
2. `pnpm check:pack` が通る（publint、attw、インストールの煙試験を含む）。
3. apps（form-demo、survey、taskmanager）が、dist に切り替えたあとも build でき、form-demo の dev で mantine 系のコンポーネントが表示される。
   複数行の文字列入力で、CSS 変数による高さの上限が効いていることを確かめる。
4. pnpm 10 の `pnpm publish` が npm CLI に公開を任せることを、`pnpm publish --dry-run` のログで確かめる。
   任せていない場合は、`release` を「`pnpm pack` で tarball を作り、`npm publish <tarball>` で出す」スクリプトに替える。
5. `changeset version` を空の changeset で試し、22個が同じバージョンに上がり、zod-form-widget と apps が上がらないことを確かめる（コミットはしない）。

---

## 7. 公開するときに決めること（この作業では保留）

### 7.1 CI から直接出すか、承認待ちの公開にするか

- **案A（おすすめ）**：trusted publisher は `--allow-publish`（直接公開）。人の確認は「Version Packages の PR をマージすること」と、GitHub の environment `npm` の承認者で挟む。
  changesets がそのまま使え、リリースごとの手間が小さい。
- **案B**：`--allow-stage-publish` だけにして、CI は `npm stage publish` で出し、ユーザが npm 上で22個を 2FA 付きで承認する。
  CI が乗っ取られても勝手に公開されないので一番固いが、changesets の `publish` は `npm stage publish` に対応していないので自前のスクリプトが要り、リリースごとに22個の承認が要る。

### 7.2 公開先のリポジトリが private のままの場合

provenance が付かない。公開はできるので、まず private のまま出し、リポジトリを公開したあとのリリースから provenance が付く形でもよいか。

---

## 8. コミットの単位（実装のとき）

1. 6個を tsup に切り替え、exports を dist にする（dev の watch と turbo の設定を含む）
2. `stringMultiline.module.css` を `styles` prop に移す
3. 22個の `files`、LICENSE、メタデータ、バージョンをそろえる
4. `tools/check-pack.mjs`、publint、attw、煙試験と CI への追加
5. changesets の導入
6. release ワークフロー（手動のみ）、`tools/npm-trust-all.sh`、`docs/releasing.md`

---

## 9. 実装で変えたところ

- **公開する数は22個だった**（プランを書いた時点で21個と数え違えていた）。一覧は1章のとおり。
- **ESM の拡張子を `.mjs` にした。** これまでの15個は `"type"` なしで ESM を `.js` に出していて、Node から `import` すると
  CJS として読まれて動かなかった。`"type": "module"` にするとソースの相対 import に拡張子が要るので、
  ESM は `.mjs` / `.d.mts`、CJS は `.cjs` / `.d.ts` に出し、exports の `import` / `require` でそれぞれの型を指す形にした。
- **dev 用のスクリプトは `dev` ではなく `watch` にした。** `dev` にすると、ルートの `pnpm dev`（`turbo run dev`）で
  22個の watch が persistent なタスクとして並び、turbo の並列数を超えるため。`turbo.json` の `dev` には `dependsOn: ["^build"]` を足した。
- **煙試験と attw で見つかった、公開前に直すべき問題を直した。**
  - zod-form-react の型が `@zodapp/zod-propagating-registry` を参照しているのに、dependencies になかった（利用側で meta の型が any になる）。
  - `dayjs/plugin/*` と `dayjs/locale/ja` を拡張子なしで import していて、Node の ESM で解決できなかった。
- **`repository.url` を書き換える `tools/set-repository.mjs` を足した。** 公開先が決まったら22個まとめて直せる。
- **最初のバージョンは changeset で上げる。** 0.0.0 から minor の changeset を1つ足せば、`fixed` で22個とも 0.1.0 になる（5.1 の手順 2 の代わり。docs/releasing.md）。
- **GitHub の environment はまだ付けていない。** 7.1 を決めるときに、release.yml と `tools/npm-trust-all.sh --env` に足す。
- 確かめたこと：`pnpm check-types`、`pnpm build`、`pnpm lint`（エラーなし）、`pnpm test`（DynamoDB Local）、`pnpm check:pack`
  （22個、106の入口を `import()` と `require()` で読めた）、form-demo の複数行の文字列入力で styles と CSS 変数の上限が効くこと、
  `pnpm publish --dry-run` が npm CLI に公開を任せていること、`changeset status` で22個が同じバージョンに上がること。
