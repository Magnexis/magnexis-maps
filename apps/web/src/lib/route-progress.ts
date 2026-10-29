import { haversineMeters } from "@magnexis/shared";
import type { Route } from "@magnexis/shared";

export type RouteProgress = {
  /** Meters left along the polyline from the snap point to the destination. */
  remainingMeters: number;
  /** Full route length (provider). */
  totalMeters: number;
  /** Fraction 0–1 of route completed (by distance along geometry). */
  fractionComplete: number;
  /** Estimated seconds left (scales full duration by remaining fraction). */
  remainingSeconds: number;
  /** Distance to the next maneuver point (or remaining if none). */
  nextManeuverMeters: number;
  nextManeuverIndex: number;
  nextInstruction: string;
};

/**
 * Project GPS onto the route LineString and compute live remaining distance.
 * Uses cumulative segment lengths — not the full-route provider total alone.
 */
export function computeRouteProgress(
  position: { lng: number; lat: number },
  route: Route,
): RouteProgress {
  const coords = route.geometry.coordinates;
  const totalProvider = Math.max(0, route.distanceMeters);
  const empty: RouteProgress = {
    remainingMeters: totalProvider,
    totalMeters: totalProvider,
    fractionComplete: 0,
    remainingSeconds: Math.max(0, route.durationSeconds),
    nextManeuverMeters: route.maneuvers[0]?.distanceMeters ?? totalProvider,
    nextManeuverIndex: 0,
    nextInstruction:
      route.maneuvers[0]?.instruction ?? "Follow the route",
  };

  if (!coords.length) return empty;

  // Cumulative distance along polyline
  const cum: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1]!;
    const b = coords[i]!;
    cum.push(
      cum[i - 1]! +
        haversineMeters(
          { lng: a[0], lat: a[1] },
          { lng: b[0], lat: b[1] },
        ),
    );
  }
  const geomTotal = cum[cum.length - 1] ?? 0;
  if (geomTotal <= 0) return empty;

  // Use the same geometry distance basis for GPS fixes and maneuver points.
  const alongRoute = (point: { lng: number; lat: number }): number => {
    let bestDist = Infinity;
    let bestAlong = 0;
    for (let i = 1; i < coords.length; i++) {
      const a = coords[i - 1]!;
      const b = coords[i]!;
      const proj = projectOnSegment(
        point,
        { lng: a[0], lat: a[1] },
        { lng: b[0], lat: b[1] },
      );
      if (proj.dist < bestDist) {
        bestDist = proj.dist;
        bestAlong = cum[i - 1]! + proj.alongSegment;
      }
    }
    return bestAlong;
  };
  const bestAlong = alongRoute(position);
  const distanceScale = totalProvider > 0 ? totalProvider / geomTotal : 1;

  const remainingMeters = Math.max(0, geomTotal - bestAlong);
  const fractionComplete = Math.min(1, Math.max(0, bestAlong / geomTotal));
  const remainingSeconds = Math.max(
    0,
    Math.round(route.durationSeconds * (1 - fractionComplete)),
  );

  // TomTom supplies offsets from the route start; OSRM and Valhalla supply
  // step lengths. Prefer real maneuver locations, otherwise normalize offsets
  // into geometry meters before comparing them with the snapped GPS position.
  let stepOffset = 0;
  const maneuverOffsets = route.maneuvers.map((maneuver) => {
    const providerOffset = route.provider === "tomtom"
      ? maneuver.distanceMeters
      : stepOffset;
    stepOffset += Math.max(0, maneuver.distanceMeters);
    return maneuver.coordinates
      ? alongRoute(maneuver.coordinates)
      : Math.min(geomTotal, Math.max(0, providerOffset / distanceScale));
  });
  const upcomingIndex = maneuverOffsets.findIndex(
    (offset) => offset >= bestAlong - 15,
  );
  const nextManeuverIndex = upcomingIndex >= 0
    ? upcomingIndex
    : Math.max(0, route.maneuvers.length - 1);
  const nextInstruction = route.maneuvers[nextManeuverIndex]?.instruction
    ?? empty.nextInstruction;
  const nextManeuverMeters = upcomingIndex >= 0
    ? Math.max(0, maneuverOffsets[upcomingIndex]! - bestAlong) * distanceScale
    : remainingMeters * distanceScale;

  return {
    remainingMeters:
      totalProvider > 0
        ? Math.min(totalProvider, remainingMeters * (totalProvider / geomTotal))
        : remainingMeters,
    totalMeters: totalProvider || geomTotal,
    fractionComplete,
    remainingSeconds,
    nextManeuverMeters,
    nextManeuverIndex,
    nextInstruction,
  };
}

function projectOnSegment(
  p: { lng: number; lat: number },
  a: { lng: number; lat: number },
  b: { lng: number; lat: number },
): { dist: number; alongSegment: number } {
  const segLen = haversineMeters(a, b);
  if (segLen < 0.5) {
    return { dist: haversineMeters(p, a), alongSegment: 0 };
  }
  // Equirectangular local projection for t
  const lat0 = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const ax = a.lng * Math.cos(lat0);
  const ay = a.lat;
  const bx = b.lng * Math.cos(lat0);
  const by = b.lat;
  const px = p.lng * Math.cos(lat0);
  const py = p.lat;
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.min(
    1,
    Math.max(0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)),
  );
  const qx = ax + t * dx;
  const qy = ay + t * dy;
  const q = { lng: qx / Math.cos(lat0), lat: qy };
  return {
    dist: haversineMeters(p, q),
    alongSegment: t * segLen,
  };
}

/** Format current speed from GPS m/s — hide when accuracy is poor or speed unknown. */
export function formatGpsSpeed(
  speedMps: number | null | undefined,
  units: "imperial" | "metric",
  accuracyMeters?: number | null,
): string | null {
  if (speedMps == null || !Number.isFinite(speedMps) || speedMps < 0) {
    return null;
  }
  // GPS speed is noisy when accuracy is bad or nearly stopped
  if (accuracyMeters != null && accuracyMeters > 45) return null;
  if (speedMps < 0.8) return units === "metric" ? "0 km/h" : "0 mph";
  if (units === "metric") {
    return `${Math.round(speedMps * 3.6)} km/h`;
  }
  return `${Math.round(speedMps * 2.23694)} mph`;
}

export function formatSpeedLimit(
  kph: number | null | undefined,
  units: "imperial" | "metric",
): string | null {
  if (kph == null || !Number.isFinite(kph) || kph <= 0) return null;
  if (units === "metric") return `${Math.round(kph)}`;
  return `${Math.round(kph / 1.60934)}`;
}
