/**
 * Shared map label pipeline — same street / place / highway label set on every
 * basemap (liberty, night Chromatic, terrain, satellite imagery).
 *
 * Root cause for blank satellite labels: MapTiler satellite-v4 includes label
 * layers with layout.visibility "none" and a different tile schema than
 * OpenFreeMap liberty. We always ensure liberty-equivalent OpenMapTiles layers
 * from the OFM planet source, reveal them, and suppress foreign provider labels.
 */

import type { ChromaticTheme } from "./chromatic.js";
import { paletteFor } from "./chromatic.js";
import {
  OFM_FONT_BOLD,
  OFM_FONT_ITALIC,
  OFM_FONT_REGULAR,
} from "./ofm-fonts.js";

/** Canonical road-name layer IDs (OpenFreeMap liberty). */
export const SHARED_ROAD_LABEL_IDS = [
  "highway-name-major",
  "highway-name-minor",
  "highway-name-path",
] as const;

/** Canonical place label layer IDs (OpenFreeMap liberty). */
export const SHARED_PLACE_LABEL_IDS = [
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

/** Canonical highway shield layer IDs (liberty / RouteShield injection). */
export const SHARED_SHIELD_LABEL_IDS = [
  "highway-shield-us-interstate",
  "road_shield_us",
  "highway-shield-non-us",
] as const;

export const SHARED_LABEL_IDS = [
  ...SHARED_ROAD_LABEL_IDS,
  ...SHARED_PLACE_LABEL_IDS,
  ...SHARED_SHIELD_LABEL_IDS,
] as const;

const SHARED_SOURCE_ID = "mx-openmaptiles";
const OFM_PLANET_URL = "https://tiles.openfreemap.org/planet";
/** Liberty glyph + shield sprite — required when MapTiler imagery styles lack Noto Sans / US shields. */
export const OFM_GLYPHS_URL =
  "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
export const OFM_SPRITE_URL =
  "https://tiles.openfreemap.org/sprites/ofm_f384/ofm";

const NAME_FIELD: unknown[] = [
  "case",
  ["has", "name:nonlatin"],
  ["concat", ["get", "name:latin"], " ", ["get", "name:nonlatin"]],
  ["coalesce", ["get", "name_en"], ["get", "name"], ["get", "name:en"], ""],
];

const NAME_FIELD_NL: unknown[] = [
  "case",
  ["has", "name:nonlatin"],
  ["concat", ["get", "name:latin"], "\n", ["get", "name:nonlatin"]],
  ["coalesce", ["get", "name_en"], ["get", "name"], ["get", "name:en"], ""],
];

const LINE_GEOM: unknown[] = [
  "match",
  ["geometry-type"],
  ["LineString", "MultiLineString"],
  true,
  false,
];

const TEXT_SIZE_ROAD: unknown[] = [
  "interpolate",
  ["linear"],
  ["zoom"],
  13,
  12,
  14,
  13,
];

export type LabelSurface = "vector" | "imagery";

export type SharedLabelsMapLike = {
  getStyle: () => {
    layers?: Array<{
      id: string;
      type: string;
      source?: string;
      "source-layer"?: string;
      layout?: Record<string, unknown>;
    }>;
    sources?: Record<string, unknown>;
    glyphs?: string;
    sprite?: string | { url?: string } | Array<{ url?: string; id?: string }>;
  };
  getLayer: (id: string) => unknown;
  getSource?: (id: string) => unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addSource?: (id: string, source: any) => unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addLayer?: (layer: any, beforeId?: string) => unknown;
  setPaintProperty: (id: string, name: string, value: unknown) => void;
  setLayoutProperty?: (id: string, name: string, value: unknown) => void;
  setGlyphs?: (glyphsUrl: string | null) => unknown;
  setSprite?: (spriteUrl: string | null) => unknown;
};

function styleGlyphsUrl(map: SharedLabelsMapLike): string {
  return map.getStyle()?.glyphs ?? "";
}

function styleUsesOfmGlyphs(map: SharedLabelsMapLike): boolean {
  return /openfreemap\.org\/fonts/i.test(styleGlyphsUrl(map));
}

function styleUsesOfmSprite(map: SharedLabelsMapLike): boolean {
  const sprite = map.getStyle()?.sprite;
  const url =
    typeof sprite === "string"
      ? sprite
      : Array.isArray(sprite)
        ? sprite.map((s) => s?.url ?? "").join(" ")
        : (sprite?.url ?? "");
  return /openfreemap\.org\/sprites/i.test(url);
}

/**
 * Point the style at OpenFreeMap fonts (and optionally liberty sprites) so
 * shared road/place labels + US route shields render on MapTiler satellite /
 * outdoor styles that ship different glyph stacks or no shield icons.
 */
export function ensureSharedCartographyAssets(
  map: SharedLabelsMapLike,
  options: { sprite?: boolean } = {},
): { glyphs: boolean; sprite: boolean } {
  let glyphs = false;
  let sprite = false;
  if (!styleUsesOfmGlyphs(map) && map.setGlyphs) {
    try {
      map.setGlyphs(OFM_GLYPHS_URL);
      glyphs = true;
    } catch {
      // ignore
    }
  }
  if (options.sprite && !styleUsesOfmSprite(map) && map.setSprite) {
    try {
      map.setSprite(OFM_SPRITE_URL);
      sprite = true;
    } catch {
      // ignore
    }
  }
  return { glyphs, sprite };
}

/**
 * Prefer liberty `openmaptiles`, else our injected OFM source.
 * Never use MapTiler planet — schema differs (road_label vs transportation_name).
 */
export function resolveSharedLabelSourceId(
  map: SharedLabelsMapLike,
): string | null {
  if (map.getSource?.("openmaptiles")) return "openmaptiles";
  if (map.getSource?.(SHARED_SOURCE_ID)) return SHARED_SOURCE_ID;
  return null;
}

/** Ensure OpenFreeMap OpenMapTiles vector tiles are available for shared labels. */
export function ensureSharedLabelSource(map: SharedLabelsMapLike): string | null {
  const existing = resolveSharedLabelSourceId(map);
  if (existing) return existing;
  if (!map.addSource) return null;
  try {
    map.addSource(SHARED_SOURCE_ID, {
      type: "vector",
      url: OFM_PLANET_URL,
    });
    return SHARED_SOURCE_ID;
  } catch {
    return null;
  }
}

export function styleHasSharedRoadLabels(map: SharedLabelsMapLike): boolean {
  return SHARED_ROAD_LABEL_IDS.every((id) => Boolean(map.getLayer(id)));
}

function imageryLabelPaint(major: boolean): Record<string, unknown> {
  return {
    "text-color": major ? "#FFFFFF" : "#F4F6FA",
    "text-halo-color": "rgba(0, 0, 0, 0.88)",
    "text-halo-width": major ? 1.85 : 1.5,
    "text-halo-blur": 0.4,
  };
}

function vectorLabelPaint(
  theme: ChromaticTheme,
  major: boolean,
): Record<string, unknown> {
  const c = paletteFor(theme);
  return {
    "text-color": major ? c.labelMajor : c.labelSecondary,
    "text-halo-color": c.labelHalo,
    "text-halo-width": major ? 1.6 : 1.25,
    "text-halo-blur": 0.5,
  };
}

function labelPaint(
  surface: LabelSurface,
  theme: ChromaticTheme,
  major: boolean,
): Record<string, unknown> {
  return surface === "imagery"
    ? imageryLabelPaint(major)
    : vectorLabelPaint(theme, major);
}

function roadLabelSpecs(
  source: string,
  surface: LabelSurface,
  theme: ChromaticTheme,
): Array<Record<string, unknown>> {
  const majorPaint = labelPaint(surface, theme, true);
  const minorPaint = labelPaint(surface, theme, false);
  return [
    {
      id: "highway-name-major",
      type: "symbol",
      source,
      "source-layer": "transportation_name",
      minzoom: 12.2,
      filter: [
        "match",
        ["get", "class"],
        ["primary", "secondary", "tertiary", "trunk"],
        true,
        false,
      ],
      layout: {
        "symbol-placement": "line",
        "text-field": NAME_FIELD,
        "text-font": [...OFM_FONT_REGULAR],
        "text-rotation-alignment": "map",
        "text-size": TEXT_SIZE_ROAD,
        visibility: "visible",
      },
      paint: majorPaint,
    },
    {
      id: "highway-name-minor",
      type: "symbol",
      source,
      "source-layer": "transportation_name",
      minzoom: 15,
      filter: [
        "all",
        LINE_GEOM,
        [
          "match",
          ["get", "class"],
          ["minor", "service", "track"],
          true,
          false,
        ],
      ],
      layout: {
        "symbol-placement": "line",
        "text-field": NAME_FIELD,
        "text-font": [...OFM_FONT_REGULAR],
        "text-rotation-alignment": "map",
        "text-size": TEXT_SIZE_ROAD,
        visibility: "visible",
      },
      paint: minorPaint,
    },
    {
      id: "highway-name-path",
      type: "symbol",
      source,
      "source-layer": "transportation_name",
      minzoom: 15.5,
      filter: ["==", ["get", "class"], "path"],
      layout: {
        "symbol-placement": "line",
        "text-field": NAME_FIELD,
        "text-font": [...OFM_FONT_REGULAR],
        "text-rotation-alignment": "map",
        "text-size": TEXT_SIZE_ROAD,
        visibility: "visible",
      },
      paint: minorPaint,
    },
  ];
}

function placeLabelSpecs(
  source: string,
  surface: LabelSurface,
  theme: ChromaticTheme,
): Array<Record<string, unknown>> {
  const major = labelPaint(surface, theme, true);
  const secondary = labelPaint(surface, theme, false);
  // Text-only place labels (no sprite dots) so MapTiler styles without OFM
  // sprites still render identical name coverage.
  return [
    {
      id: "label_country_1",
      type: "symbol",
      source,
      "source-layer": "place",
      maxzoom: 9,
      filter: [
        "all",
        ["==", ["get", "class"], "country"],
        ["==", ["get", "rank"], 1],
      ],
      layout: {
        "text-field": NAME_FIELD_NL,
        "text-font": [...OFM_FONT_BOLD],
        "text-max-width": 6.25,
        "text-size": ["interpolate", ["linear"], ["zoom"], 1, 9, 4, 17],
        visibility: "visible",
      },
      paint: major,
    },
    {
      id: "label_country_2",
      type: "symbol",
      source,
      "source-layer": "place",
      maxzoom: 9,
      filter: [
        "all",
        ["==", ["get", "class"], "country"],
        ["==", ["get", "rank"], 2],
      ],
      layout: {
        "text-field": NAME_FIELD_NL,
        "text-font": [...OFM_FONT_BOLD],
        "text-max-width": 6.25,
        "text-size": ["interpolate", ["linear"], ["zoom"], 2, 9, 5, 17],
        visibility: "visible",
      },
      paint: major,
    },
    {
      id: "label_country_3",
      type: "symbol",
      source,
      "source-layer": "place",
      minzoom: 2,
      maxzoom: 9,
      filter: [
        "all",
        ["==", ["get", "class"], "country"],
        [">=", ["get", "rank"], 3],
      ],
      layout: {
        "text-field": NAME_FIELD_NL,
        "text-font": [...OFM_FONT_BOLD],
        "text-max-width": 6.25,
        "text-size": ["interpolate", ["linear"], ["zoom"], 3, 9, 7, 17],
        visibility: "visible",
      },
      paint: major,
    },
    {
      id: "label_state",
      type: "symbol",
      source,
      "source-layer": "place",
      minzoom: 5,
      maxzoom: 8,
      filter: ["==", ["get", "class"], "state"],
      layout: {
        "text-field": NAME_FIELD_NL,
        "text-font": [...OFM_FONT_ITALIC],
        "text-letter-spacing": 0.2,
        "text-max-width": 9,
        "text-size": ["interpolate", ["linear"], ["zoom"], 5, 10, 8, 14],
        "text-transform": "uppercase",
        visibility: "visible",
      },
      paint: secondary,
    },
    {
      id: "label_city",
      type: "symbol",
      source,
      "source-layer": "place",
      minzoom: 3,
      filter: [
        "all",
        ["==", ["get", "class"], "city"],
        ["!=", ["get", "capital"], 2],
      ],
      layout: {
        "text-field": NAME_FIELD_NL,
        "text-font": [...OFM_FONT_REGULAR],
        "text-max-width": 8,
        "text-size": [
          "interpolate",
          ["exponential", 1.2],
          ["zoom"],
          4,
          11,
          7,
          13,
          11,
          18,
        ],
        visibility: "visible",
      },
      paint: major,
    },
    {
      id: "label_city_capital",
      type: "symbol",
      source,
      "source-layer": "place",
      minzoom: 3,
      filter: [
        "all",
        ["==", ["get", "class"], "city"],
        ["==", ["get", "capital"], 2],
      ],
      layout: {
        "text-field": NAME_FIELD_NL,
        "text-font": [...OFM_FONT_BOLD],
        "text-max-width": 8,
        "text-size": [
          "interpolate",
          ["exponential", 1.2],
          ["zoom"],
          4,
          12,
          7,
          14,
          11,
          20,
        ],
        visibility: "visible",
      },
      paint: major,
    },
    {
      id: "label_town",
      type: "symbol",
      source,
      "source-layer": "place",
      minzoom: 6,
      filter: ["==", ["get", "class"], "town"],
      layout: {
        "text-field": NAME_FIELD_NL,
        "text-font": [...OFM_FONT_REGULAR],
        "text-max-width": 8,
        "text-size": [
          "interpolate",
          ["exponential", 1.2],
          ["zoom"],
          7,
          11,
          11,
          16,
        ],
        visibility: "visible",
      },
      paint: secondary,
    },
    {
      id: "label_village",
      type: "symbol",
      source,
      "source-layer": "place",
      minzoom: 9,
      filter: ["==", ["get", "class"], "village"],
      layout: {
        "text-field": NAME_FIELD_NL,
        "text-font": [...OFM_FONT_REGULAR],
        "text-max-width": 8,
        "text-size": ["interpolate", ["linear"], ["zoom"], 8, 9, 12, 10],
        "text-transform": "uppercase",
        visibility: "visible",
      },
      paint: secondary,
    },
    {
      id: "label_other",
      type: "symbol",
      source,
      "source-layer": "place",
      minzoom: 8,
      filter: [
        "match",
        ["get", "class"],
        ["suburb", "quarter", "neighbourhood", "hamlet", "isolated_dwelling"],
        true,
        false,
      ],
      layout: {
        "text-field": NAME_FIELD_NL,
        "text-font": [...OFM_FONT_REGULAR],
        "text-max-width": 8,
        "text-size": ["interpolate", ["linear"], ["zoom"], 8, 9, 12, 10],
        "text-transform": "uppercase",
        visibility: "visible",
      },
      paint: secondary,
    },
  ];
}

function isCanonicalLabelId(id: string): boolean {
  return (SHARED_LABEL_IDS as readonly string[]).includes(id);
}

/**
 * Hide provider-specific road/place/shield labels so every mode shows the same
 * liberty-equivalent set (avoids duplicate / divergent MapTiler labels).
 */
export function suppressForeignLabelLayers(map: SharedLabelsMapLike): string[] {
  const suppressed: string[] = [];
  const layers = map.getStyle()?.layers ?? [];
  const foreignSourceLayer =
    /^(road_label|pathway_label|place_label|town_label|city_label|state_label|country_label|continent_label|transportation_name)$/i;

  for (const layer of layers) {
    if (!layer?.id || layer.type !== "symbol") continue;
    if (isCanonicalLabelId(layer.id)) continue;
    if (layer.id.startsWith("mx-") && !/label|shield|highway-name/i.test(layer.id)) {
      continue;
    }
    // Keep basemap POI symbol layers (poi_*, mx-basemap-poi).
    if (/^poi[_-]/i.test(layer.id) || layer.id === "mx-basemap-poi") continue;
    if (/^airport$/i.test(layer.id)) continue;

    const sl = layer["source-layer"] ?? "";
    const idLooksForeign =
      /road\s*labels?|pathway\s*labels?|place\s*labels?|village\s*labels?|town\s*labels?|city\s*labels?|state\s*labels?|country\s*labels?|continent\s*labels?|capital\s*city|highway\s*shield|airport\s*labels?/i.test(
        layer.id,
      ) ||
      (/label|shield|highway[_-]name|road_name|street.?name/i.test(layer.id) &&
        !isCanonicalLabelId(layer.id));

    if (!idLooksForeign && !foreignSourceLayer.test(sl)) continue;
    // Liberty water / aerodrome labels are outside the shared road set — leave them.
    if (/^water_name|^waterway_line_label|^airport$/i.test(layer.id)) continue;

    if (!map.getLayer(layer.id) || !map.setLayoutProperty) continue;
    try {
      map.setLayoutProperty(layer.id, "visibility", "none");
      suppressed.push(layer.id);
    } catch {
      // ignore
    }
  }
  return suppressed;
}

/** Reveal canonical shared labels if a style hid them (e.g. satellite-v4). */
export function revealSharedLabelLayers(map: SharedLabelsMapLike): string[] {
  const revealed: string[] = [];
  for (const id of SHARED_LABEL_IDS) {
    if (!map.getLayer(id) || !map.setLayoutProperty) continue;
    try {
      map.setLayoutProperty(id, "visibility", "visible");
      revealed.push(id);
    } catch {
      // ignore
    }
  }
  return revealed;
}

export function applySharedLabelContrast(
  map: SharedLabelsMapLike,
  surface: LabelSurface,
  theme: ChromaticTheme = "night",
): string[] {
  const adjusted: string[] = [];
  for (const id of SHARED_ROAD_LABEL_IDS) {
    if (!map.getLayer(id)) continue;
    const paint = labelPaint(surface, theme, id === "highway-name-major");
    for (const [key, value] of Object.entries(paint)) {
      try {
        map.setPaintProperty(id, key, value);
      } catch {
        // ignore
      }
    }
    adjusted.push(id);
  }
  for (const id of SHARED_PLACE_LABEL_IDS) {
    if (!map.getLayer(id)) continue;
    const major = /country|city/i.test(id) && !/town|village|other|state/i.test(id);
    const paint = labelPaint(surface, theme, major);
    for (const [key, value] of Object.entries(paint)) {
      try {
        map.setPaintProperty(id, key, value);
      } catch {
        // ignore
      }
    }
    adjusted.push(id);
  }
  return adjusted;
}

function addLayers(
  map: SharedLabelsMapLike,
  specs: Array<Record<string, unknown>>,
): string[] {
  if (!map.addLayer) return [];
  const added: string[] = [];
  for (const layer of specs) {
    const id = layer.id as string;
    if (map.getLayer(id)) continue;
    try {
      map.addLayer(layer);
      added.push(id);
    } catch {
      // ignore per-layer failures (missing fonts / source-layer)
    }
  }
  return added;
}

/**
 * After style.load on ANY map type: ensure the same road / place label layers
 * exist and are visible, suppress divergent provider labels, apply contrast.
 */
export function ensureSharedMapLabels(
  map: SharedLabelsMapLike,
  options: {
    surface?: LabelSurface;
    theme?: ChromaticTheme;
    /** Replace sprite with OFM liberty (needed for US interstate logos on satellite). */
    ensureSprite?: boolean;
  } = {},
): {
  sourceId: string | null;
  added: string[];
  revealed: string[];
  suppressed: string[];
  painted: string[];
  assets: { glyphs: boolean; sprite: boolean };
} {
  const surface = options.surface ?? "vector";
  const theme = options.theme ?? "night";
  // Imagery modes need OFM glyphs + shield sprites; vector liberty already has them.
  const assets = ensureSharedCartographyAssets(map, {
    sprite: options.ensureSprite ?? surface === "imagery",
  });
  const sourceId = ensureSharedLabelSource(map);
  const added: string[] = [];

  if (sourceId) {
    added.push(
      ...addLayers(map, roadLabelSpecs(sourceId, surface, theme)),
      ...addLayers(map, placeLabelSpecs(sourceId, surface, theme)),
    );
  }

  const revealed = revealSharedLabelLayers(map);
  const suppressed = suppressForeignLabelLayers(map);
  const painted = applySharedLabelContrast(map, surface, theme);

  return { sourceId, added, revealed, suppressed, painted, assets };
}
