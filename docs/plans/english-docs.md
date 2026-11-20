# 日本語だけの文書を英語にするプラン

- ステータス: プラン（レビュー中）
- 対象ブランチ: `claude/project-thread-h2kxja`
- 前提の main: ce139e2（PR #38・#39 をマージ済み）
- 対象: `packages/*/docs/`、`apps/taskmanager`・`apps/survey` の README、`packages/zod-searchparams/tanstack.md`、ルートの開発者向け文書、`docs/plans` → `docs/archive` の移動

---

## 1. 背景

PR #38 で全パッケージの README を英語（`README.md`）と日本語（`README.ja.md`）の 2 本にした。
しかし README からリンクしている仕様（`packages/*/docs/*.ja.md`）と、一部のアプリの README、開発者向けの文書は日本語だけで、
英語 README からは「(Japanese)」と断ってリンクしている。

## 2. 方針

| 種類                                            | 扱い                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------- |
| 利用者向け（仕様・アプリの README・利用ガイド） | 英語の `<名前>.md` を作り、日本語の `<名前>.ja.md` を残す（日英 2 本） |
| 開発者・エージェント向け                        | 英語 1 本に置き換える（2 本あると片方だけ直されてずれるため）          |
| `docs/plans/`・`docs/archive/`                  | 日本語のまま（plans は日本語で管理する）                               |

- 英語を正とする。今後、利用者向けの文書を直すときは英語と日本語の両方を直す
- 訳は PR #38 の英語 README に文体と用語をそろえる（短い文、現在形、「〜である／〜する」の仕様の書き方はそのまま）
- コード例・コード中のコメント・UI に出る日本語の文言（例：`/* i18n: タイトル */`、form-demo の「動きを試す」）は訳さない

## 3. 対象

### 3.1 日英 2 本にする（英語版を新しく作る）

`packages/*/docs/*.ja.md` の 22 本（約 210KB）。英語版は同じディレクトリに `.ja` を外した名前で作る。

| パッケージ              | 文書                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `i18n-messages`         | `library-messages`                                                                  |
| `zod-dynamodb`          | `physical-layout`、`protocol`、`realtime`、`shared-definitions`、`table-definition` |
| `zod-dynamodb-client`   | `client-api`、`live-sync`                                                           |
| `zod-dynamodb-node`     | `queries`、`repository`、`server-api`、`vector-search`、`writes`                    |
| `zod-dynamodb-realtime` | `gateway`                                                                           |
| `zod-form`              | `default-value`                                                                     |
| `zod-form-mantine`      | `badge`、`intersection`、`object`、`schema-types`、`union`                          |
| `zod-form-react`        | `container-touch`、`dynamic`、`errors`                                              |

ほかに次の 3 本。

| 今のファイル                                      | 変更後                                               |
| ------------------------------------------------- | ---------------------------------------------------- |
| `apps/taskmanager/README.md`（日本語）            | `README.ja.md` に移し、英語の `README.md` を作る     |
| `apps/survey/README.md`（日本語）                 | 同上                                                 |
| `packages/zod-searchparams/tanstack.md`（日本語） | `tanstack.ja.md` に移し、英語の `tanstack.md` を作る |

### 3.2 英語 1 本に置き換える

- `AGENT.md`（ルート）
- `apps/form-demo/AGENT.md`
- `GUIDE_TO_TURBOREPO.md`
- `docs/releasing.md`
- `.changeset/README.md`
- `.github/workflows/release.yml` の日本語のコメント

### 3.3 `docs/plans/` から `docs/archive/` に移す（日本語のまま）

ステータスが「実装済み」の 2 本。AGENT.md の決まりどおり、仕様が README か `docs/` に入っていることを確かめてから、意図だけに絞って移す。

- `docs/plans/partial-record-enum-keys.md`（仕様は `zod-form-mantine/docs/schema-types` にある）
- `docs/plans/dynamic-validate-parse.md`（PR #39 でマージ済み。仕様は `zod-form-react/docs/dynamic` などにあるはず。足りなければ仕様を先に足す）

