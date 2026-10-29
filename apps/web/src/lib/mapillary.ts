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

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Mapillary search failed (${res.status})`);
  }
  const data = (await res.json()) as {
    data?: Array<{
      id: string;
      geometry?: { type: string; coordinates: [number, number] };
      captured_at?: number;
      compass_angle?: number;
      thumb_1024_url?: string;
      thumb_2048_url?: string;
    }>;
  };
  const hit = data.data?.[0];
  if (!hit?.id) return null;
  const coords = hit.geometry?.coordinates;
  return {
    id: hit.id,
    lng: coords?.[0] ?? lng,
    lat: coords?.[1] ?? lat,
    capturedAt: hit.captured_at,
    compassAngle: hit.compass_angle,
    thumbUrl: hit.thumb_2048_url ?? hit.thumb_1024_url,
  };
}
