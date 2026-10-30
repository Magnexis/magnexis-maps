import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = new URL("../", import.meta.url);
test("native project bundles the privacy manifest as an Xcode resource", async () => {
  const project = await readFile(
    new URL("ios/App/App.xcodeproj/project.pbxproj", app),
    "utf8",
  );
  assert.match(project, /PrivacyInfo\.xcprivacy in Resources/);
  assert.equal((project.match(/A1811E000000000000000001/g) ?? []).length, 2);
  assert.match(project, /MARKETING_VERSION = 1\.5\.2/);
  assert.match(project, /TARGETED_DEVICE_FAMILY = 1;/);
});
test("iPhone configuration does not enable remote shell hosting or background tracking", async () => {
  const config = await readFile(new URL("capacitor.config.ts", app), "utf8");
  const plist = await readFile(new URL("ios/App/App/Info.plist", app), "utf8");
  assert.doesNotMatch(config, /server\s*:/);
  assert.doesNotMatch(plist, /NSAllowsArbitraryLoads|UIBackgroundModes/);
  assert.match(plist, /NSLocationWhenInUseUsageDescription/);
  assert.match(plist, /magnexis-maps/);
});
test("App Store icon is the official opaque 1024px PNG", async () => {
  const icon = await readFile(
    new URL(
      "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
      app,
    ),
  );
  assert.equal(icon.readUInt32BE(16), 1024);
  assert.equal(icon.readUInt32BE(20), 1024);
  assert.equal(icon[25], 2);
});
