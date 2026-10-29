/**
 * Resolve the server-only Google Maps Platform API key.
 * Prefer GOOGLE_MAPS_API_KEY; never put production keys in NEXT_PUBLIC_*.
 */
export function readGoogleMapsApiKey(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (
    env.GOOGLE_MAPS_API_KEY ||
    env.GOOGLE_PLACES_API_KEY ||
    // Last resort for local demos that only set a browser key — prefer server proxy.
    env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    ""
  ).trim();
}

export function googleMapsKeyConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return readGoogleMapsApiKey(env).length > 0;
}

/** Place-photo resolve order when Google is configured. Default: before Mapillary. */
export function googlePlacePhotoPriority(
  env: NodeJS.ProcessEnv = process.env,
): "before" | "after" {
  const raw = (env.GOOGLE_PLACE_PHOTO_PRIORITY ?? "before")
    .toLowerCase()
    .trim();
  return raw === "after" || raw === "after_mapillary" ? "after" : "before";
}
