#!/usr/bin/env node
// 公開する @zodapp/* の tarball（pnpm pack の結果）を確かめる。
// pnpm build のあとに動かす（ルートの pnpm check:pack）。
//
// 1. 入っていてほしいもの（package.json、LICENSE、dist/）がある
// 2. 入っていてはいけないもの（src、テスト、設定ファイルなど）がない
// 3. main / module / types / exports の行き先がすべて tarball の中にある
// 4. packed の package.json に workspace: が残っていない
// 5. repository / publishConfig / version がそろっている
// 6. LICENSE がリポジトリ直下のものと同じ
// 7. publint と attw（@arethetypeswrong/cli）で、package.json と型の解決を確かめる
// 8. tarball を一時ディレクトリに npm install し、各入口を Node の import() と require() で読む
//
// --no-smoke で 8 を、--no-lint で 7 を飛ばす。
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const args = new Set(process.argv.slice(2));
const runSmoke = !args.has("--no-smoke");
const runLint = !args.has("--no-lint");

const FORBIDDEN = [
  /^src\//,
  /\.(test|spec)\.[cm]?[jt]sx?$/,
  /(^|\/)tsconfig[^/]*\.json$/,
  /(^|\/)eslint\.config\.[cm]?js$/,
  /(^|\/)tsup\.config\.[cm]?ts$/,
  /(^|\/)vitest\.config\.[cm]?ts$/,
  /^docs\//,
  /^\.turbo\//,
  /^node_modules\//,
  /\.css$/,
  /\.tsbuildinfo$/,
];
const REQUIRED = ["package.json", "LICENSE"];

const errors = [];
const fail = (pkg, msg) => errors.push(`${pkg}: ${msg}`);
const run = (cmd, argv, opts = {}) =>
  execFileSync(cmd, argv, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  });

const rootLicense = fs.readFileSync(path.join(repoRoot, "LICENSE"), "utf8");
const packagesDir = path.join(repoRoot, "packages");
const packages = fs
  .readdirSync(packagesDir)
  .map((d) => path.join(packagesDir, d))
  .filter((d) => fs.existsSync(path.join(d, "package.json")))
  .map((dir) => ({
    dir,
    pj: JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")),
  }))
  .filter(({ pj }) => pj.name.startsWith("@zodapp/") && !pj.private);

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "zodapp-check-pack-"));
const tarballDir = path.join(workDir, "tarballs");
fs.mkdirSync(tarballDir);

const versions = new Set();
const packed = [];

// exports の値から、行き先のファイルパターンをすべて取り出す
const collectTargets = (value, out = []) => {
  if (typeof value === "string") out.push(value);
  else if (value && typeof value === "object")
    for (const v of Object.values(value)) collectTargets(v, out);
  return out;
};
const toRegExp = (pattern) =>
  new RegExp(
    "^" +
      pattern
        .replace(/^\.\//, "")
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, "(.+)") +
      "$",
  );

