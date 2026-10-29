/**
 * Magnexis GeoIntelligence — deterministic analysis entrypoint.
 * Future ML models plug into this boundary; findings are reviewable proposals only.
 */
import { scoreDuplicateCandidate } from "@magnexis/geospatial";

export function analyzeDuplicatePair(
  a: { name: string; coordinates: { lng: number; lat: number } },
  b: { name: string; coordinates: { lng: number; lat: number } },
) {
  return {
    score: scoreDuplicateCandidate(a, b),
    autoApply: false as const,
    kind: "duplicate_candidate" as const,
  };
}

console.log("[intelligence] GeoIntelligence utilities ready (deterministic only).");
