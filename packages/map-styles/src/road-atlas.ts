/**
 * @deprecated Prefer Magnexis Chromatic (`chromatic.ts`, v1.4.0).
 * Re-exports kept so existing imports keep working.
 *
 * Interstates are gold/yellow — never blue. Active navigation routes
 * remain blue via the separate `mx-route-*` overlay layers.
 */
export {
  applyRoadAtlasPaints,
  applyChromaticPaints,
  ROAD_ATLAS_SOURCE_LAYERS,
  CHROMATIC_STANDARD,
  CHROMATIC_NIGHT,
  type RoadAtlasTheme,
  type ChromaticTheme,
} from "./chromatic.js";
