/**
 * Magnexis GeoSymbols — POI category → color / icon / zoom priority.
 * Icons are original SVG templates (not proprietary map assets).
 */

export type GeoSymbolCategory =
  | "restaurant"
  | "coffee"
  | "grocery"
  | "shopping"
  | "hospital"
  | "pharmacy"
  | "police"
  | "fire"
  | "school"
  | "university"
  | "park"
  | "playground"
  | "airport"
  | "rail"
  | "bus"
  | "parking"
  | "gas"
  | "ev"
  | "hotel"
  | "museum"
  | "library"
  | "government"
  | "attraction"
  | "business"
  | "generic";

export type GeoSymbolDef = {
  category: GeoSymbolCategory;
  color: string;
  iconId: string;
  /** Minimum zoom before symbol may appear */
  minZoom: number;
  /** Sort priority (lower = more important / shown first) */
  priority: number;
};

/**
 * Google Maps–like category discs: saturated fills on a pastel basemap so
 * restaurants / parks / culture / health read at a glance.
 */
export const GEO_SYMBOLS: Record<GeoSymbolCategory, GeoSymbolDef> = {
  airport: {
    category: "airport",
    color: "#1A73E8",
    iconId: "mx-poi-airport",
    minZoom: 6,
    priority: 10,
  },
  rail: {
    category: "rail",
    color: "#1A73E8",
    iconId: "mx-poi-rail",
    minZoom: 10,
    priority: 20,
  },
  hospital: {
    category: "hospital",
    color: "#D93025",
    iconId: "mx-poi-hospital",
    minZoom: 11,
    priority: 15,
  },
  university: {
    category: "university",
    color: "#1A73E8",
    iconId: "mx-poi-university",
    minZoom: 11,
    priority: 25,
  },
  park: {
    category: "park",
    color: "#188038",
    iconId: "mx-poi-park",
    minZoom: 11,
    priority: 30,
  },
  attraction: {
    category: "attraction",
    color: "#A142F4",
    iconId: "mx-poi-attraction",
    minZoom: 11,
    priority: 35,
  },
  government: {
    category: "government",
    color: "#5F6368",
    iconId: "mx-poi-government",
    minZoom: 11,
    priority: 40,
  },
  police: {
    category: "police",
    color: "#1A73E8",
    iconId: "mx-poi-police",
    minZoom: 12,
    priority: 22,
  },
  fire: {
    category: "fire",
    color: "#E37400",
    iconId: "mx-poi-fire",
    minZoom: 12,
    priority: 23,
  },
  shopping: {
    category: "shopping",
    color: "#1A73E8",
    iconId: "mx-poi-shopping",
    minZoom: 12,
    priority: 45,
  },
  grocery: {
    category: "grocery",
    color: "#1A73E8",
    iconId: "mx-poi-grocery",
    minZoom: 11,
    priority: 50,
  },
  restaurant: {
    category: "restaurant",
    color: "#FA7B17",
    iconId: "mx-poi-restaurant",
    minZoom: 11,
    priority: 55,
  },
  coffee: {
    category: "coffee",
    color: "#FA7B17",
    iconId: "mx-poi-coffee",
    minZoom: 11,
    priority: 56,
  },
  hotel: {
    category: "hotel",
    color: "#A142F4",
    iconId: "mx-poi-hotel",
    minZoom: 11,
    priority: 48,
  },
  gas: {
    category: "gas",
    color: "#5F6368",
    iconId: "mx-poi-gas",
    minZoom: 11,
    priority: 52,
  },
  ev: {
    category: "ev",
    color: "#137333",
    iconId: "mx-poi-ev",
    minZoom: 12,
    priority: 53,
  },
  parking: {
    category: "parking",
    color: "#1A73E8",
    iconId: "mx-poi-parking",
    minZoom: 12,
    priority: 60,
  },
  bus: {
    category: "bus",
    color: "#1A73E8",
    iconId: "mx-poi-bus",
    minZoom: 12,
    priority: 42,
  },
  school: {
    category: "school",
    color: "#1A73E8",
    iconId: "mx-poi-school",
    minZoom: 11,
    priority: 38,
  },
  pharmacy: {
    category: "pharmacy",
    color: "#D93025",
    iconId: "mx-poi-pharmacy",
    minZoom: 11,
    priority: 44,
  },
  museum: {
    category: "museum",
    color: "#A142F4",
    iconId: "mx-poi-museum",
    minZoom: 11,
    priority: 36,
  },
  library: {
    category: "library",
    color: "#A142F4",
    iconId: "mx-poi-library",
    minZoom: 12,
    priority: 46,
  },
  playground: {
    category: "playground",
    color: "#188038",
    iconId: "mx-poi-playground",
    minZoom: 13,
    priority: 58,
  },
  business: {
    category: "business",
    color: "#1A73E8",
    iconId: "mx-poi-business",
    minZoom: 13,
    priority: 70,
  },
  generic: {
    category: "generic",
    color: "#1A73E8",
    iconId: "mx-poi-generic",
    minZoom: 13,
    priority: 80,
  },
};

