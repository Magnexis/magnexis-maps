import { readFile } from "node:fs/promises";
import { validatePublicUrl } from "./config.mjs";

const app = new URL("../", import.meta.url);
const failures = [];
try {
  const info = JSON.parse(
    await readFile(new URL("www/build-info.json", app), "utf8"),
  );
  if (info.mode !== "production")
    failures.push(
      "The current bundle is a development export. Build with verified production endpoints.",
    );
  for (const key of ["apiUrl", "shareUrl", "privacyUrl", "supportUrl"]) {
    try {
      validatePublicUrl(info[key], key);
    } catch (error) {
      failures.push(error.message);
    }
  }
  for (const file of [
    "index.html",
    "navigate/index.html",
    "privacy/index.html",
    "support/index.html",
  ])
    await readFile(new URL(`www/${file}`, app));
  await readFile(new URL("ios/App/App/PrivacyInfo.xcprivacy", app));
} catch (error) {
  failures.push(`Missing or invalid release artifact: ${error.message}`);
}
if (failures.length) {
  console.error(failures.map((failure) => `BLOCKED: ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    "Automated artifact checks passed. This does not confirm App Store readiness.",
  );
}
console.log(
  "Required release gates: hosted endpoint/privacy verification, privacy disclosures, licensed provider usage, physical iPhone tests, signed Xcode archive, and App Review. Account deletion is implemented; verify the deployed account lifecycle before release.",
);
