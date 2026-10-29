import {
  ProviderUnavailableError,
  type Route,
  type RouteRequest,
  type TravelMode,
} from "@magnexis/shared";
import type { RoutingProvider } from "./types.js";

const MODE_MAP: Record<TravelMode, string> = {
  driving: "auto",
  walking: "pedestrian",
  cycling: "bicycle",
};

type ValhallaResponse = {
  trip?: {
    summary: { length: number; time: number };
    legs: Array<{
      shape?: string;
      maneuvers: Array<{
        instruction: string;
        type: number;
        length: number;
        time: number;
        begin_shape_index?: number;
      }>;
    }>;
  };
  alternates?: Array<{ trip: ValhallaResponse["trip"] }>;
};

/** Decode Valhalla encoded polyline (precision 1e-6). */
function decodePolyline6(encoded: string): [number, number][] {
  let index = 0;
  const coordinates: [number, number][] = [];
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coordinates.push([lng / 1e6, lat / 1e6]);
  }

  return coordinates;
}

function tripToRoute(
  trip: NonNullable<ValhallaResponse["trip"]>,
  mode: TravelMode,
  id: string,
): Route {
  const leg = trip.legs[0];
  const shape = leg?.shape ? decodePolyline6(leg.shape) : [];
  const maneuvers =
    leg?.maneuvers.map((m) => ({
      instruction: m.instruction,
      type: String(m.type),
      distanceMeters: m.length * 1609.344,
      durationSeconds: m.time,
    })) ?? [];

  return {
    id,
    mode,
    distanceMeters: trip.summary.length * 1609.344,
    durationSeconds: trip.summary.time,
    geometry: { type: "LineString", coordinates: shape },
    maneuvers,
    provider: "valhalla",
    trafficAware: false,
    summary: `${mode} route via Valhalla (no live traffic)`,
  };
}

function costingOptionsFor(request: RouteRequest): Record<string, unknown> {
  const costing = MODE_MAP[request.mode];
  // Valhalla use_* ranges 0–1; 0 = avoid, 1 = prefer.
  const opts: Record<string, unknown> = {
    use_highways: request.avoidHighways ? 0 : 0.5,
    use_tolls: request.avoidTolls ? 0 : 0.5,
    use_ferry: request.avoidFerries ? 0 : 0.5,
  };
  if (request.routePreference === "shortest") {
    opts.shortest = true;
  }
  return { [costing]: opts };
}

export class ValhallaRoutingProvider implements RoutingProvider {
  readonly name = "valhalla";
  readonly configured = true;

  constructor(private readonly baseUrl: string) {}

  async route(request: RouteRequest): Promise<Route[]> {
    const locations = [
      { lat: request.origin.lat, lon: request.origin.lng },
      ...(request.waypoints ?? []).map((w) => ({ lat: w.lat, lon: w.lng })),
      { lat: request.destination.lat, lon: request.destination.lng },
    ];

    const body = {
      locations,
      costing: MODE_MAP[request.mode],
      costing_options: costingOptionsFor(request),
      directions_options: { units: "miles" },
      alternates: request.alternatives ? 1 : 0,
    };

    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new ProviderUnavailableError(
        "valhalla",
        `HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
      );
    }

    const data = (await response.json()) as ValhallaResponse;
    if (!data.trip) {
      throw new ProviderUnavailableError("valhalla", "Empty trip response");
    }

    const routes: Route[] = [tripToRoute(data.trip, request.mode, "primary")];
    for (const [i, alt] of (data.alternates ?? []).entries()) {
      if (alt.trip) {
        routes.push(tripToRoute(alt.trip, request.mode, `alt-${i + 1}`));
      }
    }
    return routes;
  }
}
