import { describe, expect, it } from "vitest";
import type { Route } from "@magnexis/shared";
import {
  computeRouteProgress,
  formatGpsSpeed,
  formatSpeedLimit,
} from "./route-progress";

const sampleRoute: Route = {
  id: "test",
  mode: "driving",
  distanceMeters: 1000,
  durationSeconds: 120,
  geometry: {
    type: "LineString",
    coordinates: [
      [-72.93, 41.31],
      [-72.92, 41.31],
      [-72.91, 41.31],
    ],
  },
  maneuvers: [
    {
      instruction: "Continue east",
      distanceMeters: 0,
      durationSeconds: 0,
      coordinates: { lng: -72.93, lat: 41.31 },
    },
    {
      instruction: "Arrive",
      distanceMeters: 1000,
      durationSeconds: 120,
      coordinates: { lng: -72.91, lat: 41.31 },
    },
  ],
  provider: "test",
  trafficAware: false,
};

describe("computeRouteProgress", () => {
  it("selects the upcoming OSRM turn using its location rather than step length", () => {
    const route: Route = {
      ...sampleRoute,
      provider: "osrm",
      maneuvers: [
        { ...sampleRoute.maneuvers[0]!, distanceMeters: 800 },
        {
          instruction: "Turn right",
          distanceMeters: 100,
          durationSeconds: 10,
          coordinates: { lng: -72.92, lat: 41.31 },
        },
        sampleRoute.maneuvers[1]!,
      ],
    };
    const progress = computeRouteProgress({ lng: -72.925, lat: 41.31 }, route);
    expect(progress.nextInstruction).toBe("Turn right");
    expect(progress.nextManeuverIndex).toBe(1);
    expect(progress.nextManeuverMeters).toBeCloseTo(250, 0);
  });

  it("measures distance to a turn along a curved route", () => {
    const route: Route = {
      ...sampleRoute,
      distanceMeters: 3000,
      geometry: {
        type: "LineString",
        coordinates: [[0, 0], [0.01, 0], [0.01, 0.01], [0, 0.01]],
      },
      maneuvers: [{
        instruction: "Arrive",
        distanceMeters: 3000,
        durationSeconds: 120,
        coordinates: { lng: 0, lat: 0.01 },
      }],
    };
    const progress = computeRouteProgress({ lng: 0, lat: 0 }, route);
    expect(progress.nextManeuverMeters).toBeCloseTo(3000, 0);
    expect(progress.nextManeuverMeters).toBeCloseTo(progress.remainingMeters, 0);
  });

  it("compares TomTom offsets and progress in the same distance units", () => {
    const route: Route = {
      ...sampleRoute,
      provider: "tomtom",
      maneuvers: sampleRoute.maneuvers.map(({ coordinates, ...maneuver }) => maneuver),
    };
    const progress = computeRouteProgress({ lng: -72.915, lat: 41.31 }, route);
    expect(progress.nextInstruction).toBe("Arrive");
    expect(progress.nextManeuverMeters).toBeCloseTo(250, 0);
  });

  it("accumulates Valhalla step lengths when maneuver coordinates are absent", () => {
    const route: Route = {
      ...sampleRoute,
      provider: "valhalla",
      maneuvers: [
        { instruction: "Depart", distanceMeters: 500, durationSeconds: 60 },
        { instruction: "Turn right", distanceMeters: 500, durationSeconds: 60 },
        { instruction: "Arrive", distanceMeters: 0, durationSeconds: 0 },
      ],
    };
    const progress = computeRouteProgress({ lng: -72.925, lat: 41.31 }, route);
    expect(progress.nextInstruction).toBe("Turn right");
    expect(progress.nextManeuverMeters).toBeCloseTo(250, 0);
  });

  it("reports nearly full remaining at the start", () => {
    const p = computeRouteProgress({ lng: -72.93, lat: 41.31 }, sampleRoute);
    expect(p.remainingMeters).toBeGreaterThan(700);
    expect(p.fractionComplete).toBeLessThan(0.15);
  });

  it("reports low remaining near the destination", () => {
    const p = computeRouteProgress({ lng: -72.91, lat: 41.31 }, sampleRoute);
    expect(p.remainingMeters).toBeLessThan(80);
    expect(p.fractionComplete).toBeGreaterThan(0.85);
  });

  it("keeps full remaining distance when geometry is unavailable", () => {
    const route: Route = {
      ...sampleRoute,
      geometry: { type: "LineString", coordinates: [] },
    };
    const progress = computeRouteProgress({ lng: -72.93, lat: 41.31 }, route);
    expect(progress.remainingMeters).toBe(1000);
    expect(progress.fractionComplete).toBe(0);
  });

  it("uses remaining distance when there are no maneuvers", () => {
    const progress = computeRouteProgress(
      { lng: -72.92, lat: 41.31 },
      { ...sampleRoute, maneuvers: [] },
    );
    expect(progress.nextInstruction).toBe("Follow the route");
    expect(progress.nextManeuverMeters).toBeCloseTo(progress.remainingMeters, 0);
  });

  it("reports zero distance to the final maneuver at the destination", () => {
    const progress = computeRouteProgress({ lng: -72.91, lat: 41.31 }, sampleRoute);
    expect(progress.nextInstruction).toBe("Arrive");
    expect(progress.nextManeuverMeters).toBe(0);
    expect(progress.remainingMeters).toBe(0);
  });
});

describe("formatGpsSpeed", () => {
  it("hides when accuracy is poor", () => {
    expect(formatGpsSpeed(10, "imperial", 80)).toBeNull();
  });

  it("formats mph when accurate", () => {
    expect(formatGpsSpeed(13.4, "imperial", 10)).toMatch(/mph/);
  });
});

describe("formatSpeedLimit", () => {
  it("hides unknown", () => {
    expect(formatSpeedLimit(null, "imperial")).toBeNull();
  });

  it("converts to mph for imperial", () => {
    expect(formatSpeedLimit(100, "imperial")).toBe("62");
  });
});
