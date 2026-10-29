import type { BBox, Coordinates } from "@magnexis/shared";
import { haversineMeters } from "@magnexis/shared";

export function normalizeLngLat(lng: number, lat: number): Coordinates {
  let nLng = ((((lng + 180) % 360) + 360) % 360) - 180;
  const nLat = Math.max(-90, Math.min(90, lat));
  return { lng: nLng, lat: nLat };
}

/** Treat sub-meter differences as rounding noise for change detection. */
export function roughlyEqualCoordinates(
  a: Coordinates,
  b: Coordinates,
  toleranceMeters = 1,
): boolean {
  return haversineMeters(a, b) <= toleranceMeters;
}

export function bboxAreaSqDegrees(bbox: BBox): number {
  return Math.max(0, bbox.east - bbox.west) * Math.max(0, bbox.north - bbox.south);
}

export function clampBBox(bbox: BBox, maxSpanDegrees = 5): BBox {
  const lngSpan = bbox.east - bbox.west;
  const latSpan = bbox.north - bbox.south;
  if (lngSpan <= maxSpanDegrees && latSpan <= maxSpanDegrees) {
    return bbox;
  }
  const midLng = (bbox.west + bbox.east) / 2;
  const midLat = (bbox.south + bbox.north) / 2;
  const half = maxSpanDegrees / 2;
  return {
    west: midLng - half,
    east: midLng + half,
    south: midLat - half,
    north: midLat + half,
  };
}
