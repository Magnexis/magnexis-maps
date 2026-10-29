/**
 * TomTom Search / POI enrichment (photos, hours, contact, category search).
 * Server-side key only — never call from the browser with a secret.
 * @see https://developer.tomtom.com/search-api
 */

export type TomTomPlacePhotoHit = {
  photoId: string;
  entityId?: string;
  name?: string;
  attribution: string;
};

export type TomTomPlaceDetails = {
  id: string;
  name: string;
  phone?: string;
  url?: string;
  categories?: string[];
  openingHours?: string;
  address?: string;
  coordinates?: { lng: number; lat: number };
  photoIds: string[];
};

type NearbyResult = {
  id?: string;
  poi?: {
    name?: string;
    phone?: string;
    url?: string;
    categories?: string[];
    categorySet?: Array<{ id?: number }>;
  };
  address?: { freeformAddress?: string };
  position?: { lat: number; lon: number };
  dataSources?: {
    poiDetails?: { id?: string };
  };
};

type PoiDetailsResponse = {
  id?: string;
  result?: {
    poi?: NearbyResult["poi"] & {
      openingHours?: { timeRanges?: unknown; modes?: unknown };
    };
    address?: { freeformAddress?: string };
    position?: { lat: number; lon: number };
    photos?: Array<{ id?: string }>;
  };
  photos?: Array<{ id?: string }>;
};

function firstPhotoIds(body: PoiDetailsResponse): string[] {
  const fromResult = body.result?.photos ?? [];
  const top = body.photos ?? [];
  const ids: string[] = [];
  for (const p of [...fromResult, ...top]) {
    if (typeof p?.id === "string" && p.id && !ids.includes(p.id)) {
      ids.push(p.id);
    }
  }
  return ids;
}

/** Nearby POI search — prefer results that expose poiDetails for photos. */
export async function findNearbyTomTomPlace(
  apiKey: string,
  lng: number,
  lat: number,
  options?: { name?: string | null; radiusMeters?: number },
): Promise<TomTomPlaceDetails | null> {
  const radius = Math.min(2000, Math.max(40, options?.radiusMeters ?? 120));
  const url = new URL("https://api.tomtom.com/search/2/nearbySearch/.json");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("radius", String(radius));
  url.searchParams.set("limit", "8");

  const response = await fetch(url);
  if (!response.ok) return null;
  const data = (await response.json()) as { results?: NearbyResult[] };
  const results = data.results ?? [];
  if (!results.length) return null;

  const needle = options?.name?.trim().toLowerCase() ?? "";
  let ordered = results;
  if (needle.length >= 3) {
    const named = results.filter((r) =>
      (r.poi?.name ?? "").toLowerCase().includes(needle.slice(0, 32)),
    );
    if (named.length) ordered = [...named, ...results.filter((r) => !named.includes(r))];
  }

  for (const hit of ordered) {
    const detailsId = hit.dataSources?.poiDetails?.id ?? hit.id;
    if (!detailsId) continue;
    const details = await fetchTomTomPoiDetails(apiKey, detailsId);
    if (details) {
      if (!details.name && hit.poi?.name) details.name = hit.poi.name;
      if (!details.address && hit.address?.freeformAddress) {
        details.address = hit.address.freeformAddress;
      }
      if (!details.coordinates && hit.position) {
        details.coordinates = { lng: hit.position.lon, lat: hit.position.lat };
      }
      return details;
    }
    // Soft fallback without photos
    if (hit.poi?.name || hit.address?.freeformAddress) {
      return {
        id: detailsId,
        name: hit.poi?.name ?? hit.address?.freeformAddress ?? "Place",
        phone: hit.poi?.phone,
        url: hit.poi?.url,
        categories: hit.poi?.categories,
        address: hit.address?.freeformAddress,
        coordinates: hit.position
          ? { lng: hit.position.lon, lat: hit.position.lat }
          : undefined,
        photoIds: [],
      };
    }
  }
  return null;
}

export async function fetchTomTomPoiDetails(
  apiKey: string,
  entityId: string,
): Promise<TomTomPlaceDetails | null> {
  const id = entityId.trim();
  if (!id) return null;
  const url = new URL("https://api.tomtom.com/search/2/poiDetails.json");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("id", id);

  const response = await fetch(url);
  if (!response.ok) return null;
  const body = (await response.json()) as PoiDetailsResponse;
  const poi = body.result?.poi;
  const pos = body.result?.position;
  const hours = formatOpeningHours(poi?.openingHours);

  return {
    id: body.id ?? id,
    name: poi?.name ?? "Place",
    phone: poi?.phone,
    url: poi?.url,
    categories: poi?.categories,
    openingHours: hours,
    address: body.result?.address?.freeformAddress,
    coordinates: pos ? { lng: pos.lon, lat: pos.lat } : undefined,
    photoIds: firstPhotoIds(body),
  };
}

