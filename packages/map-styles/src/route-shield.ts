/**
 * Magnexis RouteShield — route number / network → shield style.
 * Uses real `ref` / `network` attributes; never invents route numbers.
 */

import { OFM_FONT_BOLD } from "./ofm-fonts.js";

export type RouteNetworkKind =
  | "us-interstate"
  | "us-highway"
  | "us-state"
  | "national"
  | "regional"
  | "unknown";

export type RouteShieldSpec = {
  network: RouteNetworkKind;
  /** Digits / alphanumeric shown on the shield — only when a real ref exists */
  number: string;
  /** Full display label e.g. I-95, US 1, CT 15 */
  label: string;
  /** Sprite / icon image id for MapLibre symbol layers */
  iconId: string;
};

const INTERSTATE_RE = /^(?:US:)?I(?:-|\s)?(\d+[A-Z]?)$/i;
const US_HWY_RE = /^(?:US:)?US(?:-|\s)?(\d+[A-Z]?)$/i;
const STATE_RE =
  /^(?:US:)?([A-Z]{2})(?:-|:|\s)?(?:SR|SH|Route|Hwy|Highway)?\s*(\d+[A-Z]?)$/i;

/**
 * Normalize provider network strings (OpenMapTiles / Overture / Magnexis).
 */
export function classifyNetwork(
  network: string | null | undefined,
  ref: string | null | undefined,
): RouteNetworkKind {
  const n = (network ?? "").toLowerCase().trim();
  const r = (ref ?? "").trim();

  if (
    n.includes("interstate") ||
    n === "us:i" ||
    n === "us-interstate" ||
    /^I[-\s]?\d/i.test(r)
  ) {
    return "us-interstate";
  }
  if (
    n.includes("us_highway") ||
    n.includes("us-highway") ||
    n === "us:us" ||
    /^US[-\s]?\d/i.test(r)
  ) {
    return "us-highway";
  }
  if (
    n.includes("state") ||
    /:state$/i.test(n) ||
    /^[A-Z]{2}[-\s:]/i.test(r)
  ) {
    return "us-state";
  }
  if (n.includes("national") || n.startsWith("ca:") || n.startsWith("gb:")) {
    return "national";
  }
  if (n && n !== "road") return "regional";
  if (r) return "regional";
  return "unknown";
}

/**
 * Extract a shieldable route number from ref. Returns null if no real ref.
 */
export function parseRouteRef(
  ref: string | null | undefined,
  network?: string | null,
): RouteShieldSpec | null {
  const raw = (ref ?? "").trim();
  if (!raw) return null;

  // Multi-ref: "I 95;US 1" — take first segment only
  const first = raw.split(/[;/|]/)[0]?.trim() ?? "";
  if (!first) return null;

  let m = first.match(INTERSTATE_RE);
  if (m?.[1] || classifyNetwork(network, first) === "us-interstate") {
    const num = (
      m?.[1] ??
      first.replace(/^US:I[-\s]?/i, "").replace(/^I[-\s]?/i, "")
    ).trim();
    if (!num || !/\d/.test(num)) return null;
    return {
      network: "us-interstate",
      number: num.toUpperCase(),
      label: `I-${num.toUpperCase()}`,
      iconId: "mx-shield-interstate",
    };
  }

  m = first.match(US_HWY_RE);
  if (m?.[1] || classifyNetwork(network, first) === "us-highway") {
    const num = (
      m?.[1] ??
      first.replace(/^US:US[-\s]?/i, "").replace(/^US[-\s]?/i, "")
    ).trim();
    if (!num || !/\d/.test(num)) return null;
    return {
      network: "us-highway",
      number: num.toUpperCase(),
      label: `US ${num.toUpperCase()}`,
      iconId: "mx-shield-us",
    };
  }

  m = first.match(STATE_RE);
  if (m?.[1] && m[2]) {
    const st = m[1].toUpperCase();
    const num = m[2].toUpperCase();
    return {
      network: "us-state",
      number: num,
      label: `${st} ${num}`,
      iconId: "mx-shield-state",
    };
  }

  // Fallback: keep text but only if it looks like a route marker (has a digit)
  if (!/\d/.test(first)) return null;
  const kind = classifyNetwork(network, first);
  return {
    network: kind === "unknown" ? "regional" : kind,
    number: first.replace(/^[A-Za-z:\s-]+/, "") || first,
    label: first,
    iconId:
      kind === "us-interstate"
        ? "mx-shield-interstate"
        : kind === "us-highway"
          ? "mx-shield-us"
          : "mx-shield-generic",
  };
}

