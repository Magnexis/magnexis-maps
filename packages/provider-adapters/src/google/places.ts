/**
 * Google Places API (New) + Street View Static helpers (server-side only).
 * @see https://developers.google.com/maps/documentation/places/web-service/op-overview
 * @see https://developers.google.com/maps/documentation/streetview/overview
 */

export type GooglePlacePhotoHit = {
  photoName: string;
  placeId: string;
  placeName?: string;
  attribution: string;
};

type PlacesNearbyResponse = {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    photos?: Array<{
      name?: string;
      authorAttributions?: Array<{ displayName?: string }>;
    }>;
  }>;
};

type PlacesTextResponse = PlacesNearbyResponse;

type StreetViewMeta = {
  status?: string;
  copyright?: string;
};

function attributionFromPhoto(
  authors?: Array<{ displayName?: string }>,
): string {
  const names = (authors ?? [])
    .map((a) => a.displayName?.trim())
    .filter(Boolean);
  if (names.length) return `Google · ${names.slice(0, 2).join(", ")}`;
  return "Google";
}

/**
 * Find a nearby place with a photo via Places API (New) searchNearby.
 */
export async function findNearbyGooglePlacePhoto(
  apiKey: string,
  lng: number,
  lat: number,
  options?: { radiusMeters?: number; name?: string | null },
): Promise<GooglePlacePhotoHit | null> {
  const radius = Math.min(
    500,
    Math.max(15, options?.radiusMeters ?? 80),
  );
  const needle = options?.name?.trim();

  // Prefer text search when we have a place name (better POI match).
  if (needle && needle.length >= 2 && needle.length <= 80) {
    const textHit = await searchTextPhoto(apiKey, needle, lng, lat, radius);
    if (textHit) return textHit;
  }

  return searchNearbyPhoto(apiKey, lng, lat, radius);
}

async function searchNearbyPhoto(
  apiKey: string,
  lng: number,
  lat: number,
  radius: number,
): Promise<GooglePlacePhotoHit | null> {
  const res = await fetch(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.photos",
      },
      body: JSON.stringify({
        maxResultCount: 5,
        rankPreference: "DISTANCE",
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius,
          },
        },
      }),
    },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as PlacesNearbyResponse;
  return firstPhotoHit(data);
}

async function searchTextPhoto(
  apiKey: string,
  textQuery: string,
  lng: number,
  lat: number,
  radius: number,
): Promise<GooglePlacePhotoHit | null> {
  const res = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.photos",
      },
      body: JSON.stringify({
        textQuery,
        maxResultCount: 5,
        locationBias: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: Math.max(radius, 120),
          },
        },
      }),
    },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as PlacesTextResponse;
  return firstPhotoHit(data);
}

function firstPhotoHit(
  data: PlacesNearbyResponse,
): GooglePlacePhotoHit | null {
  for (const place of data.places ?? []) {
    const photo = place.photos?.[0];
    if (!place.id || !photo?.name) continue;
    return {
      photoName: photo.name,
      placeId: place.id,
      placeName: place.displayName?.text,
      attribution: attributionFromPhoto(photo.authorAttributions),
    };
  }
  return null;
}

/**
 * Fetch Places photo media bytes (proxies Google; keep key server-side).
 */
export async function fetchGooglePlacePhotoMedia(
  apiKey: string,
  photoName: string,
  maxHeightPx = 800,
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  const name = photoName.trim();
  if (!name.startsWith("places/") || !name.includes("/photos/")) {
    return null;
  }
  const url = new URL(
    `https://places.googleapis.com/v1/${name}/media`,
  );
  url.searchParams.set(
    "maxHeightPx",
    String(Math.min(1600, Math.max(100, Math.round(maxHeightPx)))),
  );
  url.searchParams.set("skipHttpRedirect", "false");

  const res = await fetch(url.toString(), {
    headers: { "X-Goog-Api-Key": apiKey },
    redirect: "follow",
  });
  if (!res.ok) return null;
  const contentType =
    res.headers.get("content-type")?.split(";")[0]?.trim() ||
    "image/jpeg";
  if (!contentType.startsWith("image/")) return null;
  return { body: await res.arrayBuffer(), contentType };
}

/** Street View Metadata — fails closed when no imagery. */
export async function googleStreetViewAvailable(
  apiKey: string,
  lng: number,
  lat: number,
  radiusMeters = 50,
): Promise<{ available: boolean; copyright?: string }> {
  const url = new URL(
    "https://maps.googleapis.com/maps/api/streetview/metadata",
  );
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set(
    "radius",
    String(Math.min(200, Math.max(5, radiusMeters))),
  );
  url.searchParams.set("source", "outdoor");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) return { available: false };
  const data = (await res.json()) as StreetViewMeta;
  if (data.status !== "OK") return { available: false };
  return { available: true, copyright: data.copyright };
}

/** Street View Static image bytes. */
export async function fetchGoogleStreetViewImage(
  apiKey: string,
  lng: number,
  lat: number,
  options?: { size?: string; heading?: number; fov?: number; pitch?: number },
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  const meta = await googleStreetViewAvailable(apiKey, lng, lat, 50);
  if (!meta.available) return null;

  const size = options?.size ?? "640x480";
  if (!/^\d{2,4}x\d{2,4}$/.test(size)) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/streetview");
  url.searchParams.set("size", size);
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("source", "outdoor");
  url.searchParams.set("key", apiKey);
  if (options?.heading != null) {
    url.searchParams.set("heading", String(options.heading));
  }
  if (options?.fov != null) {
    url.searchParams.set("fov", String(options.fov));
  }
  if (options?.pitch != null) {
    url.searchParams.set("pitch", String(options.pitch));
  }

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const contentType =
    res.headers.get("content-type")?.split(";")[0]?.trim() ||
    "image/jpeg";
  if (!contentType.startsWith("image/")) return null;
  return { body: await res.arrayBuffer(), contentType };
}
