/**
 * Hybrid-style vector road overlays for imagery / terrain basemaps.
 *
 * MapTiler satellite-v4 is raster-only; outdoor terrain may omit or bury
 * OpenMapTiles highway casings. Inject major transportation lines from the
 * shared OFM OpenMapTiles source so satellite/terrain match street mode
 * (Google Maps hybrid: imagery + roads + shields + labels).
 */

import { ensureSharedLabelSource, type SharedLabelsMapLike } from "./shared-labels.js";
import { paletteFor, type ChromaticTheme } from "./chromatic.js";

export type ImageryRoadsMapLike = SharedLabelsMapLike & {
  moveLayer?: (id: string, beforeId?: string) => void;
};

const HYBRID_ROAD_IDS = [
  "mx-hybrid-motorway-casing",
  "mx-hybrid-motorway",
  "mx-hybrid-trunk-casing",
  "mx-hybrid-trunk",
  "mx-hybrid-primary-casing",
  "mx-hybrid-primary",
  "mx-hybrid-secondary",
  "mx-hybrid-tertiary",
] as const;

export const IMAGERY_HYBRID_ROAD_IDS = HYBRID_ROAD_IDS;

const LINE_GEOM: unknown[] = [
  "match",
  ["geometry-type"],
  ["LineString", "MultiLineString"],
  true,
  false,
];

/** True when the style already has liberty-like major road line layers. */
export function styleHasMajorRoadLines(map: ImageryRoadsMapLike): boolean {
  const layers = map.getStyle()?.layers ?? [];
  return layers.some(
    (l) =>
      l.type === "line" &&
      !l.id.startsWith("mx-") &&
      /highway_motorway|road_motorway|transportation.*motorway|motorway_inner/i.test(
        l.id,
      ),
  );
}

function beforeLabelId(map: ImageryRoadsMapLike): string | undefined {
  for (const id of [
    "highway-name-major",
    "highway-shield-us-interstate",
    "road_shield_us",
    "highway-shield-non-us",
    "label_city",
    "mx-poi-circle",
    "mx-poi-symbol",
  ]) {
    if (map.getLayer(id)) return id;
  }
  return undefined;
}

