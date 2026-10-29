/**
 * Resolve a real photo for a selected place (no invented placeholders).
 *
 * Priority (when Google is configured, order is configurable via
 * GOOGLE_PLACE_PHOTO_PRIORITY on the API — default `before`):
 * 1. Google Places photo (server proxy; key never in the browser)
 * 2. TomTom POI photo (when TOMTOM_API_KEY is set — Magnexis default path)
 * 3. Mapillary nearby street thumbnail (when NEXT_PUBLIC_MAPILLARY_ACCESS_TOKEN is set)
 * 4. Explicit place.photoUrl / properties image fields from the API
 * 5. Wikipedia/Wikimedia Commons geosearch thumbnail (free, no key)
 * 6. Google Street View Static (map_pin / last resort when Places miss)
 */

import {
  findNearestMapillaryImage,
  mapillaryAccessToken,
  mapillaryConfigured,
} from "@/lib/mapillary";
import {
  fetchGooglePlacePhotoJson,
  fetchGoogleProviderStatus,
  googleStreetViewMeta,
} from "@/lib/google-maps";
import {
  fetchTomTomPlacePhotoJson,
  fetchTomTomProviderStatus,
} from "@/lib/tomtom-client";

export type PlacePhotoSource =
  | "google"
  | "google_street_view"
  | "tomtom"
  | "mapillary"
  | "place"
  | "place_properties"
  | "wikimedia";

/** Successful photo hit — null means no real imagery found. */
export type PlacePhoto = {
  url: string;
  source: PlacePhotoSource;
  attribution: string;
  imageId?: string;
};

const PROPERTY_IMAGE_KEYS = [
  "photoUrl",
  "photo_url",
  "imageUrl",
  "image_url",
  "thumbnail",
  "thumbnailUrl",
  "thumbnail_url",
  "image",
  "photo",
  "picture",
  "coverImage",
  "cover_image",
  "wikimedia",
  "wikipedia",
] as const;

function firstHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

function photoFromProperties(
  properties?: Record<string, unknown> | null,
): string | null {
  if (!properties || typeof properties !== "object") return null;
  for (const key of PROPERTY_IMAGE_KEYS) {
    const hit = firstHttpUrl(properties[key]);
    if (hit) return hit;
  }
  const photos = properties.photos;
  if (Array.isArray(photos)) {
    for (const entry of photos) {
      if (typeof entry === "string") {
        const hit = firstHttpUrl(entry);
        if (hit) return hit;
      } else if (entry && typeof entry === "object") {
        const rec = entry as Record<string, unknown>;
        for (const k of ["url", "src", "href", "thumbnail"]) {
          const hit = firstHttpUrl(rec[k]);
          if (hit) return hit;
        }
      }
    }
  }
  return null;
}

async function fetchGooglePlacesThumb(
  lng: number,
  lat: number,
  name?: string | null,
): Promise<PlacePhoto | null> {
  try {
    const hit = await fetchGooglePlacePhotoJson(lng, lat, name);
    if (!hit?.url) return null;
    return {
      url: hit.url,
      source: "google",
      attribution: hit.attribution || "Google",
      imageId: hit.placeId,
    };
  } catch {
    return null;
  }
}

async function fetchTomTomPlacesThumb(
  lng: number,
  lat: number,
  name?: string | null,
): Promise<PlacePhoto | null> {
  try {
    const status = await fetchTomTomProviderStatus();
    if (!status.configured) return null;
    const hit = await fetchTomTomPlacePhotoJson(lng, lat, name);
    if (!hit?.mediaUrl) return null;
    return {
      url: hit.mediaUrl,
      source: "tomtom",
      attribution: hit.attribution || "TomTom",
      imageId: hit.photoId ?? hit.placeId,
    };
  } catch {
    return null;
  }
}

async function fetchGoogleStreetViewThumb(
  lng: number,
  lat: number,
): Promise<PlacePhoto | null> {
  try {
    const meta = await googleStreetViewMeta(lng, lat);
    if (!meta.available || !meta.imageUrl) return null;
    return {
      url: meta.imageUrl,
      source: "google_street_view",
      attribution: meta.copyright
        ? `Google Street View · ${meta.copyright}`
        : "Google Street View",
    };
  } catch {
    return null;
  }
}

