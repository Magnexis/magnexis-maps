import type { SearchResult } from "@magnexis/shared";

const FAVORITES_KEY = "magnexis_favorite_places";

export type FavoritePlace = {
  id: string;
  label: string;
  coordinates: { lng: number; lat: number };
  address?: string;
  category?: string;
  savedAt: string;
};

export function loadFavorites(): FavoritePlace[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is FavoritePlace =>
          Boolean(x) &&
          typeof x === "object" &&
          typeof (x as FavoritePlace).id === "string" &&
          typeof (x as FavoritePlace).label === "string" &&
          typeof (x as FavoritePlace).coordinates?.lng === "number" &&
          typeof (x as FavoritePlace).coordinates?.lat === "number",
      )
      .slice(0, 40);
  } catch {
    return [];
  }
}

export function persistFavorites(items: FavoritePlace[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(items.slice(0, 40)));
  } catch {
    // quota / private mode
  }
}

export function favoriteFromSearch(result: SearchResult): FavoritePlace | null {
  if (!result.coordinates) return null;
  return {
    id: result.id,
    label: result.label,
    coordinates: result.coordinates,
    address: result.address,
    category: result.category,
    savedAt: new Date().toISOString(),
  };
}

export function searchFromFavorite(fav: FavoritePlace): SearchResult {
  return {
    id: fav.id,
    label: fav.label,
    kind: "place",
    category: fav.category as SearchResult["category"],
    coordinates: fav.coordinates,
    address: fav.address,
    source: "internal",
    verified: false,
  };
}
