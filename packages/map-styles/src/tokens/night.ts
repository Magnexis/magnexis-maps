import type { ChromaticPalette } from "./standard.js";

/**
 * Magnexis Chromatic — Night cartographic tokens.
 *
 * OpenFreeMap `dark` paints motorways `#000` and locals `#181818` by default —
 * nearly invisible on a dark basemap. These tokens must stay high-luminance
 * yellows/neutrals so Chromatic overrides remain readable.
 */
export const CHROMATIC_NIGHT: ChromaticPalette = {
  // October night: charcoal-plum ground with restrained ember wayfinding.
  background: "#14111A",
  // Bright gold hierarchy (must punch through OFM dark's black roads)
  interstate: "#F4B95D",
  interstateCasing: "#8B5427",
  trunk: "#E9AA4C",
  primary: "#CE9650",
  secondary: "#C8B895",
  tertiary: "#AEB7C5",
  residential: "#909CAC",
  localCasing: "#463D4D",
  highwayCasing: "#8B5427",
  // Quiet flat greens — never bright enough to read as POI/landmark highlights
  park: "#202A27",
  forest: "#19231F",
  water: "#193A56",
  commercial: "#1C1822",
  building: "#332C3C",
  buildingOutline: "#241F2B",
  railway: "#A5A8B2",
  path: "#8F98A5",
  labelMajor: "#FBF8F4",
  labelSecondary: "#D5CDD6",
  labelHalo: "rgba(20, 17, 26, 0.94)",
  activeRoute: "#65A6FF",
  activeRouteCasing: "#172B52",
};
