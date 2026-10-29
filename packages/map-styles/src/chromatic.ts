/**
 * Magnexis Chromatic — cartographic paint engine (v1.4.0).
 *
 * Standard (light): Google-like muted slate highways on a cool pastel canvas.
 * Night / navigation: gold interstate hierarchy for dark-map readability.
 * Active navigation route overlays stay bright Magnexis blue (mx-route-*).
 */

import { CHROMATIC_STANDARD, type ChromaticPalette } from "./tokens/standard.js";
import { CHROMATIC_NIGHT } from "./tokens/night.js";
import { CHROMATIC_NAVIGATION } from "./tokens/navigation.js";
import { CHROMATIC_HIGH_CONTRAST } from "./tokens/high-contrast.js";

export type ChromaticTheme = "standard" | "night" | "navigation" | "high-contrast";

export type MapLike = {
  getStyle: () => { layers?: Array<{ id: string; type: string }> };
  getLayer: (id: string) => unknown;
  setPaintProperty: (id: string, name: string, value: unknown) => void;
  setLayoutProperty?: (id: string, name: string, value: unknown) => void;
};

export function paletteFor(theme: ChromaticTheme): ChromaticPalette {
  switch (theme) {
    case "standard":
      return CHROMATIC_STANDARD;
    case "navigation":
      return CHROMATIC_NAVIGATION;
    case "high-contrast":
      return CHROMATIC_HIGH_CONTRAST;
    case "night":
    default:
      return CHROMATIC_NIGHT;
  }
}

type PaintFn = (c: ChromaticPalette) => Record<string, unknown>;

const ROAD_RULES: Array<{ match: RegExp; paint: PaintFn }> = [
  {
    match: /motorway.*casing|highway_motorway_casing|road_motorway_casing/i,
    paint: (c) => ({
      "line-color": c.interstateCasing,
      "line-opacity": 1,
    }),
  },
  {
    match:
      /motorway(?!.*casing)|highway_motorway_inner|highway_motorway_subtle|road_motorway(?!_)/i,
    paint: (c) => ({
      "line-color": c.interstate,
      "line-opacity": 1,
    }),
  },
  {
    match: /trunk.*casing|road_trunk.*casing|highway_major_casing/i,
    paint: (c) => ({
      "line-color": c.highwayCasing,
      "line-opacity": 0.95,
    }),
  },
  {
    match: /primary.*casing|secondary.*casing|tertiary.*casing|road_minor_casing|road_link_casing/i,
    paint: (c) => ({
      "line-color": c.localCasing,
      "line-opacity": 0.9,
    }),
  },
  {
    match: /trunk|highway_major|road_trunk(?!_)/i,
    paint: (c) => ({
      "line-color": [
        "match",
        ["get", "class"],
        "motorway",
        c.interstate,
        "trunk",
        c.trunk,
        "primary",
        c.primary,
        "secondary",
        c.secondary,
        "tertiary",
        c.tertiary,
        c.trunk,
      ],
      "line-opacity": 1,
    }),
  },
  {
    match: /road_primary|primary(?!.*casing)|highway_major_inner|highway_major_subtle/i,
    paint: (c) => ({
      "line-color": [
        "match",
        ["get", "class"],
        "trunk",
        c.trunk,
        "primary",
        c.primary,
        "secondary",
        c.secondary,
        "tertiary",
        c.tertiary,
        c.primary,
      ],
      "line-opacity": 1,
    }),
  },
  {
    match: /secondary|tertiary|road_secondary/i,
    paint: (c) => ({
      "line-color": [
        "match",
        ["get", "class"],
        "secondary",
        c.secondary,
        "tertiary",
        c.tertiary,
        c.secondary,
      ],
      "line-opacity": 1,
    }),
  },
  {
    match:
      /minor|service|track|street|residential|highway_path|road_path|road_service|road_link(?!_casing)|road_area/i,
    paint: (c) => ({
      "line-color": c.residential,
      "line-opacity": 0.98,
    }),
  },
  {
    match: /railway|rail/i,
    paint: (c) => ({ "line-color": c.railway, "line-opacity": 0.85 }),
  },
  {
    match:
      /highway[_-]name|road_name|transportation_name|bridge_name|highway-name/i,
    paint: (c) => ({
      "text-color": c.labelMajor,
      "text-halo-color": c.labelHalo,
      "text-halo-width": 1.6,
    }),
  },
  {
    match: /place_|water_name|poi_label|poi_r|label_|airport$/i,
    paint: (c) => ({
      "text-color": c.labelSecondary,
      "text-halo-color": c.labelHalo,
      "text-halo-width": 1.25,
    }),
  },
];

