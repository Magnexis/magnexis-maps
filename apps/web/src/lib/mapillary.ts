/**
 * Mapillary street-level imagery (https://www.mapillary.com/developer).
 * Requires a client access token from https://www.mapillary.com/dashboard/developers
 * — never invents coverage or photos when unconfigured.
 */

export const MAPILLARY_SOURCE_ID = "mx-mapillary";
export const MAPILLARY_LAYER_SEQUENCES = "mx-mapillary-sequences";
export const MAPILLARY_LAYER_IMAGES = "mx-mapillary-images";

export function mapillaryAccessToken(): string {
  return (
    process.env.NEXT_PUBLIC_MAPILLARY_ACCESS_TOKEN ??
    process.env.MAPILLARY_ACCESS_TOKEN ??
    ""
  ).trim();
}

export function mapillaryConfigured(): boolean {
  return mapillaryAccessToken().length > 0;
}

/** Vector tile URL template for public coverage (sequences + images). */
export function mapillaryCoverageTilesUrl(token = mapillaryAccessToken()): string {
  return `https://tiles.mapillary.com/maps/vtp/mly1_public/2/{z}/{x}/{y}?access_token=${encodeURIComponent(token)}`;
}

export type MapillaryNearbyImage = {
  id: string;
  lng: number;
  lat: number;
  capturedAt?: number;
  compassAngle?: number;
  /** Present when the Graph API returns thumb fields. */
  thumbUrl?: string;
};

type MapillaryImageResponse = {
  data?: Array<{
    id: string;
    geometry?: { type: string; coordinates: [number, number] };
    captured_at?: number;
    compass_angle?: number;
    thumb_1024_url?: string;
    thumb_2048_url?: string;
  }>;
};

function mapillaryImageFrom(
  image: NonNullable<MapillaryImageResponse["data"]>[number],
  fallbackLng: number,
  fallbackLat: number,
): MapillaryNearbyImage {
  const coords = image.geometry?.coordinates;
  return {
    id: image.id,
    lng: coords?.[0] ?? fallbackLng,
    lat: coords?.[1] ?? fallbackLat,
    capturedAt: image.captured_at,
    compassAngle: image.compass_angle,
    thumbUrl: image.thumb_2048_url ?? image.thumb_1024_url,
  };
}

function distanceMeters(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earth = 6_371_008.8;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(dLng / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function requestMapillaryImages(url: URL): Promise<MapillaryImageResponse> {
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Mapillary search failed (${res.status})`);
  }
  return (await res.json()) as MapillaryImageResponse;
}

/**
 * Find the best street image near a point (Mapillary Image Radius Search).
 * Radius max is 50 m per API.
 */
export async function findNearestMapillaryImage(
  lng: number,
  lat: number,
  radiusMeters = 50,
): Promise<MapillaryNearbyImage | null> {
  const token = mapillaryAccessToken();
  if (!token) return null;

  const url = new URL("https://graph.mapillary.com/images");
  url.searchParams.set("access_token", token);
  url.searchParams.set(
    "fields",
    "id,geometry,captured_at,compass_angle,is_pano,thumb_1024_url,thumb_2048_url",
  );
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lng", String(lng));
  url.searchParams.set("radius", String(Math.min(50, Math.max(1, radiusMeters))));
  url.searchParams.set("limit", "1");

  const data = await requestMapillaryImages(url);
  const hit = data.data?.[0];
  if (hit?.id) return mapillaryImageFrom(hit, lng, lat);

  // A pin can be on a rural address rather than directly on a captured road.
  // Keep the primary 50 m radius honest, then ask Mapillary for a small local
  // bounding box and pick the closest real image (never fabricate a photo).
  const searchRadiusMeters = 550;
  const latDelta = searchRadiusMeters / 111_320;
  const lngDelta =
    searchRadiusMeters /
    Math.max(1, 111_320 * Math.cos((lat * Math.PI) / 180));
  const fallback = new URL("https://graph.mapillary.com/images");
  fallback.searchParams.set("access_token", token);
  fallback.searchParams.set(
    "fields",
    "id,geometry,captured_at,compass_angle,is_pano,thumb_1024_url,thumb_2048_url",
  );
  fallback.searchParams.set(
    "bbox",
    `${lng - lngDelta},${lat - latDelta},${lng + lngDelta},${lat + latDelta}`,
  );
  fallback.searchParams.set("limit", "24");
  const nearby = (await requestMapillaryImages(fallback)).data ?? [];
  if (!nearby.length) return null;
  return nearby
    .map((image) => mapillaryImageFrom(image, lng, lat))
    .sort(
      (a, b) =>
        distanceMeters(lng, lat, a.lng, a.lat) -
        distanceMeters(lng, lat, b.lng, b.lat),
    )[0] ?? null;
}
