import { afterEach, describe, expect, it, vi } from "vitest";
import {
  incomingAppLink,
  parseCoordinates,
  publicShareBase,
  parseSharedStops,
} from "./share-links";

afterEach(() => vi.unstubAllEnvs());
describe("shared coordinate validation", () => {
  it("keeps old links compatible while rejecting invalid or oversized stop data", () => {
    expect(parseSharedStops(null)).toEqual([]);
    for (const value of [
      "{}",
      "null",
      "[]".repeat(4000),
      JSON.stringify([{ label: "", coordinates: { lng: 0, lat: 0 } }]),
      JSON.stringify(
        Array.from({ length: 4 }, () => ({
          label: "Stop",
          coordinates: { lng: 0, lat: 0 },
        })),
      ),
    ]) {
      expect(parseSharedStops(value)).toBeNull();
    }
    expect(
      parseSharedStops(
        JSON.stringify([
          { label: "Café & gardens", coordinates: { lng: 0, lat: 0 } },
        ]),
      ),
    ).toEqual([{ label: "Café & gardens", coordinates: { lng: 0, lat: 0 } }]);
  });
  it("rejects missing, blank, out-of-range, and non-finite values", () => {
    for (const pair of [
      [null, null],
      ["", ""],
      [" ", "10"],
      ["181", "0"],
      ["0", "-91"],
      ["Infinity", "0"],
      ["no", "1"],
    ]) {
      expect(parseCoordinates(pair[0]!, pair[1]!)).toBeNull();
    }
  });
  it("accepts real zero coordinates", () => {
    expect(parseCoordinates("0", "0")).toEqual({ lng: 0, lat: 0 });
  });
});
describe("native deep links", () => {
  it("rejects a route with malformed or invalid intermediate stops", () => {
    const prefix = "magnexis-maps://route?olng=0&olat=0&dlng=1&dlat=1&stops=";
    expect(incomingAppLink(prefix + encodeURIComponent("not JSON"))).toBeNull();
    expect(
      incomingAppLink(
        prefix +
          encodeURIComponent(
            JSON.stringify([
              { label: "Bad stop", coordinates: { lng: 181, lat: 41 } },
            ]),
          ),
      ),
    ).toBeNull();
  });
  it("opens a valid place link inside the bundled interface", () => {
    expect(incomingAppLink("magnexis-maps://place?q=Park&lng=-72&lat=41")).toBe(
      "/?q=Park&lng=-72&lat=41",
    );
  });
  it("rejects other schemes, operations, and invalid coordinates", () => {
    for (const url of [
      "https://evil.test/place?q=Park&lng=0&lat=0",
      "javascript:alert(1)",
      "magnexis-maps://place?q=Park",
      "magnexis-maps://admin",
      "magnexis-maps://route?olng=0&olat=0&dlng=190&dlat=0",
    ])
      expect(incomingAppLink(url)).toBeNull();
  });
  it("marks valid route links for the existing route parser", () => {
    expect(
      incomingAppLink("magnexis-maps://route?olng=0&olat=0&dlng=1&dlat=1"),
    ).toContain("dir=1");
  });
  it("uses a public web origin for native sharing", () => {
    vi.stubEnv("NEXT_PUBLIC_SHARE_URL", "https://maps.magnexis.test");
    expect(publicShareBase("capacitor://localhost")).toBe(
      "https://maps.magnexis.test",
    );
  });
  it("does not share a native origin or an arbitrary current page path", () => {
    vi.stubEnv("NEXT_PUBLIC_SHARE_URL", "");
    expect(publicShareBase("capacitor://localhost")).toBe("");
    expect(publicShareBase("https://maps.magnexis.test/navigate/")).toBe(
      "https://maps.magnexis.test",
    );
  });
});
