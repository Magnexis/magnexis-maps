import { getApiClient } from "@/lib/api";
import type { PlaceCategory, SearchResult } from "@magnexis/shared";
import { useAppStore } from "@/lib/store";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import {
  publicShareBase,
  parseSharedStops,
  type SharedStop,
} from "./share-links";

/**
 * Google Maps–style: set destination (and GPS origin when available), open
 * Directions, and let the panel auto-call TomTom via POST /api/v1/routes.
 */
export function startDirectionsTo(destination: SearchResult): void {
  const { userLocation, setDirections, setSelectedSearch, openPanel } =
    useAppStore.getState();

  setSelectedSearch(destination);
  setDirections({
    destination,
    origin: userLocation
      ? {
          id: "gps",
          label: "Your location",
          kind: "geocode",
          coordinates: userLocation,
          source: "internal",
          verified: false,
        }
      : null,
    waypoints: [],
    routes: [],
    selectedRouteIndex: 0,
    error: null,
  });
  openPanel("directions");
}

export function placeShareUrl(result: {
  label: string;
  coordinates: { lng: number; lat: number };
}): string {
  const { lng, lat } = result.coordinates;
  const q = encodeURIComponent(result.label);
  if (typeof window !== "undefined") {
    return `${publicShareBase(window.location.origin)}/?q=${q}&lng=${lng}&lat=${lat}`;
  }
  return `?q=${q}&lng=${lng}&lat=${lat}`;
}

export type ShareOutcome = "shared" | "copied" | "cancelled";

async function shareUrl(
  title: string,
  text: string,
  url: string,
): Promise<ShareOutcome> {
  if (Capacitor.isNativePlatform()) {
    const result = await Share.share({
      title,
      text,
      url,
      dialogTitle: "Share with",
    });
    return result.activityType ? "shared" : "cancelled";
  }
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return "cancelled";
      }
      // Native sharing can be unavailable despite exposing the API.
    }
  }
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return "copied";
  }
  throw new Error(
    "Sharing is unavailable and clipboard access is not supported.",
  );
}

export async function sharePlace(result: {
  label: string;
  coordinates: { lng: number; lat: number };
}): Promise<ShareOutcome> {
  const url = placeShareUrl(result);
  return shareUrl(result.label, `${result.label} — Magnexis Maps`, url);
}

/** Deep-linkable route URL (?dir=1&olng=&olat=&dlng=&dlat=&oq=&dq=&mode=). */
export function routeShareUrl(opts: {
  origin: { label: string; coordinates: { lng: number; lat: number } };
  destination: { label: string; coordinates: { lng: number; lat: number } };
  mode?: string;
  waypoints?: SharedStop[];
}): string {
  const { origin: o, destination: d, mode = "driving" } = opts;
  const params = new URLSearchParams({
    dir: "1",
    oq: o.label,
    olng: String(o.coordinates.lng),
    olat: String(o.coordinates.lat),
    dq: d.label,
    dlng: String(d.coordinates.lng),
    dlat: String(d.coordinates.lat),
    mode,
  });
  if (opts.waypoints?.length) {
    const stops = parseSharedStops(JSON.stringify(opts.waypoints));
    if (!stops)
      throw new Error("The route contains invalid stops and cannot be shared.");
    params.set("stops", JSON.stringify(stops));
  }
  if (typeof window !== "undefined") {
    return `${publicShareBase(window.location.origin)}/?${params}`;
  }
  return `?${params}`;
}

export async function shareRoute(opts: {
  origin: { label: string; coordinates: { lng: number; lat: number } };
  destination: { label: string; coordinates: { lng: number; lat: number } };
  mode?: string;
  waypoints?: SharedStop[];
}): Promise<ShareOutcome> {
  const url = routeShareUrl(opts);
  const title = `${opts.origin.label} → ${opts.destination.label}`;
  return shareUrl(title, `${title} — Magnexis Maps`, url);
}

export async function savePlaceToAccount(
  label: string,
  coordinates: { lng: number; lat: number },
  placeId?: string,
): Promise<void> {
  await getApiClient().createSavedPlace({
    label,
    lng: coordinates.lng,
    lat: coordinates.lat,
    placeId,
  });
}

export function searchResultFromPlace(place: {
  id: string;
  name: string;
  coordinates: { lng: number; lat: number };
  address?: string | null;
  category?: PlaceCategory | string | null;
  lastVerifiedAt?: string | null;
}): SearchResult {
  return {
    id: place.id,
    label: place.name,
    kind: "place",
    category: (place.category as PlaceCategory | undefined) ?? undefined,
    coordinates: place.coordinates,
    address: place.address ?? undefined,
    source: "internal",
    verified: Boolean(place.lastVerifiedAt),
  };
}
