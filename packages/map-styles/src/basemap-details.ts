/**
 * Restore fine basemap details missing from stripped styles (e.g. OpenFreeMap dark):
 * admin boundaries (states / lower admin incl. reservation-scale) and POI icons.
 */

import type { ChromaticTheme } from "./chromatic.js";
import { OFM_FONT_REGULAR } from "./ofm-fonts.js";
import {
  ensureRouteShieldLayers,
  promoteMapLabelLayers,
  type RouteShieldMapLike,
} from "./route-shield.js";
import {
  ensureSharedLabelSource,
  ensureSharedMapLabels,
  type LabelSurface,
  type SharedLabelsMapLike,
} from "./shared-labels.js";
import { ensureImageryRoadOverlays } from "./imagery-roads.js";

export type BasemapDetailsMapLike = RouteShieldMapLike &
  SharedLabelsMapLike & {
    setLayoutProperty?: (id: string, name: string, value: unknown) => void;
    setLayerZoomRange?: (id: string, minzoom: number, maxzoom: number) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setFilter?: (id: string, filter?: any, options?: any) => any;
  };

function resolveVectorSourceId(map: BasemapDetailsMapLike): string | null {
  // Prefer OFM OpenMapTiles for liberty-compatible source-layers.
  const shared = ensureSharedLabelSource(map);
  if (shared) return shared;

  const style = map.getStyle();
  const layers = style?.layers ?? [];
  for (const layer of layers) {
    if (
      layer.source &&
      (layer.source === "openmaptiles" || layer.source === "mx-openmaptiles") &&
      /boundary|place_|label_|highway|road_|water|landuse|poi/i.test(layer.id)
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

function styleHasPoiSymbols(map: BasemapDetailsMapLike): boolean {
  const layers = map.getStyle()?.layers ?? [];
  return layers.some(
    (l) =>
      l.type === "symbol" &&
      /^poi_|poi-/i.test(l.id) &&
      !l.id.startsWith("mx-"),
  );
}

/**
 * Inject admin boundary lines when the style only has near-invisible country/state
 * strokes (or none). Covers admin_level 2–8 (countries, states, counties, and
 * many reservation / aboriginal admin polygons encoded as boundaries).
 */
export function ensureAdminBoundaryLayers(map: BasemapDetailsMapLike): string[] {
  if (!map.addLayer) return [];
  const source = resolveVectorSourceId(map);
  if (!source || (map.getSource && !map.getSource(source))) return [];

  const added: string[] = [];
  const layers = map.getStyle()?.layers ?? [];
  // Liberty has boundary_3 (admin 3–6). OFM dark only has boundary_state (level 4).
  const hasMidAdminRange = layers.some((l) =>
    /boundary_3|mx-boundary-admin/i.test(l.id),
  );
  const hasCountry = layers.some((l) =>
    /boundary_2|boundary_country|mx-boundary-country/i.test(l.id),
  );

  if (!hasMidAdminRange) {
    const id = "mx-boundary-admin";
    if (!map.getLayer(id)) {
      try {
        map.addLayer({
          id,
          type: "line",
          source,
          "source-layer": "boundary",
          minzoom: 4,
          filter: [
            "all",
            [">=", ["get", "admin_level"], 3],
            ["<=", ["get", "admin_level"], 8],
            ["!=", ["get", "maritime"], 1],
          ],
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#8A93A3",
            "line-dasharray": [2, 2],
            "line-opacity": 0.85,
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              4,
              0.6,
              8,
              1.2,
              12,
              2,
            ],
          },
        });
        added.push(id);
      } catch {
        // ignore
      }
    }
  }

  if (!hasCountry) {
    const id = "mx-boundary-country";
    if (!map.getLayer(id)) {
      try {
        map.addLayer({
          id,
          type: "line",
          source,
          "source-layer": "boundary",
          filter: [
            "all",
            ["==", ["get", "admin_level"], 2],
            ["!=", ["get", "maritime"], 1],
            ["!", ["has", "claimed_by"]],
          ],
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#A8B0BD",
            "line-opacity": 0.9,
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              2,
              0.8,
              6,
              1.4,
              12,
              2.5,
            ],
          },
        });
        added.push(id);
      } catch {
        // ignore
      }
    }
  }

  return added;
}

