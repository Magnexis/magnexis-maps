import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTomTomSpeedLimit } from "./tomtom-client";

afterEach(() => vi.unstubAllGlobals());

describe("fetchTomTomSpeedLimit", () => {
  it("returns an unknown limit when the API is offline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    await expect(fetchTomTomSpeedLimit(-72.93, 41.31)).resolves.toEqual({
      speedLimitKph: null,
    });
  });

  it("returns an unknown limit for malformed JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not JSON")));
    await expect(fetchTomTomSpeedLimit(-72.93, 41.31)).resolves.toEqual({
      speedLimitKph: null,
    });
  });

  it("returns an unknown limit for a null response body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(null)));
    await expect(fetchTomTomSpeedLimit(-72.93, 41.31)).resolves.toEqual({
      speedLimitKph: null,
    });
  });

  it("preserves a valid posted limit and address", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          speedLimitKph: 50,
          address: "Chapel Street",
        }),
      ),
    );
    await expect(fetchTomTomSpeedLimit(-72.93, 41.31)).resolves.toEqual({
      speedLimitKph: 50,
      address: "Chapel Street",
    });
  });

  it("rejects non-positive limits and non-string addresses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          speedLimitKph: -10,
          address: { invalid: true },
        }),
      ),
    );
    await expect(fetchTomTomSpeedLimit(-72.93, 41.31)).resolves.toEqual({
      speedLimitKph: null,
    });
  });

  it("returns an unknown limit for an unavailable provider", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 503 })),
    );
    await expect(fetchTomTomSpeedLimit(-72.93, 41.31)).resolves.toEqual({
      speedLimitKph: null,
    });
  });
});
