import type { Coordinates } from "@magnexis/shared";
import { ProviderUnavailableError } from "@magnexis/shared";
import type { GeocodeHit, GeocodingProvider } from "./types.js";

type TomTomResult = {
  id?: string;
  type?: string;
  address?: {
    freeformAddress?: string;
    streetName?: string;
    streetNumber?: string;
    municipality?: string;
    countrySecondarySubdivision?: string;
    countrySubdivision?: string;
    countrySubdivisionName?: string;
    postalCode?: string;
    country?: string;
  };
  position?: { lat: number; lon: number };
};

type TomTomSearchResponse = {
  results?: TomTomResult[];
  errorText?: string;
};

type TomTomReverseResponse = {
  addresses?: Array<{
    address?: TomTomResult["address"];
    position?: string;
  }>;
  errorText?: string;
};

/**
 * TomTom Search API — fuzzy search + reverse geocode.
 * Server-side key only.
 * @see https://developer.tomtom.com/search-api
 */
export class TomTomGeocodingProvider implements GeocodingProvider {
  readonly name = "tomtom";
  readonly configured = true;

  constructor(private readonly apiKey: string) {}

  async geocode(
    query: string,
    options?: { limit?: number; bias?: Coordinates },
  ): Promise<GeocodeHit[]> {
    const q = query.trim();
    if (!q) return [];

    const url = new URL(
      `https://api.tomtom.com/search/2/search/${encodeURIComponent(q)}.json`,
    );
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("limit", String(Math.min(options?.limit ?? 8, 20)));
    url.searchParams.set("typeahead", "true");
    if (options?.bias) {
      url.searchParams.set("lat", String(options.bias.lat));
      url.searchParams.set("lon", String(options.bias.lng));
      url.searchParams.set("radius", "50000");
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new ProviderUnavailableError(this.name, `HTTP ${response.status}`);
    }

    const data = (await response.json()) as TomTomSearchResponse;
    return (data.results ?? [])
      .map((r, i) => resultToHit(r, i))
      .filter((h): h is GeocodeHit => h != null);
  }

  async reverse(coordinates: Coordinates): Promise<GeocodeHit | null> {
    const url = new URL(
      `https://api.tomtom.com/search/2/reverseGeocode/${coordinates.lat},${coordinates.lng}.json`,
    );
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("returnSpeedLimit", "false");

    const response = await fetch(url);
    if (!response.ok) {
      throw new ProviderUnavailableError(this.name, `HTTP ${response.status}`);
    }

    const data = (await response.json()) as TomTomReverseResponse;
    const first = data.addresses?.[0];
    if (!first?.address) return null;

    const label =
      first.address.freeformAddress ||
      [first.address.streetNumber, first.address.streetName]
        .filter(Boolean)
        .join(" ") ||
      "Unknown location";

    let lng = coordinates.lng;
    let lat = coordinates.lat;
    if (first.position) {
      const parts = first.position.split(",").map(Number);
      const la = parts[0];
      const lo = parts[1];
      if (la != null && lo != null && Number.isFinite(la) && Number.isFinite(lo)) {
        lat = la;
        lng = lo;
      }
    }

    return {
      id: `tomtom-rev-${lng.toFixed(5)}-${lat.toFixed(5)}`,
      label,
      coordinates: { lng, lat },
      address: first.address.freeformAddress ?? label,
    };
  }
}

function resultToHit(r: TomTomResult, index: number): GeocodeHit | null {
  if (!r.position) return null;
  const { lat, lon: lng } = r.position;
  const addr = r.address;
  const street = [addr?.streetNumber, addr?.streetName]
    .filter(Boolean)
    .join(" ");
  const label =
    addr?.freeformAddress ||
    street ||
    addr?.municipality ||
    `Result ${index + 1}`;

  return {
    id: r.id ?? `tomtom-${index}-${lng.toFixed(5)}-${lat.toFixed(5)}`,
    label,
    coordinates: { lng, lat },
    address: addr?.freeformAddress ?? label,
  };
}
