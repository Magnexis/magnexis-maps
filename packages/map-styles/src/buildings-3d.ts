/**
 * Apple Maps–style 3D building extrusions from OpenMapTiles `building` polygons.
 *
 * OpenFreeMap liberty already ships a native `building-3d` fill-extrusion layer.
 * Prefer driving that layer; only inject `mx-building-3d` when the style has no
 * building extrusion (e.g. satellite / terrain overlays on OFM planet tiles).
 */

import { ensureSharedLabelSource } from "./shared-labels.js";
import { paletteFor, type ChromaticTheme } from "./chromatic.js";

export const BUILDING_3D_LAYER_ID = "mx-building-3d";

export type Buildings3dMapLike = {
  getStyle: () => {
    layers?: Array<{
      id: string;
      type: string;
      source?: string;
      "source-layer"?: string;
    }>;
    sources?: Record<string, unknown>;
  };
  getLayer: (id: string) => unknown;
  getSource?: (id: string) => unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addLayer?: (layer: any, beforeId?: string) => unknown;
  setLayoutProperty?: (id: string, name: string, value: unknown) => void;
  setPaintProperty?: (id: string, name: string, value: unknown) => void;
};

/**
 * Height in meters. Prefer `has` over `to-number`+`coalesce` — MapLibre's
 * `to-number` of a missing property is `0`, which coalesce would wrongly keep.
 */
const BUILDING_HEIGHT: unknown[] = [
  "case",
  ["has", "render_height"],
  ["to-number", ["get", "render_height"]],
  ["has", "height"],
  ["to-number", ["get", "height"]],
  ["has", "levels"],
  ["*", ["to-number", ["get", "levels"]], 3],
  ["has", "building:levels"],
  ["*", ["to-number", ["get", "building:levels"]], 3],
  12,
];

const BUILDING_BASE: unknown[] = [
  "case",
  ["has", "render_min_height"],
  ["to-number", ["get", "render_min_height"]],
  ["has", "min_height"],
  ["to-number", ["get", "min_height"]],
  0,
];

/** Extrusion walls need contrast on night land (`building` flat token is too dark). */
function extrusionColor(theme: ChromaticTheme): string {
  if (theme === "night" || theme === "navigation") return "#5B6F86";
  if (theme === "high-contrast") return "#D4D0C8";
  return paletteFor(theme).building;
}

function resolveBuildingSourceId(map: Buildings3dMapLike): string | null {
  const shared = ensureSharedLabelSource(map as never);
  if (shared) return shared;
  if (map.getSource?.("openmaptiles")) return "openmaptiles";
  return null;
}

/** Native OFM / any fill-extrusion on the `building` source-layer. */
export function listBuildingExtrusionLayerIds(
  map: Buildings3dMapLike,
): string[] {
  const layers = map.getStyle()?.layers ?? [];
  const ids: string[] = [];
  for (const layer of layers) {
    if (!layer?.id || layer.type !== "fill-extrusion") continue;
    if (layer.id === BUILDING_3D_LAYER_ID) {
      ids.push(layer.id);
      continue;
    }
    if (
      layer["source-layer"] === "building" ||
      /building/i.test(layer.id)
    ) {
      ids.push(layer.id);
    }
  }
  return ids;
}

function paintExtrusionLayer(
  map: Buildings3dMapLike,
  layerId: string,
  theme: ChromaticTheme,
): void {
  const color = extrusionColor(theme);
  try {
    map.setPaintProperty?.(layerId, "fill-extrusion-color", color);
    map.setPaintProperty?.(layerId, "fill-extrusion-opacity", 0.92);
    map.setPaintProperty?.(
      layerId,
      "fill-extrusion-vertical-gradient",
      true,
    );
    // Robust height: native OFM uses bare `get` which is null without attrs.
    map.setPaintProperty?.(layerId, "fill-extrusion-height", BUILDING_HEIGHT);
    map.setPaintProperty?.(layerId, "fill-extrusion-base", BUILDING_BASE);
  } catch {
    // ignore unsupported paint keys
  }
}

