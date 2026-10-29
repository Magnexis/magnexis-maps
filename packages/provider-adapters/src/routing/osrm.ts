import {
  ProviderUnavailableError,
  type Route,
  type RouteRequest,
  type TravelMode,
} from "@magnexis/shared";
import type { RoutingProvider } from "./types.js";

const PROFILE: Record<TravelMode, string> = {
  driving: "driving",
  walking: "walking",
  cycling: "cycling",
};

type OsrmStep = {
  name?: string;
  maneuver?: { type?: string; modifier?: string; instruction?: string };
  distance?: number;
  duration?: number;
  geometry?: { coordinates?: [number, number][] };
};

type OsrmLeg = {
  steps?: OsrmStep[];
};

type OsrmRoute = {
  distance: number;
  duration: number;
  geometry?: { type?: string; coordinates?: [number, number][] };
  legs?: OsrmLeg[];
};

type OsrmResponse = {
  code?: string;
  message?: string;
  routes?: OsrmRoute[];
};

/**
 * Build OSRM `exclude` for the driving profile.
 * Public car profile supports: motorway, toll, ferry (when present in the graph).
 * @see https://project-osrm.org/docs/v5.24.0/api/#route-service
 */
function osrmExcludeClasses(request: RouteRequest): string[] {
  if (request.mode !== "driving") return [];
  const classes: string[] = [];
  if (request.avoidHighways) classes.push("motorway");
  if (request.avoidTolls) classes.push("toll");
  if (request.avoidFerries) classes.push("ferry");
  return classes;
}

function rankRoutes(
  routes: Route[],
  preference: RouteRequest["routePreference"],
): Route[] {
  const ranked = [...routes].sort((a, b) =>
    preference === "shortest"
      ? a.distanceMeters - b.distanceMeters
      : a.durationSeconds - b.durationSeconds,
  );
  return ranked.map((r, i) => ({
    ...r,
    id: i === 0 ? "primary" : `alt-${i}`,
  }));
}

/**
 * OSRM HTTP API adapter (self-hosted or public demo).
 * Default demo: https://router.project-osrm.org (reasonable non-commercial use).
 * @see https://project-osrm.org/docs/v5.24.0/api/#route-service
 */
export class OsrmRoutingProvider implements RoutingProvider {
  readonly name = "osrm";
  readonly configured = true;

  constructor(private readonly baseUrl: string) {}

  async route(request: RouteRequest): Promise<Route[]> {
    const profile = PROFILE[request.mode] ?? "driving";
    const points = [
      request.origin,
      ...(request.waypoints ?? []),
      request.destination,
    ]
      .map((c) => `${c.lng},${c.lat}`)
      .join(";");

    const url = new URL(
      `${this.baseUrl.replace(/\/$/, "")}/route/v1/${profile}/${points}`,
    );
    url.searchParams.set("overview", "full");
    url.searchParams.set("geometries", "geojson");
    url.searchParams.set("steps", "true");

    // Need alternatives when preferring shortest so we can rank by distance.
    const wantAlts =
      request.alternatives ||
      (request.mode === "driving" && request.routePreference === "shortest");
    url.searchParams.set("alternatives", wantAlts ? "true" : "false");

    const exclude = osrmExcludeClasses(request);
    if (exclude.length) {
      url.searchParams.set("exclude", exclude.join(","));
    }

    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new ProviderUnavailableError(
        "osrm",
        `HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
      );
    }

    const data = (await response.json()) as OsrmResponse;
    if (data.code && data.code !== "Ok") {
      throw new ProviderUnavailableError(
        "osrm",
        data.message ?? data.code,
      );
    }

    const routes = data.routes ?? [];
    if (!routes.length) {
      throw new ProviderUnavailableError("osrm", "No route found");
    }

    const mapped = routes.map((r, i) =>
      osrmToRoute(r, request.mode, i === 0 ? "primary" : `alt-${i}`),
    );
    return rankRoutes(mapped, request.routePreference ?? "fastest");
  }
}

function osrmToRoute(r: OsrmRoute, mode: TravelMode, id: string): Route {
  const coordinates = r.geometry?.coordinates ?? [];
  const maneuvers =
    r.legs?.flatMap((leg) =>
      (leg.steps ?? []).map((step) => {
        const m = step.maneuver;
        const fallback = [m?.type, m?.modifier, step.name]
          .filter(Boolean)
          .join(" ");
        const instruction = m?.instruction ?? (fallback || "Continue");
        return {
          instruction,
          type: m?.type,
          distanceMeters: step.distance ?? 0,
          durationSeconds: step.duration ?? 0,
          coordinates: step.geometry?.coordinates?.[0]
            ? {
                lng: step.geometry.coordinates[0][0],
                lat: step.geometry.coordinates[0][1],
              }
            : undefined,
        };
      }),
    ) ?? [];

  return {
    id,
    mode,
    distanceMeters: r.distance,
    durationSeconds: r.duration,
    geometry: { type: "LineString", coordinates },
    maneuvers,
    provider: "osrm",
    trafficAware: false,
    summary: `${mode} via OSRM`,
  };
}
