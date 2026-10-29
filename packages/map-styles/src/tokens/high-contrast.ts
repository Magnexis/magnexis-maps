import type { ChromaticPalette } from "./standard.js";
import { CHROMATIC_STANDARD } from "./standard.js";

/** Magnexis Chromatic — High Contrast (accessibility-oriented basemap) */
export const CHROMATIC_HIGH_CONTRAST: ChromaticPalette = {
  ...CHROMATIC_STANDARD,
  background: "#FFFFFF",
  interstate: "#E8A010",
  interstateCasing: "#5C3D00",
  trunk: "#D4A017",
  primary: "#C9A227",
  secondary: "#E8E4D8",
  tertiary: "#FFFFFF",
  residential: "#FFFFFF",
  localCasing: "#4A5568",
  highwayCasing: "#5C3D00",
  park: "#8FBF7A",
  forest: "#6FA05C",
  water: "#6BA8D4",
  commercial: "#E8E4DC",
  building: "#C4C0B8",
  buildingOutline: "#6B7280",
  railway: "#4B5563",
  labelMajor: "#000000",
  labelSecondary: "#1A1A1A",
  labelHalo: "rgba(255,255,255,0.98)",
  activeRoute: "#0033CC",
  activeRouteCasing: "#001A66",
};
