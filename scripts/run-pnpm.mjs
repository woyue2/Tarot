import { spawnSync } from "node:child_process";

const pnpmEntry = process.env.npm_execpath;

if (!pnpmEntry) {
  console.error("无法定位当前 pnpm。请从 pnpm.cmd 或 pnpm 启动根脚本。");
  process.exit(1);
}

const result = spawnSync(process.execPath, [pnpmEntry, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
