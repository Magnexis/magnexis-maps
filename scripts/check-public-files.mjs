import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(path.resolve("services/api/package.json"));
let local = {};
try { local = require("dotenv").parse(readFileSync(".env")); } catch (e) { if (e.code !== "ENOENT") throw e; }
const providerSecrets = Object.entries(local).filter(([key, value]) => /^(TOMTOM_API_KEY|TOMTOM_KEY|GOOGLE_MAPS_API_KEY|GOOGLE_MAPS_KEY)$/.test(key) && value.length >= 16).map(([, value]) => value);
const files = [...new Set(execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean))];
const failures = [];
for (const file of files) {
  if (/(^|\/)\.env(?:\..+)?$/.test(file) && !file.endsWith(".example")) { failures.push(`${file}: environment file`); continue; }
  if (/\.(p12|p8|pem|key|mobileprovision)$/i.test(file)) { failures.push(`${file}: credential material`); continue; }
  if (statSync(file).size > 5_000_000 || /\.(png|jpg|jpeg|mp4|woff2?|ico)$/i.test(file)) continue;
  const value = readFileSync(file, "utf8");
  if (providerSecrets.some((secret) => value.includes(secret)) || /AIza[0-9A-Za-z_-]{35}|gh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(value)) failures.push(`${file}: possible credential`);
}
if (failures.length) { console.error(failures.join("\n")); process.exitCode = 1; }
else console.log(`Checked ${files.length} publishable files: no configured provider keys or recognized credential material found.`);
