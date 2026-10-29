import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
await build({
  entryPoints: [fileURLToPath(new URL("../netlify/functions/api.mjs", import.meta.url))],
  outfile: fileURLToPath(new URL("../.netlify/generated-functions/api.mjs", import.meta.url)),
  bundle: true, packages: "bundle", platform: "node", format: "esm", target: "node22",
  external: ["pg-native"],
  banner: { js: 'import { createRequire as mapsCreateRequire } from "node:module"; import { fileURLToPath as mapsFileURLToPath } from "node:url"; import { dirname as mapsDirname } from "node:path"; const require = mapsCreateRequire(import.meta.url); const __filename = mapsFileURLToPath(import.meta.url); const __dirname = mapsDirname(__filename);' },
});
const web = fileURLToPath(new URL("../apps/web/", import.meta.url));
const result = spawnSync(process.execPath, [fileURLToPath(new URL("../apps/web/node_modules/next/dist/bin/next", import.meta.url)), "build"], {
  cwd: web, env: { ...process.env, MAGNEXIS_WEB_EXPORT: "1" }, stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