/** True for dark cartography themes where day vegetation outlines look "selected". */
function isDarkVegetationTheme(theme: ChromaticTheme): boolean {
  return theme === "night" || theme === "navigation";
}

type ThemePaintFn = (
  c: ChromaticPalette,
  theme: ChromaticTheme,
) => Record<string, unknown>;

/**
 * Vegetation fills. OpenFreeMap liberty paints parks with a neon
 * `fill-outline-color` (rgba(95,208,100)) that survives color overrides and
 * reads as clickable landmarks in night mode — neutralize that outline only
 * on dark themes so standard/day keeps liberty's soft park edges.
 */
const FILL_RULES: Array<{ match: RegExp; paint: ThemePaintFn }> = [
  {
    match: /^water$|waterway|water_/,
    paint: (c) => ({ "fill-color": c.water, "fill-opacity": 1 }),
  },
  {
    // Exact park / landuse_park only — do not match parking or park_outline
    match: /^park$|landuse_park|(?:^|_)park(?:_fill)?$/i,
    paint: (c, theme) => {
      const dark = isDarkVegetationTheme(theme);
      if (dark) {
        return {
          "fill-color": c.park,
          "fill-opacity": 0.45,
          // Kill liberty neon outline; match fill so edges stay quiet
          "fill-outline-color": c.park,
        };
      }
      return { "fill-color": c.park, "fill-opacity": 0.7 };
    },
  },
  {
    match: /landcover_wood|landcover_forest|(?:^|_)(?:wood|forest)(?:_|$)/i,
    paint: (c, theme) => {
      const dark = isDarkVegetationTheme(theme);
      if (dark) {
        return {
          "fill-color": c.forest,
          "fill-opacity": 0.4,
          "fill-outline-color": c.forest,
        };
      }
      return { "fill-color": c.forest, "fill-opacity": 0.45 };
    },
  },
  {
    match: /landcover_grass|landuse_grass|(?:^|_)grass(?:_|$)/i,
    paint: (c, theme) => {
      const dark = isDarkVegetationTheme(theme);
      if (dark) {
        return {
          "fill-color": c.park,
          "fill-opacity": 0.25,
          "fill-outline-color": c.park,
        };
      }
      return { "fill-color": c.park, "fill-opacity": 0.3 };
    },
  },
  {
    match: /landuse_residential|residential/,
    paint: (c) => ({ "fill-color": c.commercial, "fill-opacity": 0.35 }),
  },
  {
    match: /^building$|building-/,
    paint: (c) => ({
      "fill-color": c.building,
      "fill-outline-color": c.buildingOutline,
      "fill-opacity": 0.9,
    }),
  },
];

/** Park perimeter strokes from liberty — mute only in dark themes. */
const VEGETATION_LINE_RULES: Array<{ match: RegExp; paint: ThemePaintFn }> = [
  {
    match: /^park_outline$|park-outline|landuse_park_outline/i,
    paint: (c, theme) => {
      if (!isDarkVegetationTheme(theme)) return {};
      return {
        "line-color": c.park,
        "line-opacity": 0.15,
      };
    },
  },
];

/**
 * OpenFreeMap `dark` layer IDs — painted black/near-black by upstream.
 * Explicit overrides beat regex matching so gold roads always win at zoom ≥ 6.
 */
const OFM_DARK_ROAD_COLORS: Record<
  string,
  (c: ChromaticPalette) => Record<string, unknown>
