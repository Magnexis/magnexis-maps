import { describe, expect, it } from "vitest";
import {
  haversineMeters,
  isValidBBox,
  pointInBBox,
  CoordinatesSchema,
} from "./schemas/geo.js";
import { CT_BBOX, CT_CENTER } from "./constants.js";

describe("geographic calculations", () => {
  it("validates coordinates", () => {
    expect(CoordinatesSchema.parse({ lng: -72.9, lat: 41.3 })).toEqual({
      lng: -72.9,
      lat: 41.3,
    });
    expect(() => CoordinatesSchema.parse({ lng: 200, lat: 0 })).toThrow();
  });

  it("computes haversine distance between nearby CT points", () => {
    const newHaven = { lng: -72.9279, lat: 41.3083 };
    const hartford = { lng: -72.6851, lat: 41.7637 };
    const meters = haversineMeters(newHaven, hartford);
    expect(meters).toBeGreaterThan(40_000);
    expect(meters).toBeLessThan(80_000);
  });

  it("validates CT bbox and containment", () => {
    expect(isValidBBox(CT_BBOX)).toBe(true);
    expect(pointInBBox(CT_CENTER, CT_BBOX)).toBe(true);
    expect(pointInBBox({ lng: -74, lat: 40.7 }, CT_BBOX)).toBe(false);
  });
});