/**
 * Ensure at least one fill-extrusion building layer exists.
 * Visibility is controlled by `applyBuildings3d`.
 */
export function ensureBuildingExtrusionLayer(
  map: Buildings3dMapLike,
  theme: ChromaticTheme = "night",
): boolean {
  const existing = listBuildingExtrusionLayerIds(map).filter(
    (id) => id !== BUILDING_3D_LAYER_ID,
  );

  // Prefer native OFM `building-3d` — do not stack a duplicate on top of it.
  if (existing.length > 0) {
    for (const id of existing) {
      paintExtrusionLayer(map, id, theme);
    }
    // Hide any leftover Magnexis duplicate from earlier sessions / hot reloads.
    if (map.getLayer(BUILDING_3D_LAYER_ID)) {
      try {
        map.setLayoutProperty?.(BUILDING_3D_LAYER_ID, "visibility", "none");
      } catch {
        // ignore
      }
    }
    return true;
  }

  if (map.getLayer(BUILDING_3D_LAYER_ID)) {
    paintExtrusionLayer(map, BUILDING_3D_LAYER_ID, theme);
    return true;
  }

  if (!map.addLayer) return false;
  const source = resolveBuildingSourceId(map);
  if (!source || (map.getSource && !map.getSource(source))) return false;

  const beforeCandidates = [
    "highway-name-major",
    "label_city",
    "mx-poi-circle",
    "mx-route-line",
  ];
  const beforeId = beforeCandidates.find((id) => map.getLayer(id));

  try {
    map.addLayer(
      {
        id: BUILDING_3D_LAYER_ID,
        type: "fill-extrusion",
        source,
        "source-layer": "building",
        minzoom: 14,
        layout: {
          visibility: "none",
        },
        paint: {
          "fill-extrusion-color": extrusionColor(theme),
          "fill-extrusion-height": BUILDING_HEIGHT,
          "fill-extrusion-base": BUILDING_BASE,
          "fill-extrusion-opacity": 0.92,
          "fill-extrusion-vertical-gradient": true,
        },
      },
      beforeId,
    );
    return true;
  } catch {
    return false;
  }
}

/** Toggle extrusion + hide/show flat building fills underneath. */
export function applyBuildings3d(
  map: Buildings3dMapLike,
  enabled: boolean,
  theme: ChromaticTheme = "night",
  showFootprintsWhenFlat = true,
): void {
  ensureBuildingExtrusionLayer(map, theme);

  const extrusionIds = listBuildingExtrusionLayerIds(map);
  const hasNative = extrusionIds.some((id) => id !== BUILDING_3D_LAYER_ID);

  for (const id of extrusionIds) {
    try {
      if (id === BUILDING_3D_LAYER_ID) {
        // Injected layer only when the style has no native building extrusion
        // (satellite/terrain). Never stack it over OFM `building-3d`.
        map.setLayoutProperty?.(
          id,
          "visibility",
          enabled && !hasNative ? "visible" : "none",
        );
      } else {
        // Native OFM extrusion stays on: at pitch 0 it reads as footprints
        // (flat `building` maxzoom is 14). Pitch makes walls protrude.
        map.setLayoutProperty?.(id, "visibility", "visible");
      }
      paintExtrusionLayer(map, id, theme);
    } catch {
      // ignore
    }
  }

  const layers = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    if (!layer?.id || layer.id === BUILDING_3D_LAYER_ID) continue;
    if (layer.id.startsWith("mx-") && layer.id !== BUILDING_3D_LAYER_ID) continue;
    if (layer.type !== "fill") continue;
    if (!/building/i.test(layer.id)) continue;
    try {
      map.setLayoutProperty?.(
        layer.id,
        "visibility",
        enabled ? "none" : showFootprintsWhenFlat ? "visible" : "none",
      );
    } catch {
      // ignore
    }
  }
}
