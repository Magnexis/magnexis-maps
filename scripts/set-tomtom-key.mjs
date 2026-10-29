#!/usr/bin/env node
/**
 * Securely write TOMTOM_API_KEY into the repo-root .env (never prints the key).
 * Usage: pnpm secrets:tomtom
 * Or:    pnpm secrets:tomtom --key=YOUR_KEY   (prefer the interactive prompt)
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");
const webEnvPath = path.join(root, "apps", "web", ".env.local");

function upsertEnv(content, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(content)) return content.replace(re, line);
  const block = `\n# --- TomTom (server-only; never commit) ---\n${line}\n`;
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
  // Mute echo where the TTY supports it
  const stdin = process.stdin;
  const wasRaw = stdin.isRaw;
  if (stdin.isTTY) {
    stdin.setRawMode?.(true);
  }
  process.stdout.write(
    "Paste your TomTom API key (input hidden when possible), then Enter:\n> ",
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

  content = upsertEnv(content, "TOMTOM_API_KEY", key);
  content = upsertEnv(content, "ROUTING_PROVIDER", "tomtom");
  content = upsertEnv(content, "GEOCODING_PROVIDER", "tomtom");
  content = upsertEnv(content, "NEXT_PUBLIC_TOMTOM_TRAFFIC_PROXY", "1");

  // Discourage shipping the same key to the browser bundle
  if (/^NEXT_PUBLIC_TOMTOM_KEY=.+$/m.test(content)) {
    content = content.replace(
      /^NEXT_PUBLIC_TOMTOM_KEY=.+$/m,
      "# NEXT_PUBLIC_TOMTOM_KEY=  # prefer server proxy (NEXT_PUBLIC_TOMTOM_TRAFFIC_PROXY=1)",
    );
  }

  fs.writeFileSync(envPath, content.endsWith("\n") ? content : `${content}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });

  // Next.js only auto-loads apps/web/.env* — sync the non-secret traffic flag there.
  let webContent = "";
  if (fs.existsSync(webEnvPath)) {
    webContent = fs.readFileSync(webEnvPath, "utf8");
  } else {
    webContent =
      "# Generated/updated by pnpm secrets:tomtom — do not put TOMTOM_API_KEY here.\n";
  }
  webContent = upsertEnv(webContent, "NEXT_PUBLIC_TOMTOM_TRAFFIC_PROXY", "1");
  if (!/^NEXT_PUBLIC_API_URL=/m.test(webContent)) {
    webContent = upsertEnv(
      webContent,
      "NEXT_PUBLIC_API_URL",
      "http://localhost:4000",
    );
  }
  fs.writeFileSync(
    webEnvPath,
    webContent.endsWith("\n") ? webContent : `${webContent}\n`,
    { encoding: "utf8", mode: 0o600 },
  );

  console.log("Wrote TOMTOM_API_KEY to .env (server-only).");
  console.log("Also set ROUTING_PROVIDER=tomtom, GEOCODING_PROVIDER=tomtom,");
  console.log("and NEXT_PUBLIC_TOMTOM_TRAFFIC_PROXY=1 (root .env + apps/web/.env.local).");
  console.log("");
  console.log("Restart the API (and web) to pick up env changes:");
  console.log("  pnpm --filter @magnexis/api dev");
  console.log("  pnpm --filter @magnexis/web dev");
  console.log("");
  console.log("In TomTom Developer Portal, restrict the key by HTTP referrer / IP");
  console.log("when you can. Never commit .env or paste the key into chat.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
