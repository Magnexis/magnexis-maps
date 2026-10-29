#!/usr/bin/env node
/**
 * Securely write GOOGLE_MAPS_API_KEY into the repo-root .env (never prints the key).
 * Usage: pnpm secrets:google
 * Or:    pnpm secrets:google --key=YOUR_KEY   (prefer the interactive prompt)
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");

function upsertEnv(content, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(content)) return content.replace(re, line);
  const block = `\n# --- Google Maps Platform (server-only; never commit) ---\n${line}\n`;
  return content.trimEnd() + "\n" + block;
}

function readArgKey() {
  const arg = process.argv.find((a) => a.startsWith("--key="));
  return arg ? arg.slice("--key=".length).trim() : "";
}

async function promptKey() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const stdin = process.stdin;
  const wasRaw = stdin.isRaw;
  if (stdin.isTTY) {
    stdin.setRawMode?.(true);
  }
  process.stdout.write(
    "Paste your Google Maps Platform API key (input hidden when possible), then Enter:\n> ",
  );

  return await new Promise((resolve) => {
    let buf = "";
    const onData = (chunk) => {
      const s = chunk.toString("utf8");
      for (const ch of s) {
        if (ch === "\n" || ch === "\r") {
          stdin.off("data", onData);
          if (stdin.isTTY) stdin.setRawMode?.(wasRaw ?? false);
          process.stdout.write("\n");
          rl.close();
          resolve(buf.trim());
          return;
        }
        if (ch === "\u0003") {
          process.stdout.write("\nCancelled.\n");
          process.exit(1);
        }
        if (ch === "\u007f" || ch === "\b") {
          buf = buf.slice(0, -1);
          continue;
        }
        buf += ch;
        process.stdout.write("*");
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  let key = readArgKey();
  if (!key) {
    key = await promptKey();
  }
  if (!key || key.length < 8) {
    console.error("No key provided (or too short). Nothing written.");
    process.exit(1);
  }

  let content = "";
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, "utf8");
  } else if (fs.existsSync(path.join(root, ".env.example"))) {
    content = fs.readFileSync(path.join(root, ".env.example"), "utf8");
    console.log("Created .env from .env.example");
  }

  content = upsertEnv(content, "GOOGLE_MAPS_API_KEY", key);
  if (!/^GOOGLE_PLACE_PHOTO_PRIORITY=/m.test(content)) {
    content = upsertEnv(content, "GOOGLE_PLACE_PHOTO_PRIORITY", "before");
  }

  // Discourage shipping the same key to the browser bundle
  if (/^NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=.+$/m.test(content)) {
    content = content.replace(
      /^NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=.+$/m,
      "# NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=  # prefer server proxy — do not expose production keys",
    );
  }

  fs.writeFileSync(envPath, content.endsWith("\n") ? content : `${content}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });

  console.log("Wrote GOOGLE_MAPS_API_KEY to .env (server-only).");
  console.log("Default GOOGLE_PLACE_PHOTO_PRIORITY=before (Places before Mapillary).");
  console.log("");
  console.log("In Google Cloud Console:");
  console.log("  1. Enable Places API (New), Street View Static API");
  console.log("     (optional: Geocoding API if GEOCODING_PROVIDER=google|auto)");
  console.log("  2. Enable billing on the project");
  console.log("  3. Restrict the key: IP for the API host; HTTP referrer only if you");
  console.log("     must use NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (not recommended)");
  console.log("  4. Allow localhost:3000 / your production domain for any browser key");
  console.log("");
  console.log("Restart the API to pick up env changes:");
  console.log("  pnpm --filter @magnexis/api dev");
  console.log("");
  console.log("Never commit .env or paste the key into chat.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
