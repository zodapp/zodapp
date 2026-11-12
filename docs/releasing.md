# `@zodapp/*` の公開

公開する `@zodapp/*` の22個（`packages/` のうち private でないもの）を npm に出す手順です。
22個は同じバージョンで出します（`.changeset/config.json` の `fixed`）。
`@zodapp/zod-form-widget`、`@repo/*`、apps は公開しません。

**いまの状態**：公開の準備だけが済んでいて、npm にはまだ1つも出していません。
`.github/workflows/release.yml` は手動でしか動かないようにしてあります。

---

## ふだんの流れ（公開を始めたあと）

1. 公開するパッケージを変えたら、PR に changeset を足す。
   ```bash
   pnpm changeset
   ```
2. PR を main にマージすると、release ワークフローが「Version Packages」の PR を作る（または更新する）。
   この PR が、バージョンと各パッケージの CHANGELOG.md を上げる。
3. 「Version Packages」の PR をマージすると、release ワークフローが npm に公開し、git のタグを打つ。

公開の前には `pnpm build` と `pnpm check:pack` が動きます（`pnpm release`）。
`check:pack` は npm に入る中身を確かめます（`tools/check-pack.mjs`）。CI でも毎回動きます。

---

## 公開を始めるときの手順

### 0. 前提をそろえる

- [ ] 公開するリポジトリが決まっている。
- [ ] 22個の `repository.url`、`homepage`、`bugs` を、公開するリポジトリに合わせる。
      npm の trusted publishing は `repository.url` が GitHub のリポジトリと完全に一致していることを見ます。
      ```bash
      # 例: <owner>/<repo> を公開先にする
      node -e '
      const fs = require("fs"), [repo] = process.argv.slice(1);
      for (const d of fs.readdirSync("packages")) {
        const f = `packages/${d}/package.json`; if (!fs.existsSync(f)) continue;
        const p = JSON.parse(fs.readFileSync(f, "utf8"));
        if (!p.name.startsWith("@zodapp/") || p.private) continue;
        p.repository.url = `https://github.com/${repo}.git`;
        p.homepage = `https://github.com/${repo}/tree/main/packages/${d}#readme`;
        p.bugs = { url: `https://github.com/${repo}/issues` };
        fs.writeFileSync(f, JSON.stringify(p, null, 2) + "\n");
      }' <owner>/<repo>
      ```
- [ ] 英語の README（`README.md`）を各パッケージに置く（`files` に入っているので、置けば npm に入る）。
- [ ] 下の「公開するときに決めること」を決める。
- [ ] GitHub のリポジトリの Settings → Actions → General で、
      「Allow GitHub Actions to create and approve pull requests」を有効にする（Version Packages の PR のため）。

### 1. 最初のバージョンを決める（0.1.0）

```bash
pnpm changeset            # 22個のどれか1つを選び、minor を選ぶ（fixed なので22個とも 0.1.0 になる）
pnpm version-packages     # package.json と CHANGELOG.md を 0.1.0 にする
```

これを PR にして main にマージします。

### 2. 最初の公開（Mac から）

npm の trusted publisher は、npm 上にパッケージがあるときだけ登録できます。そのため最初の1回は手元から出します。
この公開には provenance が付きません。

```bash
npm install -g npm@^11.15.0   # npm trust と trusted publishing のため
npm login                     # アカウントの 2FA を有効にしておく
git switch main && git pull
pnpm install --frozen-lockfile
pnpm release                  # build → check:pack → changeset publish（OTP を聞かれたら入れる）
git push --follow-tags        # changeset publish が打った @zodapp/<name>@0.1.0 のタグ
```

途中で失敗したら、もう一度 `pnpm release` を実行します。出したものは飛ばされます。

### 3. trusted publisher を登録し、CI からの公開に切り替える

**登録から2日以内に CI からの公開を成功させないと、設定が失効します。**
なので、次に出す changeset を用意して「Version Packages」の PR ができてから、続けて行います。

1. `.github/workflows/release.yml` の `on` に `push: branches: [main]` を足して、main にマージする。
   （以後、main への push で「Version Packages」の PR が作られる）
2. 22個に trusted publisher を登録する。
   ```bash
   tools/npm-trust-all.sh <owner>/<repo> --dry-run   # 実行するコマンドを確かめる
   tools/npm-trust-all.sh <owner>/<repo>             # 最初の 2FA で「5分間省く」を選ぶ
   ```
   GitHub の environment で承認を挟む場合は `--env <environment 名>` を付け、release.yml のジョブにも `environment:` を足す。
3. 「Version Packages」の PR をマージし、release ワークフローが成功したことを確かめる。
4. npm の各パッケージの Settings → Publishing access で、
   「Require two-factor authentication and disallow tokens」にする。trusted publishing はそのまま使えます。

---

## 公開するときに決めること

### CI から直接出すか、npm 上で承認してから出すか

- **直接出す**（`--allow-publish`、`tools/npm-trust-all.sh` の既定）：人の確認は「Version Packages の PR のマージ」。
  さらに挟むなら、GitHub の environment に承認者を付ける。changesets がそのまま使える。
- **承認してから出す**（`--allow-stage-publish`）：CI は `npm stage publish` で出し、npm 上で 2FA を使って承認するまで公開されない。
  CI が乗っ取られても勝手に公開されないが、`changeset publish` は `npm stage publish` に対応していないので自前のスクリプトが要り、
  リリースのたびに22個の承認が要る。

### 公開するリポジトリが private の場合

private のリポジトリからは provenance が付きません（公開そのものはできます）。
リポジトリを公開したあとのリリースから provenance が付きます。

---

## 参考

- npm: Trusted publishing（`npm/documentation` の `trusted-publishers.mdx`）
- npm: `npm trust`（`npm-trust.mdx`）、Staged publishing（`staged-publishing.mdx`）
- pnpm 10 の `pnpm publish` は、tarball を作ったあと実際の公開を npm CLI に任せます（`--dry-run` の出力が `npm notice` になる）。
  そのため CI の npm は 11.5.1 以上が要ります（release.yml で確かめています）。