/**
 * Read route fields from a vector feature properties bag (provider-agnostic).
 */
export function shieldFromFeatureProps(
  props: Record<string, unknown> | null | undefined,
): RouteShieldSpec | null {
  if (!props) return null;
  const ref =
    (props.ref as string | undefined) ??
    (props.route_1_ref as string | undefined) ??
    (props["route_1_ref"] as string | undefined) ??
    null;
  const network =
    (props.network as string | undefined) ??
    (props.route_1_network as string | undefined) ??
    null;
  return parseRouteRef(ref, network);
}

/**
 * Compact Google-like shield sizing — small high-contrast plates, not oversized
 * badges. Sprite icons (~20–28px) stay readable without dominating locals.
 */
const SHIELD_ICON_SIZE: unknown[] = [
  "interpolate",
  ["linear"],
  ["zoom"],
  7,
  0.72,
  10,
  0.82,
  14,
  0.92,
  17,
  1.0,
];

const SHIELD_TEXT_SIZE: unknown[] = [
  "interpolate",
  ["linear"],
  ["zoom"],
  7,
  9,
  12,
  10.5,
  16,
  11.5,
];

/** MapLibre layout/paint hints for highway shield symbol layers */
export const ROUTE_SHIELD_LAYER_HINTS = {
  layout: {
    "icon-image": [
      "match",
      ["get", "network"],
      "us-interstate",
      "mx-shield-interstate",
      "us-highway",
      "mx-shield-us",
      "us-state",
      "mx-shield-state",
      "mx-shield-generic",
    ],
    "icon-size": SHIELD_ICON_SIZE,
    "icon-allow-overlap": true,
    "icon-ignore-placement": false,
    "symbol-placement": "line",
    "symbol-spacing": 280,
    "text-field": ["get", "number"],
    "text-size": SHIELD_TEXT_SIZE,
    "text-font": [...OFM_FONT_BOLD],
    "text-offset": [0, 0],
    "text-anchor": "center",
    "text-allow-overlap": true,
  },
  paint: {
    "icon-opacity": 1,
    "text-color": "#FFFFFF",
    "text-halo-color": "rgba(8, 17, 31, 0.85)",
    "text-halo-width": 1.15,
    "text-halo-blur": 0.15,
  },
} as const;

export type RouteShieldMapLike = {
  getStyle: () => {
    layers?: Array<{ id: string; type: string; source?: string }>;
    sources?: Record<string, unknown>;
  };
  getLayer: (id: string) => unknown;
  getSource?: (id: string) => unknown;
  /** Loose signature so MapLibre `Map` is assignable (addLayer param types vary). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addLayer?: (layer: any, beforeId?: string) => unknown;
  /** Move a layer before `beforeId`, or to the top when omitted. */
  moveLayer?: (id: string, beforeId?: string) => unknown;
  setPaintProperty: (id: string, name: string, value: unknown) => void;
  setLayoutProperty?: (id: string, name: string, value: unknown) => void;
};

/** Canonical shield IDs + any basemap symbol layer that carries route refs. */
export function collectRouteShieldLayerIds(map: RouteShieldMapLike): string[] {
  const preferred = [
    "highway-shield-us-interstate",
    "road_shield_us",
    "highway-shield-non-us",
  ];
  const ids: string[] = [];
  for (const id of preferred) {
    if (map.getLayer(id)) ids.push(id);
  }
  const layers = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    if (!layer?.id || layer.type !== "symbol") continue;
    if (ids.includes(layer.id)) continue;
    if (layer.id.startsWith("mx-")) continue;
    const id = layer.id;
    if (
      /^(highway-shield|road_shield)/i.test(id) ||
      (/shield/i.test(id) && !/poi|place|label_city/i.test(id)) ||
      /highway_name_motorway|motorway_ref|road_ref/i.test(id)
    ) {
      ids.push(id);
    }
  }
  return ids;
}

