/**
 * Records a smooth Magnexis Maps product demo against localhost:3000.
 * Continuous MapLibre camera (flyTo / easeTo) + CDP screencast → H.264.
 * (Branded Edge/Chrome channels don't support Playwright recordVideo.)
 *
 * Usage (from a folder with playwright installed):
 *   set MAGNEXIS_DEMO_OUT=...\\docs\\demo
 *   node path\\to\\record-demo.mjs
 */
import { chromium } from "playwright";
import {
  mkdirSync,
  writeFileSync,
  readdirSync,
  existsSync,
  statSync,
  rmSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir =
  process.env.MAGNEXIS_DEMO_OUT ||
  (process.cwd().includes("magnexis-demo-playwright")
    ? "C:\\Users\\matth\\OneDrive\\Desktop\\gitlab\\magnexis-maps\\docs\\demo"
    : __dirname);
const castDir = join(outDir, "screencast");
rmSync(castDir, { recursive: true, force: true });
mkdirSync(castDir, { recursive: true });
mkdirSync(join(outDir, "frames"), { recursive: true });

const BASE = process.env.MAGNEXIS_DEMO_URL || "http://localhost:3000";
const W = 1440;
const H = 900;

function resolveFfmpeg() {
  const candidates = [
    process.env.FFMPEG,
    "ffmpeg",
    "C:\\Users\\matth\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.2-full_build\\bin\\ffmpeg.exe",
    join(
      process.env.USERPROFILE || "",
      "AppData\\Local\\ms-playwright\\ffmpeg-1011\\ffmpeg-win64.exe",
    ),
  ].filter(Boolean);
  for (const c of candidates) {
    if (c === "ffmpeg") {
      const r = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
      if (r.status === 0) return "ffmpeg";
    } else if (existsSync(c)) {
      return c;
    }
  }
  return null;
}

async function wait(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function shot(page, name) {
  await page.screenshot({
    path: join(outDir, "frames", name),
    type: "png",
  });
}

async function dismissOverlays(page) {
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Escape").catch(() => {});
    await wait(180);
  }
  const close = page.getByRole("button", { name: "Close settings" });
  if (await close.isVisible().catch(() => false)) {
    await close.click().catch(() => {});
    await wait(300);
  }
}

async function waitForMap(page, timeoutMs = 60000) {
  await page.waitForFunction(() => Boolean(window.__mxMap), {
    timeout: timeoutMs,
  });
}

async function camera(page, method, options) {
  await waitForMap(page);
  await page.evaluate(
    async ({ method: m, options: opts }) => {
      const map = window.__mxMap;
      if (!map) throw new Error("map missing");
      await new Promise((resolve) => {
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        map.once("moveend", done);
        map[m]({ ...opts, essential: true });
        setTimeout(done, (opts.duration || 2000) + 3000);
      });
    },
    { method, options },
  );
  await wait(700);
}

async function setMapStyleViaSettings(page, styleId) {
  await dismissOverlays(page);
  await page.getByRole("button", { name: "Open settings" }).click();
  await wait(700);
  const select = page
    .locator("#mx-settings-drawer label")
    .filter({ hasText: /Preferred style/i })
    .locator("select");
  await select.waitFor({ state: "visible", timeout: 10000 });
  await select.selectOption({ value: styleId });
  await wait(2000);
  await dismissOverlays(page);
  await waitForMap(page);
  await wait(1200);
}

/** CDP screencast → numbered JPEGs (smooth continuous frames). */
function startScreencast(cdp, frameDir) {
  let i = 0;
  let writing = Promise.resolve();
  cdp.on("Page.screencastFrame", (frame) => {
    const idx = i++;
    const file = join(frameDir, `f-${String(idx).padStart(5, "0")}.jpg`);
    writing = writing.then(async () => {
      writeFileSync(file, Buffer.from(frame.data, "base64"));
      await cdp.send("Page.screencastFrameAck", {
        sessionId: frame.sessionId,
      });
    });
  });
  return {
    async begin() {
      await cdp.send("Page.startScreencast", {
        format: "jpeg",
        quality: 82,
        maxWidth: W,
        maxHeight: H,
        everyNthFrame: 1,
      });
    },
    async end() {
      await cdp.send("Page.stopScreencast").catch(() => {});
      await writing;
      return i;
    },
  };
}

const ffmpeg = resolveFfmpeg();
if (!ffmpeg) {
  console.error("ffmpeg required");
  process.exit(1);
}

const browser = await chromium.launch({
  headless: true,
  channel: process.env.MAGNEXIS_DEMO_CHANNEL || "msedge",
  args: ["--disable-dev-shm-usage"],
});

const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
});

