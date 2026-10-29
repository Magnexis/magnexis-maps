import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const nextBin = fileURLToPath(
  new URL("../../web/node_modules/next/dist/bin/next", import.meta.url),
);
const result = spawnSync(process.execPath, [nextBin, "build"], {
  cwd: fileURLToPath(new URL("../../web/", import.meta.url)),
  env: { ...process.env, MAGNEXIS_WEB_EXPORT: "1" },
  stdio: "inherit",
});

if (result.status !== 0) process.exit(result.status ?? 1);