function roadSpecs(
  source: string,
  theme: ChromaticTheme,
): Array<Record<string, unknown>> {
  const c = paletteFor(theme);
  // High-contrast fills for reading on satellite / terrain raster.
  const interstate = theme === "standard" ? c.interstate : "#F6C45A";
  const interstateCasing =
    theme === "standard" ? c.interstateCasing : "#8B6914";
  const trunk = theme === "standard" ? c.trunk : "#E8B84A";
  const trunkCasing = theme === "standard" ? c.highwayCasing : "#8B6914";
  const primary = theme === "standard" ? c.primary : "#F0D080";
  const primaryCasing = theme === "standard" ? c.localCasing : "#5A5040";
  const secondary = theme === "standard" ? c.secondary : "#E8E0C8";
  const tertiary = theme === "standard" ? c.tertiary : "#D0D8E0";

  const width = (
    stops: Array<[number, number]>,
  ): unknown[] => ["interpolate", ["linear"], ["zoom"], ...stops.flat()];

  return [
    {
      id: "mx-hybrid-motorway-casing",
      type: "line",
      source,
      "source-layer": "transportation",
      minzoom: 5,
      filter: [
        "all",
        LINE_GEOM,
        ["==", ["get", "class"], "motorway"],
        ["!=", ["get", "ramp"], 1],
      ],
      layout: {
        "line-cap": "round",
        "line-join": "round",
        visibility: "visible",
      },
      paint: {
        "line-color": interstateCasing,
        "line-width": width([
          [5, 1.5],
          [8, 4],
          [12, 8],
          [16, 14],
        ]),
        "line-opacity": 0.95,
      },
    },
    {
      id: "mx-hybrid-motorway",
      type: "line",
      source,
      "source-layer": "transportation",
      minzoom: 5,
      filter: [
        "all",
        LINE_GEOM,
        ["==", ["get", "class"], "motorway"],
        ["!=", ["get", "ramp"], 1],
      ],
      layout: {
        "line-cap": "round",
        "line-join": "round",
        visibility: "visible",
      },
      paint: {
        "line-color": interstate,
        "line-width": width([
          [5, 0.8],
          [8, 2.2],
          [12, 5],
          [16, 10],
        ]),
        "line-opacity": 1,
      },
    },
    {
      id: "mx-hybrid-trunk-casing",
      type: "line",
      source,
      "source-layer": "transportation",
      minzoom: 6,
      filter: ["all", LINE_GEOM, ["==", ["get", "class"], "trunk"]],
      layout: {
        "line-cap": "round",
        "line-join": "round",
        visibility: "visible",
      },
      paint: {
        "line-color": trunkCasing,
        "line-width": width([
          [6, 1.2],
          [10, 3.5],
          [14, 8],
        ]),
        "line-opacity": 0.9,
      },
    },
    {
      id: "mx-hybrid-trunk",
      type: "line",
      source,
      "source-layer": "transportation",
      minzoom: 6,
      filter: ["all", LINE_GEOM, ["==", ["get", "class"], "trunk"]],
      layout: {
        "line-cap": "round",
        "line-join": "round",
        visibility: "visible",
      },
      paint: {
        "line-color": trunk,
        "line-width": width([
          [6, 0.7],
          [10, 2],
          [14, 5.5],
        ]),
        "line-opacity": 1,
      },
    },
    {
      id: "mx-hybrid-primary-casing",
      type: "line",
      source,
      "source-layer": "transportation",
      minzoom: 8,
      filter: ["all", LINE_GEOM, ["==", ["get", "class"], "primary"]],
      layout: {
        "line-cap": "round",
        "line-join": "round",
        visibility: "visible",
      },
      paint: {
        "line-color": primaryCasing,
        "line-width": width([
          [8, 1],
          [12, 3],
          [16, 7],
        ]),
        "line-opacity": 0.85,
      },
    },
    {
      id: "mx-hybrid-primary",
      type: "line",
      source,
      "source-layer": "transportation",
      minzoom: 8,
      filter: ["all", LINE_GEOM, ["==", ["get", "class"], "primary"]],
      layout: {
        "line-cap": "round",
        "line-join": "round",
        visibility: "visible",
      },
      paint: {
        "line-color": primary,
        "line-width": width([
          [8, 0.6],
          [12, 1.8],
          [16, 4.5],
        ]),
        "line-opacity": 0.95,
      },
    },
    {
      id: "mx-hybrid-secondary",
      type: "line",
      source,
      "source-layer": "transportation",
      minzoom: 10,
      filter: [
        "all",
        LINE_GEOM,
        ["match", ["get", "class"], ["secondary", "tertiary"], true, false],
      ],
      layout: {
        "line-cap": "round",
        "line-join": "round",
        visibility: "visible",
      },
      paint: {
        "line-color": [
          "match",
          ["get", "class"],
          "secondary",
          secondary,
          tertiary,
        ],
        "line-width": width([
          [10, 0.5],
          [13, 1.4],
          [16, 3.2],
        ]),
        "line-opacity": 0.9,
      },
    },
    {
      id: "mx-hybrid-tertiary",
      type: "line",
      source,
      "source-layer": "transportation",
      minzoom: 12,
      filter: [
        "all",
        LINE_GEOM,
        [
          "match",
          ["get", "class"],
          ["minor", "service", "street", "path"],
          true,
          false,
        ],
      ],
      layout: {
        "line-cap": "round",
        "line-join": "round",
        visibility: "visible",
      },
      paint: {
        "line-color": tertiary,
        "line-width": width([
          [12, 0.4],
          [15, 1.1],
          [17, 2.4],
        ]),
        "line-opacity": 0.75,
      },
    },
  ];
}

/**
 * Inject (or re-order) hybrid road lines under shared labels / shields.
 * Safe to call on every style.load for satellite & terrain.
 */
export function ensureImageryRoadOverlays(
  map: ImageryRoadsMapLike,
  theme: ChromaticTheme = "night",
  force = false,
): string[] {
  if (!force && styleHasMajorRoadLines(map)) return [];
  if (!map.addLayer) return [];

  const source = ensureSharedLabelSource(map);
  if (!source || (map.getSource && !map.getSource(source))) return [];

  const before = beforeLabelId(map);
  const added: string[] = [];

  for (const layer of roadSpecs(source, theme)) {
    const id = layer.id as string;
    if (map.getLayer(id)) {
      try {
        map.moveLayer?.(id, before);
      } catch {
        // ignore
      }
      continue;
    }
    try {
      map.addLayer(layer, before);
      added.push(id);
    } catch {
      // missing source-layer / style mid-swap
    }
  }
  return added;
}