> = {
  highway_motorway_inner: (c) => ({
    "line-color": c.interstate,
    "line-opacity": 1,
  }),
  highway_motorway_casing: (c) => ({
    "line-color": c.interstateCasing,
    "line-opacity": 1,
  }),
  highway_motorway_subtle: (c) => ({
    "line-color": c.interstate,
    "line-opacity": 1,
  }),
  highway_major_inner: (c) => ({
    "line-color": [
      "match",
      ["get", "class"],
      "trunk",
      c.trunk,
      "primary",
      c.primary,
      "secondary",
      c.secondary,
      "tertiary",
      c.tertiary,
      c.trunk,
    ],
    "line-opacity": 1,
  }),
  highway_major_casing: (c) => ({
    "line-color": c.highwayCasing,
    "line-opacity": 1,
  }),
  highway_major_subtle: (c) => ({
    "line-color": [
      "match",
      ["get", "class"],
      "trunk",
      c.trunk,
      "primary",
      c.primary,
      "secondary",
      c.secondary,
      c.primary,
    ],
    "line-opacity": 1,
  }),
  highway_minor: (c) => ({
    "line-color": c.residential,
    "line-opacity": 1,
  }),
  highway_path: (c) => ({
    "line-color": c.path,
    "line-opacity": 0.9,
  }),
  road_pier: (c) => ({
    "line-color": c.residential,
    "line-opacity": 1,
  }),
};

function safePaint(
  map: MapLike,
  layerId: string,
  props: Record<string, unknown>,
): void {
  for (const [key, value] of Object.entries(props)) {
    try {
      map.setPaintProperty(layerId, key, value);
    } catch {
      // ignore unsupported paint keys on a given layer type
    }
  }
}

/**
 * Apply Magnexis Chromatic paints after style.load.
 * Skips mx-* overlay layers (active navigation route stays blue).
 *
 * Night/navigation must override OpenFreeMap dark’s intentional black roads
 * (`highway_motorway_inner` → `#000` at zoom ≥ 6).
 */
export function applyChromaticPaints(
  map: MapLike,
  theme: ChromaticTheme = "night",
): { adjusted: string[]; palette: ChromaticPalette } {
  const colors = paletteFor(theme);
  const adjusted: string[] = [];

  const layers = map.getStyle()?.layers ?? [];

  for (const layer of layers) {
    if (!layer?.id || layer.id.startsWith("mx-")) continue;
    if (!map.getLayer(layer.id)) continue;

    if (layer.type === "background") {
      safePaint(map, layer.id, { "background-color": colors.background });
      adjusted.push(layer.id);
      continue;
    }

    // Exact OpenFreeMap dark road IDs first (highest priority)
    const ofm = OFM_DARK_ROAD_COLORS[layer.id];
    if (ofm && layer.type === "line") {
      safePaint(map, layer.id, ofm(colors));
      adjusted.push(layer.id);
      continue;
    }

    if (layer.type === "fill") {
      const rule = FILL_RULES.find((r) => r.match.test(layer.id));
      if (!rule) continue;
      safePaint(map, layer.id, rule.paint(colors, theme));
      adjusted.push(layer.id);
      continue;
    }

    if (layer.type === "line" || layer.type === "symbol") {
      if (/^waterway$|waterway-/.test(layer.id) && layer.type === "line") {
        safePaint(map, layer.id, { "line-color": colors.water });
        adjusted.push(layer.id);
        continue;
      }

      if (layer.type === "line") {
        const vegLine = VEGETATION_LINE_RULES.find((r) =>
          r.match.test(layer.id),
        );
        if (vegLine) {
          const props = vegLine.paint(colors, theme);
          if (Object.keys(props).length > 0) {
            safePaint(map, layer.id, props);
            adjusted.push(layer.id);
          }
          continue;
        }
      }

      const rule = ROAD_RULES.find((r) => r.match.test(layer.id));
      if (!rule) continue;
      safePaint(map, layer.id, rule.paint(colors));
      adjusted.push(layer.id);
    }
  }

  return { adjusted, palette: colors };
}

/** @deprecated Use applyChromaticPaints — kept for call-site compatibility */
export function applyRoadAtlasPaints(
  map: MapLike,
  theme: "night" | "standard" = "night",
) {
  return applyChromaticPaints(map, theme);
}

export type RoadAtlasTheme = "night" | "standard";

export const ROAD_ATLAS_SOURCE_LAYERS = [
  "transportation",
  "transportation_name",
] as const;

export {
  CHROMATIC_STANDARD,
  CHROMATIC_NIGHT,
  CHROMATIC_NAVIGATION,
  CHROMATIC_HIGH_CONTRAST,
};
