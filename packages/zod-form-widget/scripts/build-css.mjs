// tsup が入口ごとに書き出した CSS を、dist/styles.css と dist/styles.layer.css にまとめる。
// tsup.config.ts の onSuccess から呼ぶ。
//
// - CSS Modules は esbuild の local-css で変換済み（クラス名は JS 側の値と一致している）
// - 同じ CSS が複数の入口に出るので、元のファイル（"/* src/... */" の見出し）ごとに重複を除く
// - 入口ごとの .css と .css.map は消す（JS からは参照されていない）
import fs from "node:fs";
import path from "node:path";

const LAYER = "zodapp";
const OUTPUTS = new Set(["styles.css", "styles.layer.css"]);

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });

export function buildCss(distDir) {
  const cssFiles = walk(distDir)
    .filter((f) => f.endsWith(".css") && !OUTPUTS.has(path.relative(distDir, f)))
    .sort();

  // "/* src/table/AutoTable.module.css */" で始まる塊ごとに分ける
  const blocks = new Map();
  for (const file of cssFiles) {
    const text = fs
      .readFileSync(file, "utf8")
      .replace(/\/\*# sourceMappingURL=.*?\*\/\s*$/s, "");
    const parts = text.split(/^(?=\/\* src\/.+? \*\/$)/m);
    for (const part of parts) {
      const m = part.match(/^\/\* (src\/.+?) \*\/$/m);
      if (!m) {
        if (part.trim()) throw new Error(`見出しのない CSS があります: ${file}`);
        continue;
      }
      const prev = blocks.get(m[1]);
      if (prev !== undefined && prev !== part.trim()) {
        throw new Error(`同じ元ファイルの CSS が入口ごとに違います: ${m[1]}`);
      }
      blocks.set(m[1], part.trim());
    }
  }

  const css = [...blocks.keys()].sort().map((k) => blocks.get(k)).join("\n\n") + "\n";
  const indented = css
    .split("\n")
    .map((line) => (line ? `  ${line}` : line))
    .join("\n")
    .trimEnd();
  fs.writeFileSync(path.join(distDir, "styles.css"), css);
  fs.writeFileSync(
    path.join(distDir, "styles.layer.css"),
    `@layer ${LAYER} {\n${indented}\n}\n`,
  );

  for (const file of cssFiles) {
    fs.rmSync(file);
    fs.rmSync(`${file}.map`, { force: true });
  }
}
