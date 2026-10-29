import type { ChromaticPalette } from "./standard.js";
import { CHROMATIC_NIGHT } from "./night.js";

/**
 * Magnexis Chromatic — Navigation mode.
 * Same readable gold road hierarchy as Night; brighter active-route blue.
 */
export const CHROMATIC_NAVIGATION: ChromaticPalette = {
  ...CHROMATIC_NIGHT,
  labelMajor: "#FFFFFF",
  activeRoute: "#3B82F6",
  activeRouteCasing: "#0A1628",
};
