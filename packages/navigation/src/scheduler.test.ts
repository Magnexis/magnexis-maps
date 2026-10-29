import { describe, expect, it } from "vitest";
import {
  createInstructionScheduler,
  formatDistanceForSpeech,
} from "./scheduler";
import type { Route } from "@magnexis/shared";

const sampleRoute: Route = {
  id: "t",
  mode: "driving",
  distanceMeters: 1600,
  durationSeconds: 180,
  geometry: {
    type: "LineString",
    coordinates: [
      [-72.93, 41.31],
      [-72.92, 41.315],
      [-72.91, 41.32],
    ],
  },
  maneuvers: [
    {
      instruction: "Turn right onto Chapel Street",
      distanceMeters: 800,
      durationSeconds: 90,
      coordinates: { lng: -72.92, lat: 41.315 },
    },
    {
      instruction: "Arrive at destination",
      distanceMeters: 0,
      durationSeconds: 0,
      coordinates: { lng: -72.91, lat: 41.32 },
    },
  ],
  provider: "test",
  trafficAware: false,
};

describe("VoiceNav scheduler", () => {
  it("advances after a near cue when a later GPS fix reaches the turn", () => {
    const scheduler = createInstructionScheduler();
    expect(
      scheduler.tick({
        position: { lng: -72.921, lat: 41.315 },
        route: sampleRoute,
      }),
    ).toContain("Chapel Street");
    expect(scheduler.getState().maneuverIndex).toBe(0);

    // Both fixes are in the same 'near' announcement phase. The second fix
    // must still advance progress even though that cue was already spoken.
    expect(
      scheduler.tick({
        position: { lng: -72.9201, lat: 41.315 },
        route: sampleRoute,
      }),
    ).toBeNull();
    expect(scheduler.getState().maneuverIndex).toBe(1);
    expect(
      scheduler.tick({
        position: { lng: -72.91, lat: 41.32 },
        route: sampleRoute,
      }),
    ).toBe("You have arrived at your destination.");
    expect(
      scheduler.tick({
        position: { lng: -72.91, lat: 41.32 },
        route: sampleRoute,
      }),
    ).toBeNull();
  });

  it("formats distances without inventing streets", () => {
    expect(formatDistanceForSpeech(20)).toBe("now");
    expect(formatDistanceForSpeech(1609)).toContain("mile");
  });

  it("speaks real maneuver text once per phase", () => {
    const s = createInstructionScheduler();
    expect(
      s.tick({
        position: { lng: -72.93, lat: 41.31 },
        route: sampleRoute,
      }),
    ).toBeNull();
    const near = s.tick({
      position: { lng: -72.9201, lat: 41.315 },
      route: sampleRoute,
    });
    expect(near).toContain("Chapel Street");
    const again = s.tick({
      position: { lng: -72.9201, lat: 41.315 },
      route: sampleRoute,
    });
    expect(again).toBeNull();
  });
});
