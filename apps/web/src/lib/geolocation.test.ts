import { describe, expect, it, vi } from "vitest";
import type { GeolocationPlugin, Position } from "@capacitor/geolocation";
import {
  createNativeGeolocation,
  geolocationFailureMessage,
} from "./geolocation";

const position: Position = {
  timestamp: 1,
  coords: {
    latitude: 41,
    longitude: -72,
    accuracy: 5,
    altitude: null,
    altitudeAccuracy: undefined,
    heading: 90,
    speed: 10,
  },
};
function plugin(): GeolocationPlugin {
  return {
    checkPermissions: vi
      .fn()
      .mockResolvedValue({ location: "granted", coarseLocation: "granted" }),
    requestPermissions: vi
      .fn()
      .mockResolvedValue({ location: "granted", coarseLocation: "granted" }),
    getCurrentPosition: vi.fn().mockResolvedValue(position),
    watchPosition: vi.fn().mockResolvedValue("watch-1"),
    clearWatch: vi.fn().mockResolvedValue(undefined),
  };
}

describe("native foreground location adapter", () => {
  it("gives useful recovery instructions for denial, timeout, and unavailable GPS", () => {
    expect(geolocationFailureMessage(1)).toContain("settings");
    expect(geolocationFailureMessage(3)).toContain("try again");
    expect(geolocationFailureMessage(2)).toContain("manually");
  });
  it("requests permission for an explicit locate action and preserves sensor values", async () => {
    const native = plugin();
    const success = vi.fn();
    createNativeGeolocation(native).getCurrentPosition(success);
    await vi.waitFor(() => expect(success).toHaveBeenCalledOnce());
    expect(native.requestPermissions).toHaveBeenCalledOnce();
    expect(success.mock.calls[0]![0].coords).toMatchObject({
      longitude: -72,
      heading: 90,
      speed: 10,
      altitudeAccuracy: null,
    });
  });
  it("reports permission denial without querying GPS", async () => {
    const native = plugin();
    vi.mocked(native.requestPermissions).mockResolvedValue({
      location: "denied",
      coarseLocation: "denied",
    });
    const failure = vi.fn();
    createNativeGeolocation(native).getCurrentPosition(vi.fn(), failure);
    await vi.waitFor(() =>
      expect(failure).toHaveBeenCalledWith(
        expect.objectContaining({ code: 1 }),
      ),
    );
    expect(native.getCurrentPosition).not.toHaveBeenCalled();
  });
  it("does not prompt for permission just because the map mounted", async () => {
    const native = plugin();
    vi.mocked(native.checkPermissions).mockResolvedValue({
      location: "prompt",
      coarseLocation: "prompt",
    });
    const failure = vi.fn();
    createNativeGeolocation(native).watchPosition(vi.fn(), failure);
    await vi.waitFor(() => expect(failure).toHaveBeenCalled());
    expect(native.requestPermissions).not.toHaveBeenCalled();
    expect(native.watchPosition).not.toHaveBeenCalled();
  });
  it("cancels a watch that resolves after component cleanup and ignores late fixes", async () => {
    const native = plugin();
    let finish!: (id: string) => void;
    vi.mocked(native.watchPosition).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const success = vi.fn();
    const adapter = createNativeGeolocation(native);
    const id = adapter.watchPosition(success);
    await vi.waitFor(() => expect(native.watchPosition).toHaveBeenCalledOnce());
    adapter.clearWatch(id);
    vi.mocked(native.watchPosition).mock.calls[0]![1](position);
    finish("late-watch");
    await vi.waitFor(() =>
      expect(native.clearWatch).toHaveBeenCalledWith({ id: "late-watch" }),
    );
    expect(success).not.toHaveBeenCalled();
  });
  it("maps disabled location services to a recoverable unavailable state", async () => {
    const native = plugin();
    vi.mocked(native.requestPermissions).mockRejectedValue({
      code: "OS-PLUG-GLOC-0007",
    });
    const failure = vi.fn();
    createNativeGeolocation(native).getCurrentPosition(vi.fn(), failure);
    await vi.waitFor(() =>
      expect(failure).toHaveBeenCalledWith(
        expect.objectContaining({ code: 2 }),
      ),
    );
  });
});