/**
 * Interactive chrome that must stay above cartography (selection, measure, GPS).
 * Place / road labels and shields sit under these so controls stay clickable.
 */
const INTERACTIVE_CHROME_IDS = [
  "mx-selection-circle",
  "mx-measure-line",
  "mx-measure-points",
  "mx-user-loc-accuracy-outline",
  "mx-user-loc-accuracy",
] as const;

/**
 * Line / marker overlays that must sit under map labels (Google Maps–style:
 * roads + pins subdued; town names readable on top).
 */
const LABEL_OCCLUDER_IDS = [
  "mx-hybrid-motorway-casing",
  "mx-hybrid-motorway",
  "mx-hybrid-trunk-casing",
  "mx-hybrid-trunk",
  "mx-hybrid-primary-casing",
  "mx-hybrid-primary",
  "mx-hybrid-secondary",
  "mx-hybrid-tertiary",
  "mx-traffic-raster",
  "mx-traffic-flow",
  "mx-mapillary-sequences",
  "mx-mapillary-images",
  "mx-route-casing",
  "mx-route-line",
  "mx-poi-circle",
  "mx-poi-symbol",
  "mx-basemap-poi",
  "mx-search-results-circle",
  "mx-incidents-circle",
] as const;

/** Canonical place label IDs (kept local to avoid a shared-labels ↔ route-shield cycle). */
const PLACE_LABEL_IDS = [
  "label_country_1",
  "label_country_2",
  "label_country_3",
  "label_state",
  "label_city",
  "label_city_capital",
  "label_town",
  "label_village",
  "label_other",
] as const;

const ROAD_LABEL_IDS = [
  "highway-name-major",
  "highway-name-minor",
  "highway-name-path",
] as const;

function firstExistingLayer(
  map: RouteShieldMapLike,
  ids: readonly string[],
): string | undefined {
  return ids.find((id) => Boolean(map.getLayer(id)));
}

function moveLayersBefore(
  map: RouteShieldMapLike,
  ids: readonly string[],
  beforeId: string | undefined,
  moved: string[],
): void {
  if (!map.moveLayer) return;
  for (const id of ids) {
    if (!map.getLayer(id)) continue;
    try {
      map.moveLayer(id, beforeId);
      moved.push(id);
    } catch {
      // ignore — layer may be mid-remove during style swap
    }
  }
}

/**
 * Google Maps–like label stack (bottom → top among these):
 * road/route/traffic/POI/search overlays → street names → shields →
 * place/town/city labels → selection/measure/GPS chrome.
 *
 * Fixes occlusion where mx-* overlays (search pins, POIs, active route) were
 * added on top of liberty place labels after style.load.
 */
export function promoteMapLabelLayers(map: RouteShieldMapLike): string[] {
  if (!map.moveLayer) return [];
  const moved: string[] = [];

  const chromeBefore = firstExistingLayer(map, INTERACTIVE_CHROME_IDS);

  // Place names highest among cartography (above pins / route / traffic).
  moveLayersBefore(map, PLACE_LABEL_IDS, chromeBefore, moved);
  const placeBefore =
    firstExistingLayer(map, PLACE_LABEL_IDS) ?? chromeBefore;

  const shieldIds = collectRouteShieldLayerIds(map);
  moveLayersBefore(map, shieldIds, placeBefore, moved);
  const shieldBefore =
    firstExistingLayer(map, shieldIds) ?? placeBefore;

  moveLayersBefore(map, ROAD_LABEL_IDS, shieldBefore, moved);
  const labelFloor =
    firstExistingLayer(map, ROAD_LABEL_IDS) ??
    shieldBefore ??
    placeBefore;

  // Push occluding overlays under the label floor so they cannot cover towns.
  moveLayersBefore(map, LABEL_OCCLUDER_IDS, labelFloor, moved);

  return moved;
}

/**
 * @deprecated Prefer {@link promoteMapLabelLayers} — kept as an alias so callers
 * that only knew about shield promotion still get full label z-order.
 */
export function promoteRouteShieldLayers(map: RouteShieldMapLike): string[] {
  return promoteMapLabelLayers(map);
}

/**
 * True when liberty-equivalent US/highway shield layers exist.
 * MapTiler "Highway shield" layers alone do not count — shared labels use OFM IDs.
 */