/** Magnexis place category / free-text → GeoSymbol */
export function resolveGeoSymbol(
  category: string | null | undefined,
  name?: string | null,
): GeoSymbolDef {
  const c = (category ?? "").toLowerCase().trim();
  const n = (name ?? "").toLowerCase();

  if (
    c.includes("airport") ||
    n.includes("airport") ||
    c === "aerodrome"
  ) {
    return GEO_SYMBOLS.airport;
  }
  if (c.includes("hospital") || c === "clinic" || n.includes("hospital")) {
    return GEO_SYMBOLS.hospital;
  }
  if (c.includes("pharmacy") || c === "chemist") return GEO_SYMBOLS.pharmacy;
  if (c.includes("police")) return GEO_SYMBOLS.police;
  if (c.includes("fire")) return GEO_SYMBOLS.fire;
  if (c.includes("university") || c.includes("college")) {
    return GEO_SYMBOLS.university;
  }
  if (c.includes("school")) return GEO_SYMBOLS.school;
  if (c === "parking" || c.includes("parking")) return GEO_SYMBOLS.parking;
  if (c.includes("playground")) return GEO_SYMBOLS.playground;
  if (c === "park" || c.includes("park") || c === "garden") {
    return GEO_SYMBOLS.park;
  }
  if (
    c.includes("rail") ||
    c.includes("train") ||
    c.includes("station") ||
    c === "transit"
  ) {
    return GEO_SYMBOLS.rail;
  }
  if (c.includes("bus")) return GEO_SYMBOLS.bus;
  if (
    c === "fuel" ||
    c.includes("fuel") ||
    c.includes("gas") ||
    c.includes("petrol")
  ) {
    return GEO_SYMBOLS.gas;
  }
  if (
    c === "ev_charging" ||
    c.includes("charging") ||
    c === "ev" ||
    n.includes("charging")
  ) {
    return GEO_SYMBOLS.ev;
  }
  if (
    c === "hotel" ||
    c.includes("hotel") ||
    c.includes("lodging") ||
    c.includes("motel")
  ) {
    return GEO_SYMBOLS.hotel;
  }
  if (c === "museum" || c.includes("museum")) return GEO_SYMBOLS.museum;
  if (c === "library" || c.includes("library")) return GEO_SYMBOLS.library;
  if (c.includes("government") || c === "public_facility" || c === "townhall") {
    return GEO_SYMBOLS.government;
  }
  if (
    c === "cafe" ||
    c.includes("cafe") ||
    c.includes("coffee") ||
    n.includes("coffee")
  ) {
    return GEO_SYMBOLS.coffee;
  }
  if (
    c === "restaurant" ||
    c.includes("restaurant") ||
    c.includes("fast_food") ||
    (c.includes("food") && !c.includes("pet"))
  ) {
    return GEO_SYMBOLS.restaurant;
  }
  if (c === "grocery" || c.includes("supermarket") || c.includes("grocery")) {
    return GEO_SYMBOLS.grocery;
  }
  if (c === "shopping" || c.includes("shop") || c.includes("mall")) {
    return GEO_SYMBOLS.shopping;
  }
  if (
    c === "attraction" ||
    c === "landmark" ||
    c.includes("attraction") ||
    c.includes("tourism")
  ) {
    return GEO_SYMBOLS.attraction;
  }
  if (c === "sports" || c.includes("stadium") || c.includes("recreation")) {
    return GEO_SYMBOLS.attraction;
  }
  if (
    c === "entertainment" ||
    c.includes("cinema") ||
    c.includes("theater") ||
    c.includes("theatre")
  ) {
    return GEO_SYMBOLS.attraction;
  }
  if (c === "business" || c === "poi" || c === "building") {
    return GEO_SYMBOLS.business;
  }
  return GEO_SYMBOLS.generic;
}

