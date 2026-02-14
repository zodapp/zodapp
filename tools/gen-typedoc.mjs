import { access, mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const packageRoot = process.cwd();
const repoRoot = path.resolve(packageRoot, "../..");

const tsconfigPath = path.join(packageRoot, "tsconfig.json");
const srcDir = path.join(packageRoot, "src");
const outDir = path.join(packageRoot, "docs", "api");

const packageJsonPath = path.join(packageRoot, "package.json");
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
const packageName = packageJson.name ?? path.basename(packageRoot);

if (!(await exists(tsconfigPath)) || !(await exists(srcDir))) {
  console.log(`[typedoc] skip ${packageName} (no tsconfig/src)`);
  process.exit(0);
}

if (!(await hasSourceFiles(srcDir))) {
  console.log(`[typedoc] skip ${packageName} (no ts sources)`);
  process.exit(0);
}

const firebaseConfigPath = path.join(repoRoot, "firebaseConfig.json");
if (
  packageName === "@repo/firebase" &&
  process.env.TYPEDOC_ALLOW_MISSING_FIREBASE_CONFIG !== "true" &&
  !(await exists(firebaseConfigPath))
) {
  console.log(
    "[typedoc] skip @repo/firebase (firebaseConfig.json not found)"
  );
  process.exit(0);
}

await mkdir(outDir, { recursive: true });

const args = [
  "exec",
  "typedoc",
  "--out",
  outDir,
  "--plugin",
  "typedoc-plugin-markdown",
  "--entryFileName",
  "README",
  "--tsconfig",
  tsconfigPath,
  "--exclude",
  "**/*.test.ts",
  "--exclude",
  "**/*.test.tsx",
  "--exclude",
  "**/*.spec.ts",
  "--exclude",
  "**/*.spec.tsx",
  "--excludePrivate",
  "--excludeProtected",
  "--excludeInternal",
  "--skipErrorChecking"
];

await run("pnpm", args, packageRoot);

function run(command, argsList, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argsList, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32"
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function hasSourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (await hasSourceFiles(fullPath)) {
        return true;
      }
      continue;
    }

    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      return true;
    }
  }

  return false;
}
