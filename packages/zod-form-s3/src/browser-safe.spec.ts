/**
 * このパッケージはブラウザでも動くので、Node.js 専用のモジュールとサーバーのパッケージを import しない。
 * eslint の no-restricted-imports と同じ検査を、CI で落ちるようにテストでも行う
 */
import { readdirSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SERVER_PACKAGES =
  /^(@zodapp\/zod-dynamodb-(node|express|realtime|mqtt)|@zodapp\/zod-form-s3-node|@aws-sdk\/)/;
const builtins = new Set(builtinModules);

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) {
      return e.name === "test" || e.name === "__fixtures__"
        ? []
        : sources(path);
    }
    return /\.tsx?$/.test(e.name) && !/\.spec\.tsx?$/.test(e.name)
      ? [path]
      : [];
  });

const IMPORT =
  /(?:import|export)\s[^'"]*?from\s*["']([^"']+)["']|import\s*\(?\s*["']([^"']+)["']/g;

describe("ブラウザで動くこと", () => {
  it("Node.js 専用のモジュールとサーバーのパッケージを import しない", () => {
    const violations: string[] = [];
    for (const file of sources(join(import.meta.dirname))) {
      for (const m of readFileSync(file, "utf8").matchAll(IMPORT)) {
        const spec = m[1] ?? m[2]!;
        if (
          spec.startsWith("node:") ||
          builtins.has(spec.split("/")[0]!) ||
          SERVER_PACKAGES.test(spec)
        ) {
          violations.push(`${file}: ${spec}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
