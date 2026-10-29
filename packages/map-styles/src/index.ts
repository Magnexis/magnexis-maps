export const HORIZON_THEME = {
  dark: {
    background: "#07111F",
    surface: "#101D2D",
    surfaceSecondary: "#172638",
    primary: "#3188FF",
    secondary: "#46D8FF",
    text: "#F7FAFF",
    textMuted: "#9EACC0",
  },
  light: {
    background: "#EEF2F7",
    surface: "#FFFFFF",
    surfaceSecondary: "#F4F7FB",
    primary: "#3188FF",
    secondary: "#46D8FF",
    text: "#0B1524",
    textMuted: "#5B6B82",
  },
} as const;

/** @deprecated Use HORIZON_THEME */
export const MAGNEXIS_THEME = {
  light: HORIZON_THEME.light,
  dark: HORIZON_THEME.dark,
} as const;

export const MAP_CONTROL_STYLES = {
  borderRadius: "14px",
  shadow: "0 8px 32px rgba(7, 17, 31, 0.35)",
} as const;

/**
 * Free OSM vector styles (OpenFreeMap / OpenMapTiles) — roads, labels, no API key.
 * Prefer these over MapLibre demotiles for local/dev basemaps.
 *
 * Magnexis Night uses **liberty** (not OFM `dark`): the dark style omits highway
 * shields, POI icons, and mid-admin boundaries. Chromatic night paints restyle liberty.
 */
export const OPENFREEMAP_STYLES = {
  liberty: "https://tiles.openfreemap.org/styles/liberty",
  /** @deprecated Minimal OFM dark — missing shields/POIs; kept for diagnostics */
  darkMinimal: "https://tiles.openfreemap.org/styles/dark",
  /** Magnexis Night / dark theme basemap (detailed liberty + Chromatic paints) */
  dark: "https://tiles.openfreemap.org/styles/liberty",
} as const;

/** Low-detail MapLibre demo (landcover blobs only) — never use as default. */
export const MAPLIBRE_DEMO_STYLE =
  "https://demotiles.maplibre.org/style.json";

export function isLowDetailDemoStyle(url: string | undefined | null): boolean {
  if (!url) return true;
  return /demotiles\.maplibre\.org/i.test(url);
}

/** Resolve a client basemap URL, rejecting demotiles. */
export function resolveClientBasemapUrl(
  preferred: string | undefined | null,
  theme: "dark" | "standard" = "dark",
): string {
  if (preferred && !isLowDetailDemoStyle(preferred)) return preferred;
  return theme === "standard"
    ? OPENFREEMAP_STYLES.liberty
    : OPENFREEMAP_STYLES.dark;
}

export const PRODUCT_VERSION = "1.4.0";
export const CHROMATIC_CODENAME = "Chromatic";

export {
  applyChromaticPaints,
  applyRoadAtlasPaints,
  paletteFor,
  ROAD_ATLAS_SOURCE_LAYERS,
  CHROMATIC_STANDARD,
  CHROMATIC_NIGHT,
  CHROMATIC_NAVIGATION,
  CHROMATIC_HIGH_CONTRAST,
  type RoadAtlasTheme,
  type ChromaticTheme,
} from "./chromatic.js";

export type { ChromaticPalette } from "./tokens/standard.js";
export { CHROMATIC_STANDARD as chromaticStandardTokens } from "./tokens/standard.js";
export { CHROMATIC_NIGHT as chromaticNightTokens } from "./tokens/night.js";
export { CHROMATIC_NAVIGATION as chromaticNavigationTokens } from "./tokens/navigation.js";
export { CHROMATIC_HIGH_CONTRAST as chromaticHighContrastTokens } from "./tokens/high-contrast.js";

export {
  parseRouteRef,
  classifyNetwork,
  shieldFromFeatureProps,
  applyRouteShieldLabelContrast,
  ensureRouteShieldLayers,
  promoteRouteShieldLayers,
  promoteMapLabelLayers,
  collectRouteShieldLayerIds,
  styleHasHighwayShields,
  ROUTE_SHIELD_LAYER_HINTS,
  type RouteNetworkKind,
  type RouteShieldSpec,
} from "./route-shield.js";

export {
  ensureBasemapDetails,
  ensureAdminBoundaryLayers,
  ensurePoiSymbolLayers,
  applyBasemapPoiDensity,
  applyBoundaryContrast,
  type BasemapPoiDensityMode,
} from "./basemap-details.js";

export {
  ensureSharedMapLabels,
  ensureSharedLabelSource,
  ensureSharedCartographyAssets,
  applySharedLabelContrast,
  suppressForeignLabelLayers,
  revealSharedLabelLayers,
  styleHasSharedRoadLabels,
  SHARED_ROAD_LABEL_IDS,
  SHARED_PLACE_LABEL_IDS,
  SHARED_SHIELD_LABEL_IDS,
  SHARED_LABEL_IDS,
  OFM_GLYPHS_URL,
  OFM_SPRITE_URL,
  type LabelSurface,
} from "./shared-labels.js";

export {
  ensureImageryRoadOverlays,
  styleHasMajorRoadLines,
  IMAGERY_HYBRID_ROAD_IDS,
} from "./imagery-roads.js";

export {
  GEO_SYMBOLS,
  ESSENTIAL_GEO_CATEGORIES,
  resolveGeoSymbol,
  poiCircleColorExpression,
  poiLabelColorExpression,
  geoSymbolSvgDataUrl,
  shouldShowGeoSymbol,
  type GeoSymbolCategory,
  type GeoSymbolDef,
  type PoiDensityMode,
} from "./geo-symbols.js";

export {
  OFM_FONT_REGULAR,
  OFM_FONT_BOLD,
  OFM_FONT_ITALIC,
} from "./ofm-fonts.js";

export {
  BUILDING_3D_LAYER_ID,
  ensureBuildingExtrusionLayer,
  applyBuildings3d,
} from "./buildings-3d.js";
