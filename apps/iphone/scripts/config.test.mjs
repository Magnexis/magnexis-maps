import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEnvironment, validatePublicUrl } from "./config.mjs";

test("production rejects missing endpoints and development defaults", () => {
  assert.throws(() => buildEnvironment({}), /IPHONE_API_URL/);
  for (const url of [
    "http://api.magnexis.com",
    "https://localhost",
    "https://127.0.0.1",
    "https://10.1.1.1",
    "https://192.168.1.5",
    "https://172.16.1.1",
    "https://[::1]",
    "https://api.example.com",
    "https://api.local",
    "https://api.test",
    "https://user:password@api.magnexis.com",
    "https://api.magnexis.com?key=secret",
  ]) {
    assert.throws(() => validatePublicUrl(url, "test"), /public HTTPS/);
  }
});
test("production maps explicit public endpoints into the bundled interface", () => {
  const config = buildEnvironment({
    IPHONE_API_URL: "https://api.magnexis.com/",
    IPHONE_SHARE_URL: "https://maps.magnexis.com",
    IPHONE_PRIVACY_URL: "https://magnexis.com/privacy",
    IPHONE_SUPPORT_URL: "https://magnexis.com/support",
  });
  // These are format-only fixtures, not assertions that these sites exist.
  assert.equal(config.NEXT_PUBLIC_API_URL, "https://api.magnexis.com");
  assert.equal(config.MAGNEXIS_IPHONE_EXPORT, "1");
  assert.equal(config.NEXT_PUBLIC_NATIVE_APP, "1");
});
test("development builds explicitly allow local endpoints", () => {
  assert.equal(
    buildEnvironment({}, true).NEXT_PUBLIC_API_URL,
    "http://localhost:4000",
  );
});
