import { describe, expect, it, vi } from "vitest";
import type { SearchResult } from "@magnexis/shared";
import { resolveRouteStops } from "./route-stops";

const stop: SearchResult = {
  id: "known-stop",
  label: "Museum",
  kind: "place",
  source: "geocoder",
  verified: false,
  coordinates: { lng: -72.9, lat: 41.3 },
};
describe("intermediate route stops", () => {
  it("preserves shared stop coordinates without another geocoding lookup", async () => {
    const resolve = vi.fn().mockResolvedValue(null);
    expect(await resolveRouteStops([" Museum "], [stop], resolve)).toEqual([
      stop,
    ]);
    expect(resolve).not.toHaveBeenCalled();
  });
  it("keeps stop order, including distinct locations with the same label", async () => {
    const other = {
      ...stop,
      id: "second-museum",
      coordinates: { lng: -72.8, lat: 41.4 },
    };
    const resolve = vi.fn().mockResolvedValue(null);
    expect(
      await resolveRouteStops(["Museum", "Museum"], [other, stop], resolve),
    ).toEqual([other, stop]);
  });
  it("fails instead of silently dropping an unresolved stop", async () => {
    const resolve = vi.fn().mockResolvedValueOnce(null);
    await expect(
      resolveRouteStops(["Missing stop", "Museum"], [], resolve),
    ).rejects.toMatchObject({
      code: "UNRESOLVED_ROUTE_STOP",
      message: expect.stringContaining("Stop 1"),
    });
    expect(resolve).toHaveBeenCalledOnce();
  });
  it("rejects invalid geocoded coordinates", async () => {
    await expect(
      resolveRouteStops(
        ["Museum"],
        [],
        vi
          .fn()
          .mockResolvedValue({ ...stop, coordinates: { lng: 999, lat: 41 } }),
      ),
    ).rejects.toMatchObject({ code: "UNRESOLVED_ROUTE_STOP" });
  });
  it("ignores empty draft rows without removing nonempty stops", async () => {
    expect(
      await resolveRouteStops(["", " ", "Museum"], [stop], vi.fn()),
    ).toEqual([stop]);
  });
  it("propagates provider outages and rejects routes exceeding the supported stop limit", async () => {
    await expect(
      resolveRouteStops(
        ["Museum"],
        [],
        vi.fn().mockRejectedValue(new Error("Offline")),
      ),
    ).rejects.toThrow("Offline");
    await expect(
      resolveRouteStops(["A", "B", "C", "D"], [], vi.fn()),
    ).rejects.toThrow("at most");
  });
});