const page = await context.newPage();
const cdp = await context.newCDPSession(page);
const cast = startScreencast(cdp, castDir);

try {
  await page.goto(`${BASE}/?lng=-72.6851&lat=41.6&z=8&e2e=demo`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.evaluate(() => {
    localStorage.setItem(
      "magnexis_settings",
      JSON.stringify({ mapStyle: "standard", theme: "light" }),
    );
  });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await dismissOverlays(page);
  await waitForMap(page);
  await wait(1500);

  await cast.begin();
  await wait(800);
  await shot(page, "01-cold-load.png");

  await camera(page, "easeTo", {
    zoom: 10.2,
    pitch: 38,
    bearing: -12,
    duration: 4200,
  });
  await shot(page, "02-zoomed-overview.png");

  await camera(page, "flyTo", {
    center: [-72.9291, 41.3111],
    zoom: 13.2,
    pitch: 48,
    bearing: 18,
    duration: 5500,
    curve: 1.35,
    speed: 0.55,
  });
  await shot(page, "03-new-haven.png");

  await camera(page, "easeTo", {
    center: [-72.9275, 41.3088],
    zoom: 14.4,
    pitch: 52,
    bearing: 32,
    duration: 3800,
  });
  await shot(page, "04-new-haven-detail.png");

  const search = page.getByRole("textbox", {
    name: /Search places|Universal search|Search/i,
  });
  if (await search.isVisible().catch(() => false)) {
    await search.click();
    await search.pressSequentially("New Haven Green", { delay: 65 });
    await wait(2000);
    await shot(page, "05-search.png");
    await page.keyboard.press("Escape");
    await wait(400);
  }

  await camera(page, "easeTo", {
    bearing: 55,
    pitch: 55,
    duration: 3200,
  });

  await setMapStyleViaSettings(page, "dark");
  await shot(page, "06-night.png");

  await camera(page, "easeTo", {
    zoom: 13.6,
    bearing: 20,
    pitch: 45,
    duration: 3600,
  });
  await wait(2400);
  await shot(page, "07-finale.png");
} catch (err) {
  console.error("Demo recording error:", err);
  await shot(page, "error.png").catch(() => {});
  process.exitCode = 1;
} finally {
  const n = await cast.end();
  console.log(`Captured ${n} screencast frames`);
  await context.close();
  await browser.close();
}

const frames = existsSync(castDir)
  ? readdirSync(castDir).filter((f) => f.endsWith(".jpg"))
  : [];
if (frames.length < 30) {
  console.error(`Too few frames (${frames.length}) — aborting encode`);
  process.exit(1);
}

const destMp4 = join(outDir, "magnexis-maps-demo.mp4");
// CDP screencast on this machine lands ~45–55 fps; 48 keeps realtime pacing.
const r = spawnSync(
  ffmpeg,
  [
    "-y",
    "-framerate",
    "48",
    "-i",
    join(castDir, "f-%05d.jpg"),
    "-vf",
    "fps=30,scale=1440:900:flags=lanczos,format=yuv420p",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "22",
    "-movflags",
    "+faststart",
    "-an",
    destMp4,
  ],
  { encoding: "utf8" },
);
if (r.status !== 0) {
  console.error(r.stderr || r.stdout);
  process.exit(1);
}
console.log(
  "Wrote",
  destMp4,
  `(${(statSync(destMp4).size / 1e6).toFixed(2)} MB, ${frames.length} frames)`,
);
