/**
 * Resolve a real live-traffic tile source for MapLibre.
 * Never invents congestion — returns null when no provider key/URL is configured.
 *
 * Priority:
 * 1. NEXT_PUBLIC_TRAFFIC_TILES_URL — custom TileJSON or XYZ template
 * 2. NEXT_PUBLIC_TOMTOM_TRAFFIC_PROXY=1 — tiles via Magnexis API (TOMTOM_API_KEY server-only)
 * 3. NEXT_PUBLIC_TOMTOM_KEY — legacy browser key (restrict in TomTom dashboard)
 * 4. NEXT_PUBLIC_MAPBOX_TOKEN — Mapbox Traffic v1
 * 5. MapTiler traffic tileset when explicitly opted in
 */
import { resolveApiBase } from "./api-base";

export type TrafficSourceConfig =
  | {
      kind: "vector-tilejson";
      id: string;
      url: string;
      sourceLayer: string;
      congestionProperty: string;
      provider: string;
    }
  | {
      kind: "vector-tiles";
      id: string;
      tiles: string[];
      sourceLayer: string;
      congestionProperty: string;
      minzoom?: number;
      maxzoom?: number;
      provider: string;
    }
  | {
      kind: "raster-tiles";
      id: string;
      tiles: string[];
      tileSize?: number;
      provider: string;
    };

function readKey(...keys: Array<string | undefined>): string {
  for (const k of keys) {
    const v = (k ?? "").trim();
    if (v) return v;
  }
  return "";
}

export function resolveTrafficSource(): TrafficSourceConfig | null {
  const custom = readKey(process.env.NEXT_PUBLIC_TRAFFIC_TILES_URL);
  if (custom) {
    if (custom.includes("{z}") || custom.includes("{x}")) {
      const isRaster = /\.(png|jpg|jpeg|webp)(\?|$)/i.test(custom);
      if (isRaster) {
        return {
          kind: "raster-tiles",
          id: "mx-traffic",
          tiles: [custom],
          tileSize: 256,
          provider: "custom",
        };
      }
      return {
        kind: "vector-tiles",
        id: "mx-traffic",
        tiles: [custom],
        sourceLayer: process.env.NEXT_PUBLIC_TRAFFIC_SOURCE_LAYER || "traffic",
        congestionProperty:
          process.env.NEXT_PUBLIC_TRAFFIC_CONGESTION_PROP || "congestion",
        provider: "custom",
      };
    }
    return {
      kind: "vector-tilejson",
      id: "mx-traffic",
      url: custom,
      sourceLayer: process.env.NEXT_PUBLIC_TRAFFIC_SOURCE_LAYER || "traffic",
      congestionProperty:
        process.env.NEXT_PUBLIC_TRAFFIC_CONGESTION_PROP || "congestion",
      provider: "custom",
    };
  }

  // Preferred: server proxy — TOMTOM_API_KEY never ships to the browser.
  // next.config sets NEXT_PUBLIC_TOMTOM_TRAFFIC_PROXY=1 when root TOMTOM_API_KEY exists.
  const proxyFlag = (process.env.NEXT_PUBLIC_TOMTOM_TRAFFIC_PROXY ?? "")
    .trim()
    .toLowerCase();
  const useTomTomProxy = proxyFlag === "1" || proxyFlag === "true";
  const apiBase = resolveApiBase();
  if (useTomTomProxy) {
    return {
      kind: "vector-tiles",
      id: "mx-traffic",
      tiles: [`${apiBase}/api/v1/tiles/tomtom/traffic/{z}/{x}/{y}`],
      sourceLayer: "Traffic flow",
      congestionProperty: "traffic_level",
      minzoom: 0,
      maxzoom: 22,
      provider: "tomtom",
    };
  }

  // Legacy: browser-exposed key (restrict by HTTP referrer in TomTom dashboard).
  const tomtomPublic = readKey(process.env.NEXT_PUBLIC_TOMTOM_KEY);
  if (tomtomPublic) {
    return {
      kind: "vector-tiles",
      id: "mx-traffic",
      tiles: [
        `https://api.tomtom.com/traffic/map/4/tile/flow/relative/{z}/{x}/{y}.pbf?key=${encodeURIComponent(tomtomPublic)}`,
      ],
      sourceLayer: "Traffic flow",
      congestionProperty: "traffic_level",
      minzoom: 0,
      maxzoom: 22,
      provider: "tomtom",
    };
  }

  const mapbox = readKey(
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
    process.env.MAPBOX_ACCESS_TOKEN,
  );
  if (mapbox) {
    return {
      kind: "vector-tilejson",
      id: "mx-traffic",
      url: `https://api.mapbox.com/v4/mapbox.mapbox-traffic-v1.json?access_token=${encodeURIComponent(mapbox)}`,
      sourceLayer: "traffic",
      congestionProperty: "congestion",
      provider: "mapbox",
    };
  }

  // MapTiler Cloud does not always expose a public `traffic` tileset on free keys
  // (often 404). Opt in explicitly once the tileset exists on the account:
  // NEXT_PUBLIC_MAPTILER_TRAFFIC=1 with NEXT_PUBLIC_MAPTILER_KEY set.
  const maptiler = readKey(
    process.env.NEXT_PUBLIC_MAPTILER_KEY,
    process.env.MAPTILER_KEY,
  );
  const maptilerTraffic =
    (process.env.NEXT_PUBLIC_MAPTILER_TRAFFIC ?? "").trim() === "1" ||
    (process.env.NEXT_PUBLIC_MAPTILER_TRAFFIC ?? "").toLowerCase() === "true";
  if (maptiler && maptilerTraffic) {
    const tileset =
      process.env.NEXT_PUBLIC_MAPTILER_TRAFFIC_TILESET?.trim() || "traffic";
    return {
      kind: "vector-tilejson",
      id: "mx-traffic",
      url: `https://api.maptiler.com/tiles/${encodeURIComponent(tileset)}/tiles.json?key=${encodeURIComponent(maptiler)}`,
      sourceLayer:
        process.env.NEXT_PUBLIC_TRAFFIC_SOURCE_LAYER?.trim() || "traffic",
      congestionProperty:
        process.env.NEXT_PUBLIC_TRAFFIC_CONGESTION_PROP?.trim() || "congestion",
      provider: "maptiler",
    };
  }

  return null;
}

export function trafficConfigured(): boolean {
  return resolveTrafficSource() != null;
}

/**
 * MapLibre line-color for congestion — muted amber / soft coral, not harsh red.
 * Paired with low opacity + dash in the overlay paint so traffic reads as a
 * distinct overlay rather than solid road paint.
 */
export function trafficLineColorExpression(
  property: string,
  provider: string,
): unknown {
  if (provider === "tomtom" || property === "traffic_level") {
    // 0 free → 1 jammed (amber → soft coral; never solid #e74c3c / #8b0000)
    return [
      "interpolate",
      ["linear"],
      ["to-number", ["get", property]],
      0,
      "#c9b896",
      0.35,
      "#e0b85c",
      0.6,
      "#d9924a",
      0.85,
      "#c87a68",
      1,
      "#b86a6a",
    ];
  }

  // Mapbox / generic: low | moderate | heavy | severe
  return [
    "match",
    ["get", property],
    "low",
    "#c9b896",
    "moderate",
    "#e0b85c",
    "heavy",
    "#d9924a",
    "severe",
    "#c87a68",
    /* default */ "#a8a29e",
  ];
}
