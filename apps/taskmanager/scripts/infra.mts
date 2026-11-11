/**
 * ローカルのインフラ（infra/compose.yml）を起動・停止する。
 *
 * Claude Code のクラウド環境のように dockerd が動いていない環境では、dockerd を起動してから
 * docker compose を実行する。
 */
import { spawn, spawnSync } from "node:child_process";
import { openSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const compose = ["compose", "-f", join(import.meta.dirname, "../infra/compose.yml")];

const dockerReady = () =>
  spawnSync("docker", ["info"], { stdio: "ignore" }).status === 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ensureDocker = async () => {
  if (dockerReady()) return;
  const isRoot = process.getuid?.() === 0;
  const hasDockerd =
    spawnSync("sh", ["-c", "command -v dockerd"], { stdio: "ignore" }).status === 0;
  if (!isRoot || !hasDockerd) {
    throw new Error("docker is not running. Start Docker Desktop (or dockerd) first.");
  }
  const log = join(tmpdir(), "dockerd.log");
  console.log(`[infra] starting dockerd (log: ${log})`);
  const out = openSync(log, "a");
  spawn("dockerd", [], { detached: true, stdio: ["ignore", out, out] }).unref();
  for (let i = 0; i < 60; i++) {
    if (dockerReady()) return;
    await sleep(1000);
  }
  throw new Error(`dockerd did not start. See ${log}`);
};

const run = (args: string[]) => {
  const result = spawnSync("docker", args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const command = process.argv[2];
if (command === "up") {
  await ensureDocker();
  run([...compose, "up", "-d", "--wait-timeout", "120"]);
  console.log(
    "[infra] DynamoDB Local :8000, magnito :5050, S3Proxy :8081. Next: pnpm dev",
  );
} else if (command === "down") {
  if (dockerReady()) run([...compose, "down"]);
} else {
  console.error("usage: tsx scripts/infra.ts up|down");
  process.exit(1);
}
