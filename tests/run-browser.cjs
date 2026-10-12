const { spawnSync } = require("node:child_process");
for (const file of [
  "browser.cjs",
  "runtime.cjs",
  "routes.cjs",
  "upgrade.cjs",
]) {
  const result = spawnSync(process.execPath, [`tests/${file}`], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