function formatOpeningHours(
  hours?: { timeRanges?: unknown; modes?: unknown } | null,
): string | undefined {
  if (!hours) return undefined;
  try {
    // TomTom opening hours structures vary; surface a compact JSON summary when present.
    const ranges = hours.timeRanges;
    if (Array.isArray(ranges) && ranges.length) {
      return `${ranges.length} schedule block${ranges.length === 1 ? "" : "s"}`;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** Fetch POI photo bytes from TomTom (caller streams to client). */
export async function fetchTomTomPoiPhotoMedia(
  apiKey: string,
  photoId: string,
  options?: { height?: number },
): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  const id = photoId.trim();
  if (!id) return null;
  const height = Math.min(1200, Math.max(120, options?.height ?? 640));
  const url = new URL("https://api.tomtom.com/search/2/poiPhoto");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("id", id);
  url.searchParams.set("height", String(height));

  const response = await fetch(url);
  if (!response.ok) return null;
  const contentType =
    response.headers.get("content-type") ?? "image/jpeg";
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength) return null;
  return { bytes, contentType };
}

/** Category search (e.g. parking) near a point. */
export async function tomtomCategorySearch(
  apiKey: string,
  category: string,
  lng: number,
  lat: number,
  options?: { radiusMeters?: number; limit?: number },
): Promise<
  Array<{
    id: string;
    label: string;
    coordinates: { lng: number; lat: number };
    address?: string;
    distanceMeters?: number;
  }>
> {
  const q = category.trim() || "parking";
  const url = new URL(
    `https://api.tomtom.com/search/2/categorySearch/${encodeURIComponent(q)}.json`,
  );
  url.searchParams.set("key", apiKey);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set(
    "radius",
    String(Math.min(10_000, Math.max(200, options?.radiusMeters ?? 1500))),
  );
  url.searchParams.set("limit", String(Math.min(20, options?.limit ?? 8)));

  const response = await fetch(url);
  if (!response.ok) return [];
  const data = (await response.json()) as {
    results?: Array<
      NearbyResult & { dist?: number }
    >;
  };

  return (data.results ?? [])
    .map((r, i) => {
      if (!r.position) return null;
      return {
        id: r.id ?? `tomtom-cat-${i}`,
        label: r.poi?.name ?? r.address?.freeformAddress ?? q,
        coordinates: { lng: r.position.lon, lat: r.position.lat },
        address: r.address?.freeformAddress,
        distanceMeters: typeof r.dist === "number" ? r.dist : undefined,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
}

/**
 * Search along a route polyline (TomTom Search Along Route).
 * Points should be [lat, lng] pairs — TomTom expects lat,lon.
 */
export async function tomtomSearchAlongRoute(
  apiKey: string,
  query: string,
  routePoints: Array<{ lng: number; lat: number }>,
  options?: { maxDetourSeconds?: number; limit?: number },
): Promise<
  Array<{
    id: string;
    label: string;
    coordinates: { lng: number; lat: number };
    address?: string;
  }>
> {
  const q = query.trim();
  if (!q || routePoints.length < 2) return [];

  // TomTom caps body size — downsample long polylines.
  const maxPts = 50;
  const step = Math.max(1, Math.ceil(routePoints.length / maxPts));
  const sampled = routePoints.filter((_, i) => i % step === 0);
  if (sampled[sampled.length - 1] !== routePoints[routePoints.length - 1]) {
    sampled.push(routePoints[routePoints.length - 1]!);
  }

  const url = new URL(
    `https://api.tomtom.com/search/2/searchAlongRoute/${encodeURIComponent(q)}.json`,
  );
  url.searchParams.set("key", apiKey);
  url.searchParams.set("limit", String(Math.min(15, options?.limit ?? 8)));
  url.searchParams.set(
    "maxDetourTime",
    String(Math.min(3600, Math.max(60, options?.maxDetourSeconds ?? 600))),
  );

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      route: {
        points: sampled.map((p) => ({
          lat: p.lat,
          lon: p.lng,
        })),
      },
    }),
  });
  if (!response.ok) return [];
  const data = (await response.json()) as { results?: NearbyResult[] };

  return (data.results ?? [])
    .map((r, i) => {
      if (!r.position) return null;
      return {
        id: r.id ?? `tomtom-along-${i}`,
        label: r.poi?.name ?? r.address?.freeformAddress ?? q,
        coordinates: { lng: r.position.lon, lat: r.position.lat },
        address: r.address?.freeformAddress,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
}

/** Reverse geocode with optional posted speed limit (m/s → we convert). */
export async function tomtomReverseWithSpeedLimit(
  apiKey: string,
  lng: number,
  lat: number,
): Promise<{ speedLimitKph: number | null; address?: string }> {
  const url = new URL(
    `https://api.tomtom.com/search/2/reverseGeocode/${lat},${lng}.json`,
  );
  url.searchParams.set("key", apiKey);
  url.searchParams.set("returnSpeedLimit", "true");

  const response = await fetch(url);
  if (!response.ok) return { speedLimitKph: null };
  const data = (await response.json()) as {
    addresses?: Array<{
      address?: {
        freeformAddress?: string;
        speedLimit?: string | number;
      };
    }>;
  };
  const addr = data.addresses?.[0]?.address;
  let speedLimitKph: number | null = null;
  const raw = addr?.speedLimit;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    // TomTom may return m/s or km/h depending on market — treat values < 80 as m/s.
    speedLimitKph = raw < 80 ? Math.round(raw * 3.6) : Math.round(raw);
  } else if (typeof raw === "string") {
    const n = Number.parseFloat(raw.replace(/[^\d.]/g, ""));
    if (Number.isFinite(n) && n > 0) {
      speedLimitKph = n < 80 ? Math.round(n * 3.6) : Math.round(n);
    }
  }
  return {
    speedLimitKph,
    address: addr?.freeformAddress,
  };
}