async function fetchMapillaryThumb(
  lng: number,
  lat: number,
): Promise<PlacePhoto | null> {
  if (!mapillaryConfigured()) return null;
  const token = mapillaryAccessToken();

  try {
    const near = await findNearestMapillaryImage(lng, lat, 50);
    if (near?.thumbUrl) {
      return {
        url: near.thumbUrl,
        source: "mapillary",
        attribution: "Mapillary · CC BY-SA",
        imageId: near.id,
      };
    }
    if (near?.id) {
      const detail = await fetch(
        `https://graph.mapillary.com/${encodeURIComponent(near.id)}?access_token=${encodeURIComponent(token)}&fields=id,thumb_256_url,thumb_1024_url`,
      );
      if (detail.ok) {
        const body = (await detail.json()) as {
          thumb_256_url?: string;
          thumb_1024_url?: string;
        };
        const resolved =
          firstHttpUrl(body.thumb_1024_url) ??
          firstHttpUrl(body.thumb_256_url);
        if (resolved) {
          return {
            url: resolved,
            source: "mapillary",
            attribution: "Mapillary · CC BY-SA",
            imageId: near.id,
          };
        }
      }
    }
  } catch {
    // fall through
  }

  // Direct radius search with thumb fields
  try {
    const url = new URL("https://graph.mapillary.com/images");
    url.searchParams.set("access_token", token);
    url.searchParams.set(
      "fields",
      "id,geometry,thumb_256_url,thumb_1024_url",
    );
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lng", String(lng));
    url.searchParams.set("radius", "50");
    url.searchParams.set("limit", "1");
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = (await res.json()) as {
      data?: Array<{
        id: string;
        thumb_256_url?: string;
        thumb_1024_url?: string;
      }>;
    };
    const hit = data.data?.[0];
    if (!hit?.id) return null;
    const thumb =
      firstHttpUrl(hit.thumb_1024_url) ?? firstHttpUrl(hit.thumb_256_url);
    if (!thumb) return null;
    return {
      url: thumb,
      source: "mapillary",
      attribution: "Mapillary · CC BY-SA",
      imageId: hit.id,
    };
  } catch {
    return null;
  }
}

/**
 * Wikipedia/Wikimedia Commons geosearch → page thumbnail.
 * No API key; CORS-friendly with origin=*.
 *
 * Keep the radius tight: a 1 km search made every map drop in downtown
 * share the same landmark article photo ("only one picture").
 */
async function fetchWikimediaThumb(
  lng: number,
  lat: number,
  name?: string | null,
  radiusMeters = 150,
): Promise<PlacePhoto | null> {
  try {
    const geo = new URL("https://en.wikipedia.org/w/api.php");
    geo.searchParams.set("action", "query");
    geo.searchParams.set("list", "geosearch");
    geo.searchParams.set("gscoord", `${lat}|${lng}`);
    geo.searchParams.set(
      "gsradius",
      String(Math.min(10_000, Math.max(10, Math.round(radiusMeters)))),
    );
    geo.searchParams.set("gslimit", "5");
    geo.searchParams.set("format", "json");
    geo.searchParams.set("origin", "*");

    const geoRes = await fetch(geo.toString());
    if (!geoRes.ok) return null;
    const geoJson = (await geoRes.json()) as {
      query?: { geosearch?: Array<{ pageid: number; title: string; dist: number }> };
    };
    let pages = geoJson.query?.geosearch ?? [];
    // Only fuzzy-match short place names — street addresses ("41 Dixwell…")
    // almost never belong on a Wikipedia title and previously forced the
    // wrong landmark photo onto every nearby pin.
    const needle = name?.trim().toLowerCase() ?? "";
    const canMatchName =
      needle.length >= 3 &&
      needle.length <= 48 &&
      !/\d/.test(needle) &&
      !/,/.test(needle);
    if (canMatchName && pages.length > 1) {
      const named = pages.find((p) =>
        p.title.toLowerCase().includes(needle.slice(0, 24)),
      );
      if (named) pages = [named, ...pages.filter((p) => p.pageid !== named.pageid)];
    }
    const pageid = pages[0]?.pageid;
    if (!pageid) return null;

    const thumb = new URL("https://en.wikipedia.org/w/api.php");
    thumb.searchParams.set("action", "query");
    thumb.searchParams.set("pageids", String(pageid));
    thumb.searchParams.set("prop", "pageimages");
    thumb.searchParams.set("pithumbsize", "800");
    thumb.searchParams.set("format", "json");
    thumb.searchParams.set("origin", "*");

    const thumbRes = await fetch(thumb.toString());
    if (!thumbRes.ok) return null;
    const thumbJson = (await thumbRes.json()) as {
      query?: {
        pages?: Record<
          string,
          { title?: string; thumbnail?: { source?: string } }
        >;
      };
    };
    const page = thumbJson.query?.pages?.[String(pageid)];
    const src = firstHttpUrl(page?.thumbnail?.source);
    if (!src) return null;
    return {
      url: src,
      source: "wikimedia",
      attribution: page?.title
        ? `Wikipedia · ${page.title}`
        : "Wikipedia / Wikimedia Commons",
    };
  } catch {
    return null;
  }
}

