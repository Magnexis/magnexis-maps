/**
 * Client helpers for Google Maps Platform enrichment via the Magnexis API proxy.
 * The Maps key stays on the API — do not call Google from the browser with a secret.
 */

export type GoogleProviderStatus = {
  configured: boolean;
  photoPriority: "before" | "after";
  uses: string[];
  hint: string | null;
};

let cachedStatus: GoogleProviderStatus | null = null;
let statusInflight: Promise<GoogleProviderStatus> | null = null;

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(
    /\/$/,
    "",
  );
}

/** Absolute URL for a same-API relative path returned by Google proxy routes. */
export function googleProxyAbsoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${apiBase()}${path}`;
}

export async function fetchGoogleProviderStatus(
  force = false,
): Promise<GoogleProviderStatus> {
  if (!force && cachedStatus) return cachedStatus;
  if (!force && statusInflight) return statusInflight;

  statusInflight = fetch(`${apiBase()}/api/v1/providers/google/status`)
    .then(async (r) => {
      if (!r.ok) {
        return {
          configured: false,
          photoPriority: "before" as const,
          uses: [] as string[],
          hint: "Google status endpoint unavailable",
        };
      }
      const d = (await r.json()) as Partial<GoogleProviderStatus>;
      const status: GoogleProviderStatus = {
        configured: Boolean(d.configured),
        photoPriority: d.photoPriority === "after" ? "after" : "before",
        uses: Array.isArray(d.uses) ? d.uses.map(String) : [],
        hint: typeof d.hint === "string" ? d.hint : null,
      };
      cachedStatus = status;
      return status;
    })
    .catch(() => {
      const status: GoogleProviderStatus = {
        configured: false,
        photoPriority: "before",
        uses: [],
        hint: "Could not reach API for Google status",
      };
      cachedStatus = status;
      return status;
    })
    .finally(() => {
      statusInflight = null;
    });

  return statusInflight;
}

/** Sync hint from last status fetch (may be stale until first fetch completes). */
export function googleConfiguredCached(): boolean {
  return cachedStatus?.configured === true;
}

export type GooglePlacePhotoJson = {
  source: "google";
  attribution: string;
  placeId: string;
  placeName: string | null;
  photoName: string;
  url: string;
};

export async function fetchGooglePlacePhotoJson(
  lng: number,
  lat: number,
  name?: string | null,
): Promise<GooglePlacePhotoJson | null> {
  const status = await fetchGoogleProviderStatus();
  if (!status.configured) return null;

  const qs = new URLSearchParams({
    lng: String(lng),
    lat: String(lat),
    maxHeight: "800",
  });
  if (name?.trim()) qs.set("name", name.trim().slice(0, 80));

  try {
    const res = await fetch(`${apiBase()}/api/v1/google/place-photo?${qs}`);
    if (!res.ok) return null;
    const data = (await res.json()) as GooglePlacePhotoJson;
    if (!data?.url) return null;
    return {
      ...data,
      url: googleProxyAbsoluteUrl(data.url),
    };
  } catch {
    return null;
  }
}

export async function googleStreetViewMeta(
  lng: number,
  lat: number,
): Promise<{ available: boolean; imageUrl: string | null; copyright: string | null }> {
  const status = await fetchGoogleProviderStatus();
  if (!status.configured) {
    return { available: false, imageUrl: null, copyright: null };
  }

  try {
    const qs = new URLSearchParams({
      lng: String(lng),
      lat: String(lat),
      radius: "50",
    });
    const res = await fetch(
      `${apiBase()}/api/v1/google/street-view/meta?${qs}`,
    );
    if (!res.ok) {
      return { available: false, imageUrl: null, copyright: null };
    }
    const data = (await res.json()) as {
      available?: boolean;
      imageUrl?: string | null;
      copyright?: string | null;
    };
    return {
      available: Boolean(data.available),
      imageUrl: data.imageUrl
        ? googleProxyAbsoluteUrl(data.imageUrl)
        : null,
      copyright: data.copyright ?? null,
    };
  } catch {
    return { available: false, imageUrl: null, copyright: null };
  }
}

/** Public Google Maps Street View URL (no API key; opens in a new tab). */
export function googleMapsStreetViewWebUrl(lng: number, lat: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
}