export function styleHasHighwayShields(map: RouteShieldMapLike): boolean {
  return Boolean(
    map.getLayer("highway-shield-us-interstate") ||
      map.getLayer("road_shield_us") ||
      map.getLayer("highway-shield-non-us"),
  );
}

function resolveOpenMapTilesSourceId(map: RouteShieldMapLike): string | null {
  // Prefer OpenFreeMap OpenMapTiles — never MapTiler planet (different schema).
  if (map.getSource?.("openmaptiles")) return "openmaptiles";
  if (map.getSource?.("mx-openmaptiles")) return "mx-openmaptiles";

  const style = map.getStyle();
  const layers = style?.layers ?? [];
  for (const layer of layers) {
    if (
      layer.source &&
      (layer.source === "openmaptiles" || layer.source === "mx-openmaptiles") &&
      /highway_name|road_motorway|transportation|highway-name|highway-shield/i.test(
        layer.id,
      )
    ) {
      return layer.source;
    }
  }
  const sources = style?.sources ?? {};
  for (const id of Object.keys(sources)) {
    if (/^openmaptiles$|^mx-openmaptiles$|omt/i.test(id)) return id;
  }
  return null;
}

/**
 * OpenFreeMap `dark` (and some stripped styles) omit highway shield layers even
 * though the sprite sheet includes `us-interstate_*` / `us-highway_*` / `us-state_*`.
 * Inject liberty-equivalent shield layers using real tile `ref` / `network` only.
 */
export function ensureRouteShieldLayers(map: RouteShieldMapLike): string[] {
  if (styleHasHighwayShields(map)) return [];
  if (!map.addLayer) return [];

  const source = resolveOpenMapTilesSourceId(map);
  if (!source || (map.getSource && !map.getSource(source))) return [];

  const added: string[] = [];
  const lineGeom: unknown[] = [
    "match",
    ["geometry-type"],
    ["LineString", "MultiLineString"],
    true,
    false,
  ];

  const specs: Array<Record<string, unknown>> = [
    {
      id: "highway-shield-us-interstate",
      type: "symbol",
      source,
      "source-layer": "transportation_name",
      minzoom: 7,
      filter: [
        "all",
        ["<=", ["get", "ref_length"], 6],
        lineGeom,
        ["==", ["get", "network"], "us-interstate"],
      ],
      layout: {
        "icon-image": [
          "concat",
          ["get", "network"],
          "_",
          ["get", "ref_length"],
        ],
        "icon-optional": false,
        "icon-rotation-alignment": "viewport",
        "icon-size": SHIELD_ICON_SIZE,
        "icon-allow-overlap": true,
        "symbol-placement": "line",
        "symbol-spacing": 280,
        "text-field": ["to-string", ["get", "ref"]],
        "text-font": [...OFM_FONT_BOLD],
        "text-rotation-alignment": "viewport",
        "text-size": SHIELD_TEXT_SIZE,
        "text-allow-overlap": true,
        visibility: "visible",
      },
      paint: {
        "icon-opacity": 1,
        "text-opacity": 1,
        "text-color": "#FFFFFF",
        "text-halo-color": "rgba(8, 17, 31, 0.85)",
        "text-halo-width": 1.1,
        "text-halo-blur": 0.15,
      },
    },
    {
      id: "road_shield_us",
      type: "symbol",
      source,
      "source-layer": "transportation_name",
      minzoom: 9,
      filter: [
        "all",
        ["<=", ["get", "ref_length"], 6],
        lineGeom,
        ["match", ["get", "network"], ["us-highway", "us-state"], true, false],
      ],
      layout: {
        "icon-image": [
          "concat",
          ["get", "network"],
          "_",
          ["get", "ref_length"],
        ],
        "icon-optional": false,
        "icon-rotation-alignment": "viewport",
        "icon-size": SHIELD_ICON_SIZE,
        "icon-allow-overlap": true,
        "symbol-placement": "line",
        "symbol-spacing": 280,
        "text-field": ["to-string", ["get", "ref"]],
        "text-font": [...OFM_FONT_BOLD],
        "text-rotation-alignment": "viewport",
        "text-size": SHIELD_TEXT_SIZE,
        "text-allow-overlap": true,
        visibility: "visible",
      },
      paint: {
        "icon-opacity": 1,
        "text-opacity": 1,
        "text-color": "#08111F",
        "text-halo-color": "rgba(255, 255, 255, 0.95)",
        "text-halo-width": 1.2,
        "text-halo-blur": 0.1,
      },
    },
    {
      id: "highway-shield-non-us",
      type: "symbol",
      source,
      "source-layer": "transportation_name",
      minzoom: 8,
      filter: [
        "all",
        ["<=", ["get", "ref_length"], 6],
        lineGeom,
        [
          "match",
          ["get", "network"],
          ["us-highway", "us-interstate", "us-state"],
          false,
          true,
        ],
        ["has", "ref"],
      ],
      layout: {
        "icon-image": ["concat", "road_", ["get", "ref_length"]],
        "icon-optional": false,
        "icon-rotation-alignment": "viewport",
        "icon-size": SHIELD_ICON_SIZE,
        "icon-allow-overlap": true,
        "symbol-placement": "line",
        "symbol-spacing": 280,
        "text-field": ["to-string", ["get", "ref"]],
        "text-font": [...OFM_FONT_BOLD],
        "text-rotation-alignment": "viewport",
        "text-size": SHIELD_TEXT_SIZE,
        "text-allow-overlap": true,
        visibility: "visible",
      },
      paint: {
        "icon-opacity": 1,
        "text-opacity": 1,
        "text-color": "#08111F",
        "text-halo-color": "rgba(255, 255, 255, 0.95)",
        "text-halo-width": 1.2,
        "text-halo-blur": 0.1,
      },
    },
  ];

  for (const layer of specs) {
    const id = layer.id as string;
    if (map.getLayer(id)) continue;
    try {
      map.addLayer(layer);
      added.push(id);
    } catch {
      // Style may lack sprite icons or source-layer — skip silently
    }
  }
  return added;
}

