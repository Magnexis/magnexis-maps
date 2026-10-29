import type { Coordinates } from "@magnexis/shared";
import { ProviderUnavailableError } from "@magnexis/shared";
import type { GeocodeHit, GeocodingProvider } from "./types.js";

type MapTilerFeature = {
  id?: string;
  place_name?: string;
  text?: string;
  /** House number when the hit is an address feature. */
  address?: string;
  place_type?: string[];
  center?: [number, number];
  geometry?: { type?: string; coordinates?: [number, number] };
  context?: Array<{ id?: string; text?: string }>;
};

type MapTilerFeatureCollection = {
  features?: MapTilerFeature[];
};

/**
 * MapTiler Geocoding API adapter.
 * @see https://docs.maptiler.com/cloud/api/geocoding/
 */
export class MapTilerGeocodingProvider implements GeocodingProvider {
  readonly name = "maptiler";
  readonly configured = true;

  constructor(private readonly apiKey: string) {}

  async geocode(
    query: string,
    options?: { limit?: number; bias?: Coordinates },
  ): Promise<GeocodeHit[]> {
    const q = query.trim();
    if (!q) return [];

    const url = new URL(
      `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json`,
    );
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("limit", String(Math.min(options?.limit ?? 5, 10)));
    url.searchParams.set("autocomplete", "true");
    if (options?.bias) {
      url.searchParams.set(
        "proximity",
        `${options.bias.lng},${options.bias.lat}`,
      );
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new ProviderUnavailableError(
        this.name,
        `HTTP ${response.status}`,
      );
    }

    const data = (await response.json()) as MapTilerFeatureCollection;
    return (data.features ?? [])
      .map((f, i) => featureToHit(f, i))
      .filter((h): h is GeocodeHit => h != null);
  }

  async reverse(coordinates: Coordinates): Promise<GeocodeHit | null> {
    // Street-level first. Asking for place/locality in the same limit=1
    // request often returned the city for every downtown click, so the pin
    // title (and photo context) looked identical everywhere.
    const precise = await this.reverseWithTypes(
      coordinates,
      "address,street",
      5,
    );
    if (precise) return precise;
    return this.reverseWithTypes(
      coordinates,
      "neighborhood,locality,place",
      1,
    );
  }

  private async reverseWithTypes(
    coordinates: Coordinates,
    types: string,
    limit: number,
  ): Promise<GeocodeHit | null> {
    const url = new URL(
      `https://api.maptiler.com/geocoding/${coordinates.lng},${coordinates.lat}.json`,
    );
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 10)));
    url.searchParams.set("types", types);

    const response = await fetch(url);
    if (!response.ok) {
      throw new ProviderUnavailableError(
        this.name,
        `HTTP ${response.status}`,
      );
    }

    const data = (await response.json()) as MapTilerFeatureCollection;
    const hits = (data.features ?? [])
      .map((f, i) => featureToHit(f, i))
      .filter((h): h is GeocodeHit => h != null);
    if (hits.length === 0) return null;

    // Prefer address > street among the batch (MapTiler order isn't guaranteed).
    const ranked = [...hits].sort(
      (a, b) => reversePrecisionScore(a) - reversePrecisionScore(b),
    );
    return ranked[0] ?? null;
  }
}

/** Lower is better — house numbers beat bare street / neighborhood labels. */
function reversePrecisionScore(hit: GeocodeHit): number {
  const label = hit.label.trim();
  if (/^\d/.test(label)) return 0;
  if (hit.address && hit.address !== label) return 1;
  return 2;
}

function featureToHit(f: MapTilerFeature, index: number): GeocodeHit | null {
  const coords =
    f.center ??
    (f.geometry?.type === "Point" ? f.geometry.coordinates : undefined);
  if (!coords || coords.length < 2) return null;
  const [lng, lat] = coords;

  const houseNumber =
    typeof f.address === "string" && f.address.trim()
      ? f.address.trim()
      : undefined;
  const primary =
    typeof f.text === "string" && f.text.trim() ? f.text.trim() : undefined;
  const streetLine =
    houseNumber && primary
      ? `${houseNumber} ${primary}`
      : primary ?? houseNumber;

  const contextBits = (f.context ?? [])
    .map((c) => c.text?.trim())
    .filter((t): t is string => Boolean(t));

  // MapTiler place_name is typically the full formatted address
  // (e.g. "41 Dixwell Avenue, New Haven, Connecticut 06511, United States").
  const fullAddress =
    (typeof f.place_name === "string" && f.place_name.trim()) ||
    [streetLine, ...contextBits].filter(Boolean).join(", ") ||
    undefined;

  const label =
    streetLine ||
    fullAddress?.split(",")[0]?.trim() ||
    fullAddress;
  if (!label) return null;

  return {
    id: f.id ?? `maptiler-${index}`,
    label,
    coordinates: { lng, lat },
    address: fullAddress,
  };
}
