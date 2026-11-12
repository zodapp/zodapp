#!/usr/bin/env node
// 公開する @zodapp/* の repository.url、homepage、bugs を、公開するリポジトリに合わせる。
// npm の trusted publishing は repository.url が GitHub のリポジトリと完全に一致していることを見る。
//
// 使い方: node tools/set-repository.mjs <owner>/<repo>
import fs from "node:fs";
import path from "node:path";

const repo = process.argv[2];
if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
  console.error("使い方: node tools/set-repository.mjs <owner>/<repo>");
  process.exit(1);
}
const packagesDir = path.resolve(import.meta.dirname, "..", "packages");
let count = 0;
for (const d of fs.readdirSync(packagesDir).sort()) {
  const f = path.join(packagesDir, d, "package.json");
  if (!fs.existsSync(f)) continue;
  const p = JSON.parse(fs.readFileSync(f, "utf8"));
  if (!p.name.startsWith("@zodapp/") || p.private) continue;
  p.repository = {
    type: "git",
    url: `https://github.com/${repo}.git`,
    directory: `packages/${d}`,
  };
  p.homepage = `https://github.com/${repo}/tree/main/packages/${d}#readme`;
  p.bugs = { url: `https://github.com/${repo}/issues` };
  fs.writeFileSync(f, JSON.stringify(p, null, 2) + "\n");
  count++;
}
console.log(`${count} packages → https://github.com/${repo}`);
console.log(
  'pnpm exec prettier --write "packages/*/package.json" で整えてください。',
);
