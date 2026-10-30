import { CoordinatesSchema, type Coordinates } from "@magnexis/shared";

export const MAX_ROUTE_STOPS = 3;
export type SharedStop = { label: string; coordinates: Coordinates };

/** Null means invalid input; missing stops remain compatible with older links. */
export function parseSharedStops(raw: string | null): SharedStop[] | null {
  if (raw === null) return [];
  if (raw.length > 6000) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || value.length > MAX_ROUTE_STOPS) return null;
    const stops: SharedStop[] = [];
    for (const stop of value) {
      if (
        !stop ||
        typeof stop !== "object" ||
        typeof stop.label !== "string" ||
        !stop.label.trim() ||
        stop.label.length > 200
      )
        return null;
      const coordinates = CoordinatesSchema.safeParse(stop.coordinates);
      if (!coordinates.success) return null;
      stops.push({ label: stop.label.trim(), coordinates: coordinates.data });
    }
    return stops;
  } catch {
    return null;
  }
}

export function parseCoordinates(
  lng: string | null,
  lat: string | null,
): Coordinates | null {
  if (!lng?.trim() || !lat?.trim()) return null;
  const point = { lng: Number(lng), lat: Number(lat) };
  return Number.isFinite(point.lng) &&
    Number.isFinite(point.lat) &&
    Math.abs(point.lng) <= 180 &&
    Math.abs(point.lat) <= 90
    ? point
    : null;
}

/** Native local origins are never useful to a recipient. Share the public web root. */
export function publicShareBase(origin?: string): string {
  const configured = process.env.NEXT_PUBLIC_SHARE_URL?.trim();
  const base = configured || origin;
  if (!base) return "";
  const url = new URL(base);
  if (url.protocol !== "https:" && url.protocol !== "http:") return "";
  return url.origin;
}

export function incomingAppLink(raw: string): string | null {
  if (raw.length > 8192) return null;
  try {
    const url = new URL(raw);
    if (
      url.protocol !== "magnexis-maps:" ||
      !["place", "route", "auth"].includes(url.hostname)
    )
      return null;
    const params = url.searchParams;
    if (url.hostname === "auth") {
      if (
        !["/github/callback", "/gitlab/callback"].includes(url.pathname) ||
        !params.get("state") ||
        (!params.get("code") && !params.get("error"))
      )
        return null;
      return `/auth${url.pathname}?${params.toString()}`;
    }
    if (url.hostname === "place") {
      if (
        !params.get("q")?.trim() ||
        !parseCoordinates(params.get("lng"), params.get("lat"))
      )
        return null;
    } else {
      if (
        !parseCoordinates(params.get("olng"), params.get("olat")) ||
        !parseCoordinates(params.get("dlng"), params.get("dlat"))
      )
        return null;
      if (parseSharedStops(params.get("stops")) === null) return null;
      params.set("dir", "1");
    }
    return `/?${params.toString()}`;
  } catch {
    return null;
  }
}
