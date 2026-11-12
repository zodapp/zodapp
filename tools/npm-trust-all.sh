#!/usr/bin/env bash
# 公開する @zodapp/* すべてに、npm の trusted publisher（GitHub Actions の release.yml）を登録する。
# 手順は docs/releasing.md を参照。
#
# macOS の bash 3.2 でも動くように書いている。
#
# 使い方:
#   tools/npm-trust-all.sh <owner>/<repo> [--env <GitHub の environment 名>] [--dry-run]
#
# 前提:
#   - npm 11.15.0 以上（npm trust を使う）、npm login 済み、アカウントの 2FA が有効
#   - 各パッケージが npm 上にすでにある（最初の公開を済ませている）
#   - 登録から 2 日以内に、CI からの最初の公開を成功させる（過ぎると設定が失効する）
#
# 最初の 1 件で 2FA を求められる。そこで「5 分間 2FA を省く」を選ぶと、残りは続けて登録できる。
set -euo pipefail

if [[ $# -lt 1 ]]; then
  sed -n '2,15p' "$0"
  exit 1
fi
repo="$1"
shift
extra=()
dry_run=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) extra+=(--env "$2"); shift 2 ;;
    --dry-run) dry_run=1; shift ;;
    *) echo "unknown option: $1" >&2; exit 1 ;;
  esac
done

root="$(cd "$(dirname "$0")/.." && pwd)"
names=()
while IFS= read -r line; do names+=("$line"); done < <(node -e '
const fs = require("fs"), path = require("path");
const dir = path.join(process.argv[1], "packages");
for (const d of fs.readdirSync(dir).sort()) {
  const f = path.join(dir, d, "package.json");
  if (!fs.existsSync(f)) continue;
  const p = JSON.parse(fs.readFileSync(f, "utf8"));
  if (p.name.startsWith("@zodapp/") && !p.private) console.log(p.name);
}' "$root")

echo "${#names[@]} packages → ${repo} (.github/workflows/release.yml)"
for name in "${names[@]}"; do
  cmd=(npm trust github "$name" --file release.yml --repo "$repo" --allow-publish --yes ${extra[@]+"${extra[@]}"})
  if [[ $dry_run -eq 1 ]]; then
    echo "${cmd[*]}"
  else
    echo "== $name"
    "${cmd[@]}"
    sleep 2
  fi
done