/**
 * Punch up existing basemap shield layers (OpenFreeMap / OMT): full-opacity
 * compact plates, bold high-contrast digits. Does not invent refs.
 *
 * Uses OFM-served Noto Bold only — composite "Noto Sans Bold,Open Sans Bold"
 * 404s and blocks the entire vector tile from rendering.
 */
export function applyRouteShieldLabelContrast(
  map: RouteShieldMapLike,
  night: boolean,
): string[] {
  const adjusted: string[] = [];
  const layers = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    if (!layer?.id || layer.type !== "symbol") continue;
    if (!/shield|highway_name_motorway|road_shield|ref/i.test(layer.id)) {
      continue;
    }
    if (!map.getLayer(layer.id)) continue;
    try {
      const isInterstateShield = /interstate/i.test(layer.id);
      const isIconShield = /shield|road_shield/i.test(layer.id);
      // Colored OFM plates: interstate = white digits; US/state = near-black digits.
      // Text-only motorway refs need light type at night.
      const textColor = isInterstateShield
        ? "#FFFFFF"
        : isIconShield
          ? "#08111F"
          : night
            ? "#FFFFFF"
            : "#08111F";
      const haloColor =
        isInterstateShield || (night && !isIconShield)
          ? "rgba(8, 17, 31, 0.85)"
          : "rgba(255, 255, 255, 0.95)";

      map.setPaintProperty(layer.id, "text-color", textColor);
      map.setPaintProperty(layer.id, "text-halo-color", haloColor);
      map.setPaintProperty(layer.id, "text-halo-width", 1.15);
      map.setPaintProperty(layer.id, "text-halo-blur", 0.15);
      map.setPaintProperty(layer.id, "text-opacity", 1);
      try {
        map.setPaintProperty(layer.id, "icon-opacity", 1);
      } catch {
        // text-only ref layers have no icon
      }

      if (map.setLayoutProperty) {
        map.setLayoutProperty(layer.id, "icon-size", SHIELD_ICON_SIZE);
        map.setLayoutProperty(layer.id, "text-size", SHIELD_TEXT_SIZE);
        map.setLayoutProperty(layer.id, "text-font", [...OFM_FONT_BOLD]);
        map.setLayoutProperty(layer.id, "icon-allow-overlap", true);
        map.setLayoutProperty(layer.id, "text-allow-overlap", true);
      }
      adjusted.push(layer.id);
    } catch {
      // ignore unsupported paint/layout keys
    }
  }
  return adjusted;
}
