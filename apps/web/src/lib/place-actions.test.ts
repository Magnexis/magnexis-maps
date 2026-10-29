import { afterEach, describe, expect, it, vi } from "vitest";
import { sharePlace, shareRoute, routeShareUrl } from "./place-actions";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
}));
vi.mock("@capacitor/share", () => ({ Share: { share: vi.fn() } }));

vi.mock("@/lib/api", () => ({ getApiClient: vi.fn() }));
vi.mock("@/lib/store", () => ({ useAppStore: { getState: vi.fn() } }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
});

const place = { label: "Test place", coordinates: { lng: -72.93, lat: 41.31 } };

describe("sharing links", () => {
  it("preserves intermediate stops and their order in a route link", () => {
    const trip = {
      origin: place,
      destination: { ...place, label: "Destination" },
      waypoints: [
        { label: "First stop", coordinates: { lng: -72.9, lat: 41.3 } },
        { label: "Second stop", coordinates: { lng: -72.8, lat: 41.4 } },
      ],
    };
    const params = new URL(routeShareUrl(trip), "https://maps.example.test")
      .searchParams;
    expect(JSON.parse(params.get("stops") ?? "[]")).toEqual(trip.waypoints);
  });
  it("opens the iPhone share sheet and distinguishes completion from cancellation", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Share.share).mockResolvedValueOnce({
      activityType: "com.apple.UIKit.activity.CopyToPasteboard",
    });
    await expect(sharePlace(place)).resolves.toBe("shared");
    vi.mocked(Share.share).mockResolvedValueOnce({ activityType: "" });
    await expect(sharePlace(place)).resolves.toBe("cancelled");
  });

  it("does not claim a link was copied when sharing and clipboard are unavailable", async () => {
    vi.stubGlobal("navigator", {});
    await expect(sharePlace(place)).rejects.toThrow();
  });

  it("copies the link when native sharing is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await expect(sharePlace(place)).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("q=Test%20place"),
    );
  });

  it("reports a denied clipboard write as a failure", async () => {
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("Permission denied")),
      },
    });
    await expect(sharePlace(place)).rejects.toThrow("Permission denied");
  });

  it("reports success after native sharing completes", async () => {
    vi.stubGlobal("navigator", { share: vi.fn().mockResolvedValue(undefined) });
    await expect(sharePlace(place)).resolves.toBe("shared");
  });

  it("falls back to copying after a native sharing failure", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      share: vi.fn().mockRejectedValue(new Error("Sharing unavailable")),
      clipboard: { writeText },
    });
    await expect(sharePlace(place)).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledOnce();
  });

  it("does not copy a route when the native share sheet is cancelled", async () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", {
      share: vi
        .fn()
        .mockRejectedValue(new DOMException("Cancelled", "AbortError")),
      clipboard: { writeText },
    });
    await expect(
      shareRoute({ origin: place, destination: place }),
    ).resolves.toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });
});
