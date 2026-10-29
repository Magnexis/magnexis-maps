import {
  ProviderUnavailableError,
  type Route,
  type RouteRequest,
  type TravelMode,
} from "@magnexis/shared";
import type { RoutingProvider } from "./types.js";

const TRAVEL_MODE: Record<TravelMode, string> = {
  driving: "car",
  walking: "pedestrian",
  cycling: "bicycle",
};

type TomTomPoint = { latitude: number; longitude: number };

type TomTomLeg = {
  points?: TomTomPoint[];
  summary?: {
    lengthInMeters?: number;
    travelTimeInSeconds?: number;
    trafficDelayInSeconds?: number;
  };
  guidance?: {
    instructions?: Array<{
      message?: string;
      manuever?: string;
      maneuver?: string;
      routeOffsetInMeters?: number;
      travelTimeInSeconds?: number;
      point?: TomTomPoint;
    }>;
  };
};

type TomTomRoute = {
  summary?: {
    lengthInMeters?: number;
    travelTimeInSeconds?: number;
    trafficDelayInSeconds?: number;
  };
  legs?: TomTomLeg[];
  sections?: unknown[];
  guidance?: TomTomLeg["guidance"];
};

type TomTomResponse = {
  routes?: TomTomRoute[];
  errorText?: string;
  detailedError?: { message?: string };
};

/**
 * TomTom Routing API (Calculate Route).
 * Key stays on the server — never embed in the browser bundle.
 * @see https://developer.tomtom.com/routing-api
 */
export class TomTomRoutingProvider implements RoutingProvider {
  readonly name = "tomtom";
  readonly configured = true;

  constructor(private readonly apiKey: string) {}

  async route(request: RouteRequest): Promise<Route[]> {
    const points = [
      request.origin,
      ...(request.waypoints ?? []),
      request.destination,
    ]
      .map((c) => `${c.lat},${c.lng}`)
      .join(":");

    const url = new URL(
      `https://api.tomtom.com/routing/1/calculateRoute/${points}/json`,
    );
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("travelMode", TRAVEL_MODE[request.mode] ?? "car");
    url.searchParams.set("traffic", "true");
    url.searchParams.set("instructionsType", "text");
    url.searchParams.set("language", "en-US");
    url.searchParams.set(
      "routeType",
      request.routePreference === "shortest" ? "shortest" : "fastest",
    );
    url.searchParams.set(
      "maxAlternatives",
      request.alternatives && request.mode === "driving" ? "2" : "0",
    );

    // TomTom avoid is pipe-separated: tollRoads|motorways|ferries|…
    if (request.mode === "driving") {
      const avoid: string[] = [];
      if (request.avoidHighways) avoid.push("motorways");
      if (request.avoidTolls) avoid.push("tollRoads");
      if (request.avoidFerries) avoid.push("ferries");
      if (avoid.length) url.searchParams.set("avoid", avoid.join("|"));
    }

    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new ProviderUnavailableError(
        "tomtom",
        `HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
      );
    }

    const data = (await response.json()) as TomTomResponse;
    const routes = data.routes ?? [];
    if (!routes.length) {
      throw new ProviderUnavailableError(
        "tomtom",
        data.errorText ?? data.detailedError?.message ?? "No route found",
      );
    }

    return routes.map((r, i) =>
      tomtomToRoute(r, request.mode, i === 0 ? "primary" : `alt-${i}`),
    );
  }
}

function tomtomToRoute(r: TomTomRoute, mode: TravelMode, id: string): Route {
  const coordinates: [number, number][] = [];
  for (const leg of r.legs ?? []) {
    for (const p of leg.points ?? []) {
      coordinates.push([p.longitude, p.latitude]);
    }
  }

  const instructions =
    r.guidance?.instructions ??
    r.legs?.flatMap((leg) => leg.guidance?.instructions ?? []) ??
    [];

  const maneuvers = instructions.map((ins) => ({
    instruction: ins.message ?? "Continue",
    type: ins.maneuver ?? ins.manuever,
    distanceMeters: Math.max(0, ins.routeOffsetInMeters ?? 0),
    durationSeconds: Math.max(0, ins.travelTimeInSeconds ?? 0),
    coordinates: ins.point
      ? { lng: ins.point.longitude, lat: ins.point.latitude }
      : undefined,
  }));

  const distanceMeters = r.summary?.lengthInMeters ?? 0;
  const durationSeconds = r.summary?.travelTimeInSeconds ?? 0;
  const delay = Math.max(0, r.summary?.trafficDelayInSeconds ?? 0);

  return {
    id,
    mode,
    distanceMeters,
    durationSeconds,
    geometry: { type: "LineString", coordinates },
    maneuvers,
    provider: "tomtom",
    trafficAware: true,
    trafficDelaySeconds: delay > 0 ? delay : undefined,
    summary:
      delay > 0
        ? `${mode} via TomTom · +${Math.round(delay / 60)} min traffic`
        : `${mode} via TomTom (live traffic)`,
  };
}
