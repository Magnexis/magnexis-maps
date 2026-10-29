import type { ChromaticPalette } from "./standard.js";

/**
 * Magnexis Chromatic — Night cartographic tokens.
 *
 * OpenFreeMap `dark` paints motorways `#000` and locals `#181818` by default —
 * nearly invisible on a dark basemap. These tokens must stay high-luminance
 * yellows/neutrals so Chromatic overrides remain readable.
 */
export const CHROMATIC_NIGHT: ChromaticPalette = {
  background: "#101821",
  // Bright gold hierarchy (must punch through OFM dark's black roads)
  interstate: "#F6C45A",
  interstateCasing: "#A67C2A",
  trunk: "#E8B84A",
  primary: "#D4A84A",
  secondary: "#C4B896",
  tertiary: "#A8B4C4",
  residential: "#8B9AAB",
  localCasing: "#3D4F5F",
  highwayCasing: "#A67C2A",
  // Quiet flat greens — never bright enough to read as POI/landmark highlights
  park: "#1A2E26",
  forest: "#15241E",
  water: "#153D5C",
  commercial: "#151E28",
  building: "#263341",
  buildingOutline: "#1A2633",
  railway: "#9AA6B4",
  path: "#7A8A9A",
  labelMajor: "#F4F6FA",
  labelSecondary: "#CAD2DC",
  labelHalo: "rgba(16, 24, 33, 0.92)",
  activeRoute: "#4D91FF",
  activeRouteCasing: "#0B1F3F",
};