/**
 * How the photo is being used:
 * - `place` — selected/search place card (Mapillary + listing + nearby Wikimedia)
 * - `map_pin` — dropped pin on an arbitrary map click (street-level only).
 *   Wikimedia landmark articles must not paint every downtown tap as the same
 *   photo; that regressed the earlier "one location everywhere" bug.
 */
export type PlacePhotoIntent = "place" | "map_pin";

/**
 * Gather up to a few real photos from independent sources (Google, Mapillary,
 * listing, Wikimedia). Dedupes by URL. Never invents imagery.
 */
export async function resolvePlacePhotos(options: {
  lng: number;
  lat: number;
  name?: string | null;
  photoUrl?: string | null;
  properties?: Record<string, unknown> | null;
  intent?: PlacePhotoIntent;
}): Promise<PlacePhoto[]> {
  const intent = options.intent ?? "place";
  const wantWikimedia = intent === "place";

  const googleStatus = await fetchGoogleProviderStatus();
  const googleFirst =
    googleStatus.configured && googleStatus.photoPriority === "before";

  const [googlePlaces, tomtomPlaces, mapillary, wikimedia] = await Promise.all([
    googleStatus.configured
      ? fetchGooglePlacesThumb(options.lng, options.lat, options.name)
      : Promise.resolve(null),
    fetchTomTomPlacesThumb(options.lng, options.lat, options.name),
    fetchMapillaryThumb(options.lng, options.lat),
    wantWikimedia
      ? fetchWikimediaThumb(options.lng, options.lat, options.name, 150)
      : Promise.resolve(null),
  ]);

  const collected: PlacePhoto[] = [];
  const seen = new Set<string>();

  const push = (photo: PlacePhoto | null) => {
    if (!photo || seen.has(photo.url)) return;
    seen.add(photo.url);
    collected.push(photo);
  };

  // Configurable Google ↔ Mapillary order; TomTom POI when keyed; listing / props; Wikipedia.
  if (googleFirst) push(googlePlaces);
  push(tomtomPlaces);
  push(mapillary);
  if (!googleFirst) push(googlePlaces);

  const direct = firstHttpUrl(options.photoUrl);
  if (direct) {
    push({
      url: direct,
      source: "place",
      attribution: "Place photo",
    });
  }

  const fromProps = photoFromProperties(options.properties);
  if (fromProps) {
    push({
      url: fromProps,
      source: "place_properties",
      attribution: "Place photo",
    });
  }

  push(wikimedia);

  // Street View Static fills gaps (especially map_pin when Mapillary misses).
  if (collected.length === 0 && googleStatus.configured) {
    push(await fetchGoogleStreetViewThumb(options.lng, options.lat));
  } else if (
    intent === "map_pin" &&
    googleStatus.configured &&
    !collected.some((p) => p.source === "google" || p.source === "google_street_view")
  ) {
    push(await fetchGoogleStreetViewThumb(options.lng, options.lat));
  }

  return collected.slice(0, 4);
}

/**
 * Resolve the best available real photo for a place / map selection.
 * Returns null when nothing real is available (UI should not invent a stand-in).
 */
export async function resolvePlacePhoto(options: {
  lng: number;
  lat: number;
  name?: string | null;
  photoUrl?: string | null;
  properties?: Record<string, unknown> | null;
  intent?: PlacePhotoIntent;
}): Promise<PlacePhoto | null> {
  const photos = await resolvePlacePhotos(options);
  return photos[0] ?? null;
}

/** @deprecated Prefer resolvePlacePhoto; kept for older call sites. */
export type PlacePhotoResult = PlacePhoto | { url: null; source: "none" };
