import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildEnvironment } from "./config.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const web = path.join(root, "web");
const app = path.join(root, "iphone");
const development = process.argv.includes("--development");
const env = buildEnvironment(process.env, development);
const result = spawnSync(
  process.execPath,
  [path.join(web, "node_modules/next/dist/bin/next"), "build"],
  { cwd: web, env, stdio: "inherit" },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
// Only generated frontend assets are copied; repository files and .env stay out.
const output = path.join(app, "www");
await mkdir(output, { recursive: true });
await cp(path.join(web, ".next-iphone"), output, { recursive: true });
await readFile(path.join(output, "navigate/index.html"));
await writeFile(
  path.join(output, "build-info.json"),
  JSON.stringify(
    {
      mode: development ? "development" : "production",
      builtAt: new Date().toISOString(),
      apiUrl: env.NEXT_PUBLIC_API_URL,
      shareUrl: env.NEXT_PUBLIC_SHARE_URL,
      privacyUrl: env.NEXT_PUBLIC_PRIVACY_URL,
      supportUrl: env.NEXT_PUBLIC_SUPPORT_URL,
    },
    null,
    2,
  ),
);
console.log(
  `Packaged shared web interface for iPhone (${development ? "development — not distributable" : "production"}).`,
);
