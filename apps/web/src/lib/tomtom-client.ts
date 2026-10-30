/**
 * Client helpers for TomTom enrichment via the Magnexis API proxy.
 * The TomTom key stays on the API — never call TomTom from the browser with a secret.
 */
import { resolveApiBase } from "./api-base";

export type TomTomProviderStatus = {
  configured: boolean;
  uses: string[];
  hint: string | null;
};

let cachedStatus: TomTomProviderStatus | null = null;
let statusInflight: Promise<TomTomProviderStatus> | null = null;

function apiBase(): string {
  return resolveApiBase();
}

export function tomtomProxyAbsoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${apiBase()}${path}`;
}

export async function fetchTomTomProviderStatus(
  force = false,
): Promise<TomTomProviderStatus> {
  if (!force && cachedStatus) return cachedStatus;
  if (!force && statusInflight) return statusInflight;

  statusInflight = fetch(`${apiBase()}/api/v1/providers/tomtom/status`)
    .then(async (r) => {
      if (!r.ok) {
        return {
          configured: false,
          uses: [] as string[],
          hint: "TomTom status endpoint unavailable",
        };
      }
      const d = (await r.json()) as Partial<TomTomProviderStatus>;
      const status: TomTomProviderStatus = {
        configured: Boolean(d.configured),
        uses: Array.isArray(d.uses) ? d.uses.map(String) : [],
        hint: typeof d.hint === "string" ? d.hint : null,
      };
      cachedStatus = status;
      return status;
    })
    .catch(() => {
      const status: TomTomProviderStatus = {
        configured: false,
        uses: [],
        hint: "Could not reach API for TomTom status",
      };
      cachedStatus = status;
      return status;
    })
    .finally(() => {
      statusInflight = null;
    });

  return statusInflight;
}

export type TomTomPlacePhotoJson = {
  source: "tomtom";
  attribution: string;
  placeId?: string;
  name?: string;
  phone?: string;
  url?: string;
  openingHours?: string;
  address?: string;
  photoId?: string;
  urlPath?: string;
  /** Absolute media URL for <img src>. */
  mediaUrl?: string;
};

export async function fetchTomTomPlacePhotoJson(
  lng: number,
  lat: number,
  name?: string | null,
): Promise<TomTomPlacePhotoJson | null> {
  const qs = new URLSearchParams({
    lng: String(lng),
    lat: String(lat),
  });
  if (name?.trim()) qs.set("name", name.trim());
  const res = await fetch(`${apiBase()}/api/v1/tomtom/place-photo?${qs}`);
  if (!res.ok) return null;
  const data = (await res.json()) as TomTomPlacePhotoJson & {
    hasPhoto?: boolean;
  };
  const path =
    data.urlPath ??
    (data.photoId
      ? `/api/v1/tomtom/poi-photo/${encodeURIComponent(data.photoId)}`
      : null);
  // Photo resolver only cares about imagery; details-only hits are ignored here.
  if (!path) return null;
  return {
    ...data,
    source: "tomtom",
    attribution: data.attribution || "TomTom",
    mediaUrl: tomtomProxyAbsoluteUrl(path),
  };
}

/** TomTom POI details (phone / hours / address) even when no photo exists. */
export async function fetchTomTomPlaceDetailsJson(
  lng: number,
  lat: number,
  name?: string | null,
): Promise<TomTomPlacePhotoJson | null> {
  const qs = new URLSearchParams({
    lng: String(lng),
    lat: String(lat),
  });
  if (name?.trim()) qs.set("name", name.trim());
  const res = await fetch(`${apiBase()}/api/v1/tomtom/place-photo?${qs}`);
  if (!res.ok) return null;
  const data = (await res.json()) as TomTomPlacePhotoJson;
  if (!data.placeId && !data.name) return null;
  const path = data.urlPath ?? null;
  return {
    ...data,
    source: "tomtom",
    attribution: data.attribution || "TomTom",
    mediaUrl: path ? tomtomProxyAbsoluteUrl(path) : undefined,
  };
}

export async function fetchTomTomCategory(params: {
  category: string;
  lng: number;
  lat: number;
  radiusMeters?: number;
  limit?: number;
}): Promise<
  Array<{
    id: string;
    label: string;
    coordinates: { lng: number; lat: number };
    address?: string;
    distanceMeters?: number;
  }>
> {
  const qs = new URLSearchParams({
    category: params.category,
    lng: String(params.lng),
    lat: String(params.lat),
  });
  if (params.radiusMeters) qs.set("radiusMeters", String(params.radiusMeters));
  if (params.limit) qs.set("limit", String(params.limit));
  const res = await fetch(`${apiBase()}/api/v1/tomtom/category?${qs}`);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    results?: typeof params extends never
      ? never
      : Array<{
          id: string;
          label: string;
          coordinates: { lng: number; lat: number };
          address?: string;
          distanceMeters?: number;
        }>;
  };
  return Array.isArray(data.results) ? data.results : [];
}

export async function fetchTomTomAlongRoute(params: {
  q: string;
  points: Array<{ lng: number; lat: number }>;
  maxDetourSeconds?: number;
  limit?: number;
}): Promise<
  Array<{
    id: string;
    label: string;
    coordinates: { lng: number; lat: number };
    address?: string;
  }>
> {
  const res = await fetch(`${apiBase()}/api/v1/tomtom/along-route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    results?: Array<{
      id: string;
      label: string;
      coordinates: { lng: number; lat: number };
      address?: string;
    }>;
  };
  return Array.isArray(data.results) ? data.results : [];
}

export async function fetchTomTomSpeedLimit(
  lng: number,
  lat: number,
): Promise<{ speedLimitKph: number | null; address?: string }> {
  const qs = new URLSearchParams({
    lng: String(lng),
    lat: String(lat),
  });
  try {
    const res = await fetch(`${apiBase()}/api/v1/tomtom/speed-limit?${qs}`);
    if (!res.ok) return { speedLimitKph: null };
    const data: unknown = await res.json();
    if (!data || typeof data !== "object") return { speedLimitKph: null };
    const limit = "speedLimitKph" in data ? data.speedLimitKph : null;
    const address =
      "address" in data && typeof data.address === "string"
        ? data.address
        : undefined;
    return {
      speedLimitKph:
        typeof limit === "number" && Number.isFinite(limit) && limit > 0
          ? limit
          : null,
      ...(address === undefined ? {} : { address }),
    };
  } catch {
    // Optional enrichment must hide an unknown limit when offline or when a
    // provider returns invalid JSON, rather than rejecting in the GPS callback.
    return { speedLimitKph: null };
  }
}
