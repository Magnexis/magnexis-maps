import type { SearchResult } from "@magnexis/shared";

const RECENT_PLACES_KEY = "magnexis_recent_places";

/** Device-local recent places (coords) — Google Maps–style home recents. */
export type RecentPlace = {
  id: string;
  label: string;
  coordinates: { lng: number; lat: number };
  address?: string;
  category?: string;
  visitedAt: string;
};

export function loadRecentPlaces(): RecentPlace[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_PLACES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is RecentPlace =>
          Boolean(x) &&
          typeof x === "object" &&
          typeof (x as RecentPlace).id === "string" &&
          typeof (x as RecentPlace).label === "string" &&
          typeof (x as RecentPlace).coordinates?.lng === "number" &&
          typeof (x as RecentPlace).coordinates?.lat === "number",
      )
      .slice(0, 12);
  } catch {
    return [];
  }
}

export function persistRecentPlaces(items: RecentPlace[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      RECENT_PLACES_KEY,
      JSON.stringify(items.slice(0, 12)),
    );
  } catch {
    // quota / private mode
  }
}

export function recentFromSearch(result: SearchResult): RecentPlace | null {
  if (!result.coordinates) return null;
  return {
    id: result.id,
    label: result.label,
    coordinates: result.coordinates,
    address: result.address,
    category: result.category,
    visitedAt: new Date().toISOString(),
  };
}

export function searchFromRecent(recent: RecentPlace): SearchResult {
  return {
    id: recent.id,
    label: recent.label,
    kind: "place",
    category: recent.category as SearchResult["category"],
    coordinates: recent.coordinates,
    address: recent.address,
    source: "internal",
    verified: false,
  };
}
