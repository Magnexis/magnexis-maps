/** Magnexis Chromatic — Standard (light) cartographic tokens
 *
 * Tuned against Google Maps light basemap: cool off-white land, pale water,
 * mint parks, muted slate highways (not gold), thin grey locals. Active route
 * stays Magnexis blue so navigation never blends into the road hierarchy.
 */
export type ChromaticPalette = {
  background: string;
  interstate: string;
  interstateCasing: string;
  trunk: string;
  primary: string;
  secondary: string;
  tertiary: string;
  residential: string;
  localCasing: string;
  highwayCasing: string;
  park: string;
  forest: string;
  water: string;
  commercial: string;
  building: string;
  buildingOutline: string;
  railway: string;
  path: string;
  labelMajor: string;
  labelSecondary: string;
  labelHalo: string;
  activeRoute: string;
  activeRouteCasing: string;
};

export const CHROMATIC_STANDARD: ChromaticPalette = {
  // Cool light canvas (Google-like), not warm parchment
  background: "#EDEEF0",
  // Muted slate-blue highway fill / casing
  interstate: "#7A8FA8",
  interstateCasing: "#5E738C",
  trunk: "#8FA3B8",
  primary: "#C5CED8",
  secondary: "#D8DEE5",
  tertiary: "#FFFFFF",
  residential: "#FFFFFF",
  localCasing: "#C8CED6",
  highwayCasing: "#5E738C",
  park: "#C5E4C8",
  forest: "#B5D8BA",
  water: "#B8D4EC",
  commercial: "#E8E9EB",
  building: "#D9DBDE",
  buildingOutline: "#C4C7CC",
  railway: "#9AA3AE",
  path: "#E4E6E9",
  labelMajor: "#3C4043",
  labelSecondary: "#5F6368",
  labelHalo: "rgba(237, 238, 240, 0.94)",
  activeRoute: "#1A73E8",
  activeRouteCasing: "#174EA6",
};