/** OpenMapTiles / OpenFreeMap poi.class values shown in denser city mode. */
const CITY_POI_CLASSES = [
  "hospital",
  "pharmacy",
  "doctors",
  "dentist",
  "police",
  "fire_station",
  "school",
  "college",
  "university",
  "park",
  "cemetery",
  "stadium",
  "pitch",
  "playground",
  "museum",
  "library",
  "theatre",
  "cinema",
  "place_of_worship",
  "town_hall",
  "townhall",
  "courthouse",
  "embassy",
  "airport",
  "bus",
  "railway",
  "ferry_terminal",
  "fuel",
  "charging_station",
  "parking",
  "lodging",
  "hotel",
  "motel",
  "attraction",
  "grocery",
  "supermarket",
  "shop",
  "clothes",
  "bakery",
  "restaurant",
  "cafe",
  "fast_food",
  "bar",
  "pub",
  "ice_cream",
  "bank",
  "atm",
  "post",
  "laundry",
  "hairdresser",
] as const;

const ESSENTIAL_POI_CLASSES = [
  "hospital",
  "pharmacy",
  "police",
  "fire_station",
  "school",
  "college",
  "university",
  "park",
  "airport",
  "railway",
  "bus",
  "ferry_terminal",
  "fuel",
  "attraction",
  "stadium",
] as const;

function isBasemapPoiLayerId(id: string): boolean {
  if (id.startsWith("mx-poi") || id.startsWith("mx-selection") || id.startsWith("mx-route")) {
    return false;
  }
  return (
    id === "mx-basemap-poi" ||
    /^poi_/i.test(id) ||
    /^poi-/i.test(id) ||
    /(?:^|_)poi(?:_|$|-|label)/i.test(id)
  );
}

/**
 * Inject a compact POI symbol layer when the basemap omits poi_* layers
 * (OpenFreeMap dark). Uses OFM sprite names + real tile class/subclass only.
 */
export function ensurePoiSymbolLayers(map: BasemapDetailsMapLike): string[] {
  if (styleHasPoiSymbols(map)) return [];
  if (!map.addLayer) return [];
  const source = resolveVectorSourceId(map);
  if (!source || (map.getSource && !map.getSource(source))) return [];

  const id = "mx-basemap-poi";
  if (map.getLayer(id)) return [];

  try {
    map.addLayer({
      id,
      type: "symbol",
      source,
      "source-layer": "poi",
      minzoom: 11,
      filter: [
        "all",
        ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false],
        ["match", ["get", "class"], [...CITY_POI_CLASSES], true, false],
      ],
      layout: {
        "icon-image": [
          "coalesce",
          ["image", ["get", "subclass"]],
          ["image", ["get", "class"]],
          ["image", "dot_11"],
        ],
        "icon-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          11,
          0.65,
          14,
          0.85,
          16,
          1,
        ],
        "icon-allow-overlap": false,
        "text-field": [
          "step",
          ["zoom"],
          "",
          14,
          ["coalesce", ["get", "name:en"], ["get", "name"], ""],
        ],
        "text-font": [...OFM_FONT_REGULAR],
        "text-size": 11,
        "text-offset": [0, 1.1],
        "text-anchor": "top",
        "text-optional": true,
      },
      paint: {
        "text-color": "#CAD2DC",
        "text-halo-color": "rgba(16,24,33,0.9)",
        "text-halo-width": 1.25,
      },
    });
    return [id];
  } catch {
    return [];
  }
}

export type BasemapPoiDensityMode = "all" | "essential" | "hidden";

/**
 * Tune basemap POI symbol layers for city-zoom density without inventing places.
 * Native OpenFreeMap / injected mx-basemap-poi layers only.
 */