`docs/plans/same-path-experiment.md`（未実装）と、このプランは `docs/plans/` に残す。
このプランは、実装が終わったら同じ決まりで `docs/archive/` に移す。

### 3.4 対象外

- `docs/archive/`、`docs/plans/` の中身（日本語のまま）
- `CHANGELOG.md`（changesets が作る）
- すでに日英 2 本になっている README・`CONTRIBUTING`・`CODE_OF_CONDUCT`・`SECURITY`

## 4. リンク

- 各文書の冒頭（見出しの下）に、README と同じ形で相互リンクを置く。英語版に `[日本語](<名前>.ja.md)`、日本語版に `[English](<名前>.md)`
- 英語版の文書同士のリンクは英語版に向ける（日本語版の中のリンクは日本語版のまま）。`docs/*.ja.md` の中のリンクは今 32 種類ある
- 英語 README の「(Japanese)」「, in Japanese」「Detailed specifications (Japanese)」付きのリンク（11 パッケージ・21 か所）を英語版に向け、その断り書きを消す
  - `i18n-messages`、`zod-dynamodb`、`zod-dynamodb-client`、`zod-dynamodb-express`、`zod-dynamodb-mqtt`、`zod-dynamodb-node`、`zod-dynamodb-react`、`zod-dynamodb-realtime`、`zod-form`、`zod-form-mantine`、`zod-form-react`
- 日本語 README（`README.ja.md`）からのリンクは `.ja.md` のまま
- 英語 1 本にした文書を指すリンク（`.changeset/README.md` → `docs/releasing.md`、AGENT.md → `GUIDE_TO_TURBOREPO.md` など）はファイル名が変わらないのでそのまま
- AGENT.md の中で `README.ja.md` を指している箇所（「コンセプトは README.ja.md」など）は `README.md` に向ける

## 5. 書き方の決まりの変更（AGENT.md「文書の置き場所」）

| 書くもの                 | 変更後の置き場所                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| 使い方                   | 各パッケージ・アプリの `README.md`（英語）と `README.ja.md`（日本語）                                                 |
| 動きの決まり（仕様）     | `packages/<名前>/docs/<テーマ>.md`（英語）と `<テーマ>.ja.md`（日本語）。README から節ごとにリンクする                |
| 実装前のプラン           | `docs/plans/`（日本語）。実装したら、仕様を README か `docs/` に移し、プランは意図だけに絞って `docs/archive/` に移す |
| 経緯（決めたことと理由） | `docs/archive/`（日本語）。コードに合わせて直さない                                                                   |
| 公開の手順               | `docs/releasing.md`（英語）                                                                                           |

あわせて次を足す。

- 利用者向けの文書は英語を正とし、直すときは日本語版も同じ変更をする
- 開発者・エージェント向けの文書（AGENT.md など）は英語だけで書く

## 6. 確かめ方

- 変更したすべての `.md` について、相対リンクの先が存在することをスクリプトで確かめる（アンカーも含める）
- 英語版の文書（`docs/*.md`、README、AGENT.md など）に日本語の文が残っていないことを確かめる（コード例と UI の文言は除く）
- 日英の各組で、見出しの数と並びがそろっていることを確かめる
- `pnpm format` 相当で prettier の差分が出ないこと
- 英語 README から `.ja.md` へのリンクが残っていないこと（`grep`）

## 7. コミットの単位

1. `docs/plans` の実装済み 2 本を `docs/archive` に移す
2. パッケージごとに `docs/*.md` の英語版を足し、そのパッケージの英語 README のリンクを直す（8 コミット程度）
3. `apps/taskmanager`・`apps/survey` の README を日英 2 本にする
4. `zod-searchparams/tanstack.md` を日英 2 本にする
5. 開発者向けの文書を英語 1 本にする（AGENT.md の「文書の置き場所」の変更を含む）
6. 全体のリンクの確認で見つかった直し

PR は 1 本にまとめる。