/** MapLibre match expression for circle-color from GeoJSON `symbolCategory` */
export function poiCircleColorExpression(): unknown[] {
  const entries: unknown[] = ["match", ["get", "symbolCategory"]];
  for (const def of Object.values(GEO_SYMBOLS)) {
    entries.push(def.category, def.color);
  }
  entries.push(GEO_SYMBOLS.generic.color);
  return entries;
}

/** Same category palette for POI name labels (Google: tinted text under the disc). */
export function poiLabelColorExpression(): unknown[] {
  return poiCircleColorExpression();
}

/** Simple monochrome SVG disc+glyph for MapLibre addImage (24×24) */
export function geoSymbolSvgDataUrl(
  category: GeoSymbolCategory,
  night = false,
): string {
  const def = GEO_SYMBOLS[category];
  const fill = def.color;
  const stroke = night ? "#0B1219" : "#FFFFFF";
  // Minimal abstract glyph — recognizable at map scale
  const glyph = glyphPath(category);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <circle cx="24" cy="24" r="20" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
  <g fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function glyphPath(category: GeoSymbolCategory): string {
  switch (category) {
    case "hospital":
    case "pharmacy":
      return `<path d="M24 14v20M14 24h20"/>`;
    case "airport":
      return `<path d="M24 12l4 14h8l-6 4 2 8-8-5-8 5 2-8-6-4h8z"/>`;
    case "parking":
      return `<path d="M18 14h8a6 6 0 010 12h-8V14zM18 26v8"/>`;
    case "gas":
      return `<rect x="16" y="14" width="10" height="20" rx="1"/><path d="M26 18h4v12"/>`;
    case "park":
    case "playground":
      return `<path d="M24 34V22M18 28c0-6 12-6 12 0"/><circle cx="24" cy="16" r="3"/>`;
    case "restaurant":
      return `<path d="M18 14v20M18 14c2 4 2 8 0 10M22 14v20M28 14v8a4 4 0 01-4 4"/>`;
    case "coffee":
      return `<path d="M16 18h14v10a6 6 0 01-6 6h-2a6 6 0 01-6-6V18zM30 20h3a3 3 0 010 6h-3"/>`;
    case "rail":
      return `<rect x="14" y="16" width="20" height="14" rx="2"/><path d="M18 30v4M30 30v4M14 22h20"/>`;
    case "hotel":
      return `<path d="M12 34V20h24v14M12 24h24"/><circle cx="18" cy="28" r="2"/>`;
    default:
      return `<circle cx="24" cy="24" r="5"/>`;
  }
}

export type PoiDensityMode = "all" | "essential" | "hidden";

/** Essential categories for low-clutter mode */
export const ESSENTIAL_GEO_CATEGORIES: GeoSymbolCategory[] = [
  "airport",
  "hospital",
  "rail",
  "university",
  "park",
  "attraction",
  "police",
  "fire",
  "gas",
];

export function shouldShowGeoSymbol(
  def: GeoSymbolDef,
  zoom: number,
  mode: PoiDensityMode,
  enabledCategories?: Set<GeoSymbolCategory> | null,
): boolean {
  if (mode === "hidden") return false;
  if (zoom < def.minZoom) return false;
  if (mode === "essential" && !ESSENTIAL_GEO_CATEGORIES.includes(def.category)) {
    return false;
  }
  if (enabledCategories && !enabledCategories.has(def.category)) return false;
  return true;
}
