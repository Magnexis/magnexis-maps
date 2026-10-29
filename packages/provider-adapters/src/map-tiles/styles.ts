import type { MapStyleConfig } from "./types.js";

/** Free detailed OSM basemap (OpenFreeMap / OpenMapTiles) — no API key. */
export const OPENFREEMAP_LIBERTY =
  "https://tiles.openfreemap.org/styles/liberty";
/**
 * Magnexis Night basemap. Uses liberty (not OFM `dark`) so highway shields,
 * POI icons, and admin boundaries remain available; Chromatic restyles paints.
 */
export const OPENFREEMAP_DARK = OPENFREEMAP_LIBERTY;
/** Upstream minimal dark style — omits shields/POIs; avoid for product night mode. */
export const OPENFREEMAP_DARK_MINIMAL =
  "https://tiles.openfreemap.org/styles/dark";

/** Low-detail landcover-only demo — never use as a production/default basemap. */
export const MAPLIBRE_DEMO_STYLE =
  "https://demotiles.maplibre.org/style.json";

export function isLowDetailDemoStyle(url: string | undefined | null): boolean {
  if (!url) return true;
  return /demotiles\.maplibre\.org/i.test(url);
}

function resolveBasemapUrl(
  candidate: string | undefined,
  fallback: string,
): string {
  if (!candidate || isLowDetailDemoStyle(candidate)) return fallback;
  return candidate;
}

/**
 * Build MapTiler style URLs when a key is present.
 * MapTiler requires an account + key; free tiers are licensed for development.
 * @see https://docs.maptiler.com/cloud/api/maps/
 */
export function maptilerStyleUrl(
  styleId: string,
  key: string,
): string {
  return `https://api.maptiler.com/maps/${styleId}/style.json?key=${encodeURIComponent(key)}`;
}

function readMaptilerKey(env: NodeJS.ProcessEnv): string {
  return (
    env.MAPTILER_KEY ||
    env.NEXT_PUBLIC_MAPTILER_KEY ||
    env.MAP_TILE_API_KEY ||
    ""
  ).trim();
}

/**
 * Resolve Magnexis map styles from environment.
 * Defaults to OpenFreeMap (roads + labels). Never falls back to demotiles.
 *
 * Terrain / satellite:
 * - Prefer explicit `MAP_STYLE_TERRAIN` / `MAP_STYLE_SATELLITE` style JSON URLs
 * - Or set `MAPTILER_KEY` / `NEXT_PUBLIC_MAPTILER_KEY` to enable MapTiler
 *   outdoor (terrain) + satellite styles automatically
 */
export function resolveMapStyles(
  env: NodeJS.ProcessEnv = process.env,
): MapStyleConfig[] {
  const standard = resolveBasemapUrl(
    env.MAP_STYLE_STANDARD,
    OPENFREEMAP_LIBERTY,
  );
  const dark = resolveBasemapUrl(env.MAP_STYLE_DARK, OPENFREEMAP_DARK);
  const maptilerKey = readMaptilerKey(env);

  let terrain = (env.MAP_STYLE_TERRAIN || "").trim();
  let satellite = (env.MAP_STYLE_SATELLITE || "").trim();

  if (!terrain && maptilerKey) {
    // Outdoor v4 = current MapTiler topographic / terrain style
    terrain = maptilerStyleUrl("outdoor-v4", maptilerKey);
  }
  if (!satellite && maptilerKey) {
    // Satellite v4 = imagery (+ label layers often visibility:none).
    // App injects shared OpenFreeMap liberty labels on every basemap after load.
    satellite = maptilerStyleUrl("satellite-v4", maptilerKey);
  }

  const terrainOk = Boolean(terrain) && !isLowDetailDemoStyle(terrain);
  const satelliteOk =
    Boolean(satellite) && !isLowDetailDemoStyle(satellite);

  return [
    {
      id: "standard",
      label: "Magnexis Standard",
      styleUrl: standard,
      available: true,
    },
    {
      id: "dark",
      label: "Magnexis Night",
      styleUrl: dark,
      available: true,
    },
    {
      id: "terrain",
      label: "Magnexis Terrain",
      styleUrl: terrainOk ? terrain : standard,
      available: terrainOk,
      reasonUnavailable: terrain
        ? isLowDetailDemoStyle(terrain)
          ? "MAP_STYLE_TERRAIN cannot be MapLibre demotiles."
          : undefined
        : "Set MAP_STYLE_TERRAIN to a style URL, or MAPTILER_KEY for MapTiler outdoor.",
    },
    {
      id: "satellite",
      label: "Satellite",
      styleUrl: satelliteOk ? satellite : "",
      available: satelliteOk,
      reasonUnavailable: satellite
        ? isLowDetailDemoStyle(satellite)
          ? "MAP_STYLE_SATELLITE cannot be MapLibre demotiles."
          : undefined
        : "Set MAP_STYLE_SATELLITE to a licensed imagery style URL, or MAPTILER_KEY for MapTiler satellite.",
    },
  ];
}
