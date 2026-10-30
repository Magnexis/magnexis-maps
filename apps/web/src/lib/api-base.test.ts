import { describe, expect, it } from "vitest";
import { resolveApiBase } from "./api-base";

describe("resolveApiBase", () => {
  it("uses the configured public origin without a trailing slash", () => {
    expect(resolveApiBase("https://maps.example.test/", "production")).toBe(
      "https://maps.example.test",
    );
  });

  it("uses the same origin in production when no public API origin is set", () => {
    expect(resolveApiBase(undefined, "production")).toBe("");
  });

  it("keeps the local API default for development", () => {
    expect(resolveApiBase(undefined, "development")).toBe(
      "http://localhost:4000",
    );
  });
});