for (const { dir, pj } of packages) {
  const name = pj.name;
  const out = run("pnpm", ["pack", "--pack-destination", tarballDir], {
    cwd: dir,
  });
  const tarball = out
    .trim()
    .split("\n")
    .filter((l) => l.endsWith(".tgz"))
    .pop();
  if (!tarball || !fs.existsSync(tarball)) {
    fail(name, `pnpm pack の tarball が見つからない（${out.trim()}）`);
    continue;
  }
  const files = run("tar", ["-tzf", tarball])
    .split("\n")
    .filter(Boolean)
    .map((f) => f.replace(/^package\//, ""))
    .filter((f) => !f.endsWith("/"));
  const fileSet = new Set(files);

  // 1. 入っていてほしいもの
  for (const f of REQUIRED)
    if (!fileSet.has(f)) fail(name, `${f} が入っていない`);
  if (!files.some((f) => f.startsWith("dist/")))
    fail(name, "dist/ が入っていない");

  // 2. 入っていてはいけないもの
  for (const f of files)
    if (FORBIDDEN.some((re) => re.test(f)))
      fail(name, `入れてはいけないファイル: ${f}`);

  // packed の package.json と LICENSE を読む
  const extractDir = path.join(workDir, "extract", name.replace("/", "__"));
  fs.mkdirSync(extractDir, { recursive: true });
  run("tar", ["-xzf", tarball, "-C", extractDir]);
  const packedPj = JSON.parse(
    fs.readFileSync(path.join(extractDir, "package", "package.json"), "utf8"),
  );

  // 3. 行き先がすべて tarball の中にある
  const entryFiles = new Set();
  for (const field of ["main", "module", "types"]) {
    if (packedPj[field] && !fileSet.has(packedPj[field].replace(/^\.\//, "")))
      fail(name, `${field} の ${packedPj[field]} がない`);
  }
  const subpaths = [];
  for (const [key, value] of Object.entries(packedPj.exports ?? {})) {
    if (key === "./package.json") continue;
    for (const target of collectTargets(value)) {
      const re = toRegExp(target);
      const matched = files.filter((f) => re.test(f));
      if (matched.length === 0)
        fail(name, `exports の ${key} → ${target} に当たるファイルがない`);
      for (const m of matched) entryFiles.add(m);
    }
    // 煙試験で読む specifier（ワイルドカードは当たるファイルをすべて展開する）
    const importTarget =
      value?.import?.default ?? value?.import ?? value?.default;
    if (typeof importTarget !== "string") continue;
    if (key.includes("*")) {
      const re = toRegExp(importTarget);
      for (const f of files) {
        const m = re.exec(f);
        if (m) subpaths.push(key.replace("*", m[1]));
      }
    } else subpaths.push(key);
  }

  // 4. workspace: が残っていない
  for (const field of [
    "dependencies",
    "peerDependencies",
    "optionalDependencies",
  ]) {
    for (const [dep, spec] of Object.entries(packedPj[field] ?? {})) {
      if (String(spec).startsWith("workspace:"))
        fail(name, `${field} の ${dep} が ${spec} のまま`);
    }
  }

  // 5. メタデータ
  if (!packedPj.repository?.url) fail(name, "repository.url がない");
  if (packedPj.repository?.directory !== path.relative(repoRoot, dir))
    fail(name, "repository.directory がパッケージの場所と違う");
  if (packedPj.publishConfig?.access !== "public")
    fail(name, "publishConfig.access が public でない");
  if (packedPj.license !== "MIT") fail(name, "license が MIT でない");
  versions.add(packedPj.version);

  // 6. LICENSE
  const licensePath = path.join(extractDir, "package", "LICENSE");
  if (
    fs.existsSync(licensePath) &&
    fs.readFileSync(licensePath, "utf8") !== rootLicense
  )
    fail(name, "LICENSE がリポジトリ直下のものと違う");

  packed.push({ name, dir, tarball, subpaths, pj: packedPj });
}

if (versions.size > 1)
  errors.push(`version がそろっていない: ${[...versions].join(", ")}`);

// 7. publint と attw
if (runLint) {
  for (const { name, dir, tarball } of packed) {
    try {
      run(
        "pnpm",
        ["exec", "publint", "run", dir, "--pack", "pnpm", "--strict"],
        { cwd: repoRoot },
      );
    } catch (e) {
      fail(name, `publint:\n${(e.stdout || "") + (e.stderr || "")}`);
    }
    try {
      // node10 は subpath の exports を解決できないので見ない
      run(
        "pnpm",
        ["exec", "attw", tarball, "--profile", "node16", "--format", "ascii"],
        { cwd: repoRoot },
      );
    } catch (e) {
      fail(name, `attw:\n${(e.stdout || "") + (e.stderr || "")}`);
    }
  }
}

// 8. インストールの煙試験
if (runSmoke && errors.length === 0) {
  const smokeDir = path.join(workDir, "smoke");
  fs.mkdirSync(smokeDir);
  const deps = Object.fromEntries(
    packed.map(({ name, tarball }) => [name, `file:${tarball}`]),
  );
  fs.writeFileSync(
    path.join(smokeDir, "package.json"),
    JSON.stringify(
      {
        name: "zodapp-smoke",
        private: true,
        version: "0.0.0",
        dependencies: deps,
        overrides: deps,
      },
      null,
      2,
    ),
  );
  try {
    // peerDependencies（react、Mantine、express など）は npm が一緒に入れる
    run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], {
      cwd: smokeDir,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    errors.push(`npm install に失敗:\n${(e.stdout || "") + (e.stderr || "")}`);
  }
  if (errors.length === 0) {
    const specifiers = packed.flatMap(({ name, subpaths }) =>
      subpaths.map((s) =>
        s === "." ? name : `${name}/${s.replace(/^\.\//, "")}`,
      ),
    );
    fs.writeFileSync(
      path.join(smokeDir, "specifiers.json"),
      JSON.stringify(specifiers),
    );
    const esm = `
import fs from "node:fs";
const specs = JSON.parse(fs.readFileSync("./specifiers.json", "utf8"));
const failed = [];
for (const s of specs) { try { await import(s); } catch (e) { failed.push(s + ": " + e.message.split("\\n")[0]); } }
if (failed.length) { console.error(failed.join("\\n")); process.exit(1); }
console.log("import: " + specs.length + " entries");
`;
    const cjs = `
const specs = require("./specifiers.json");
const failed = [];
for (const s of specs) { try { require(s); } catch (e) { failed.push(s + ": " + e.message.split("\\n")[0]); } }
if (failed.length) { console.error(failed.join("\\n")); process.exit(1); }
console.log("require: " + specs.length + " entries");
`;
    fs.writeFileSync(path.join(smokeDir, "smoke.mjs"), esm);
    fs.writeFileSync(path.join(smokeDir, "smoke.cjs"), cjs);
    for (const file of ["smoke.mjs", "smoke.cjs"]) {
      try {
        process.stdout.write(run("node", [file], { cwd: smokeDir }));
      } catch (e) {
        errors.push(
          `煙試験（${file}）で読めない入口がある:\n${e.stderr || e.stdout}`,
        );
      }
    }
  }
}

if (errors.length) {
  console.error(`check:pack: ${errors.length} 件の問題\n`);
  for (const e of errors) console.error(`- ${e}`);
  console.error(`\n作業ディレクトリ: ${workDir}`);
  process.exit(1);
}
fs.rmSync(workDir, { recursive: true, force: true });
console.log(`check:pack: ${packed.length} パッケージ OK`);