export function applyBasemapPoiDensity(
  map: BasemapDetailsMapLike,
  mode: BasemapPoiDensityMode,
): string[] {
  const adjusted: string[] = [];
  const layers = map.getStyle()?.layers ?? [];

  for (const layer of layers) {
    if (!layer?.id || layer.type !== "symbol") continue;
    if (!isBasemapPoiLayerId(layer.id)) continue;
    if (!map.getLayer?.(layer.id)) continue;

    try {
      if (mode === "hidden") {
        map.setLayoutProperty?.(layer.id, "visibility", "none");
        adjusted.push(layer.id);
        continue;
      }

      map.setLayoutProperty?.(layer.id, "visibility", "visible");
      // City neighborhood zoom — denser earlier (Google Maps–like).
      map.setLayerZoomRange?.(layer.id, mode === "all" ? 10 : 11, 24);

      if (layer.id === "mx-basemap-poi" && map.setFilter) {
        map.setFilter(layer.id, [
          "all",
          ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false],
          [
            "match",
            ["get", "class"],
            mode === "essential"
              ? [...ESSENTIAL_POI_CLASSES]
              : [...CITY_POI_CLASSES],
            true,
            false,
          ],
        ]);
      }

      adjusted.push(layer.id);
    } catch {
      // ignore per-layer failures
    }
  }

  return adjusted;
}

/** Paint admin boundary strokes so they stay visible on Chromatic night/standard. */
export function applyBoundaryContrast(
  map: BasemapDetailsMapLike,
  theme: ChromaticTheme,
): string[] {
  const night = theme === "night" || theme === "navigation";
  const country = night ? "#C5CDD8" : "#5C6573";
  const admin = night ? "#9AA5B5" : "#8A93A3";
  const adjusted: string[] = [];

  for (const layer of map.getStyle()?.layers ?? []) {
    if (!layer?.id || layer.type !== "line") continue;
    if (!/boundary/i.test(layer.id)) continue;
    if (!map.getLayer(layer.id)) continue;
    const isCountry = /country|boundary_2|mx-boundary-country/i.test(layer.id);
    try {
      map.setPaintProperty(
        layer.id,
        "line-color",
        isCountry ? country : admin,
      );
      map.setPaintProperty(layer.id, "line-opacity", 0.9);
      adjusted.push(layer.id);
    } catch {
      // ignore
    }
  }

  // Dim Natural Earth shaded relief under night Chromatic (liberty includes it)
  for (const layer of map.getStyle()?.layers ?? []) {
    if (layer.type !== "raster") continue;
    if (!/natural_earth|ne2|hillshade/i.test(layer.id)) continue;
    if (!map.getLayer(layer.id)) continue;
    try {
      if (night) {
        map.setPaintProperty(layer.id, "raster-opacity", 0.12);
        map.setLayoutProperty?.(layer.id, "visibility", "visible");
      } else {
        map.setPaintProperty(layer.id, "raster-opacity", 0.45);
      }
      adjusted.push(layer.id);
    } catch {
      // ignore
    }
  }

  return adjusted;
}

/**
 * After style.load: shared road/place labels on every basemap, then shields /
 * admin boundaries / POI icons when omitted, then boundary contrast.
 *
 * For imagery surfaces (satellite / terrain hybrid): inject OFM transportation
 * road lines under labels so highways are visible on raster basemaps.
 */
export function ensureBasemapDetails(
  map: BasemapDetailsMapLike,
  theme: ChromaticTheme = "night",
  poiDensity: BasemapPoiDensityMode = "all",
  labelSurface: LabelSurface = "vector",
  options: {
    /** Replace style sprite with OFM liberty (satellite-only — keeps terrain outdoor icons). */
    ensureSprite?: boolean;
  } = {},
): {
  shields: string[];
  boundaries: string[];
  pois: string[];
  roads: string[];
  labels: ReturnType<typeof ensureSharedMapLabels>;
} {
  // Shared label pipeline first so shields resolve the OFM vector source.
  // Imagery modes swap glyphs to OFM; satellite also takes liberty sprites for US shields.
  const labels = ensureSharedMapLabels(map, {
    surface: labelSurface,
    theme,
    ensureSprite: options.ensureSprite ?? false,
  });
  // Hybrid roads under labels (satellite has none; terrain may lack OMT lines).
  const roads =
    labelSurface === "imagery"
      ? ensureImageryRoadOverlays(map, theme, true)
      : [];
  const shields = ensureRouteShieldLayers(map);
  const boundaries = ensureAdminBoundaryLayers(map);
  const pois = ensurePoiSymbolLayers(map);
  applyBasemapPoiDensity(map, poiDensity);
  applyBoundaryContrast(map, theme);
  // Place labels above roads; mx-* overlays re-ordered again after readdOverlayLayers.
  promoteMapLabelLayers(map);
  return { shields, boundaries, pois, roads, labels };
}
