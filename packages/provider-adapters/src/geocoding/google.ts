import type { Coordinates } from "@magnexis/shared";
import { ProviderUnavailableError } from "@magnexis/shared";
import type { GeocodeHit, GeocodingProvider } from "./types.js";

type GoogleGeocodeResult = {
  place_id?: string;
  formatted_address?: string;
  geometry?: { location?: { lat?: number; lng?: number } };
};

type GoogleGeocodeResponse = {
  status?: string;
  results?: GoogleGeocodeResult[];
  error_message?: string;
};

/**
 * Google Geocoding API adapter (optional fallback).
 * Enable with GEOCODING_PROVIDER=google (requires Geocoding API in Cloud Console).
 * @see https://developers.google.com/maps/documentation/geocoding
 */
export class GoogleGeocodingProvider implements GeocodingProvider {
  readonly name = "google";
  readonly configured = true;

  constructor(private readonly apiKey: string) {}

  async geocode(
    query: string,
    options?: { limit?: number; bias?: Coordinates },
  ): Promise<GeocodeHit[]> {
    const q = query.trim();
    if (!q) return [];

    const url = new URL(
      "https://maps.googleapis.com/maps/api/geocode/json",
    );
    url.searchParams.set("address", q);
    url.searchParams.set("key", this.apiKey);
    if (options?.bias) {
      url.searchParams.set(
        "bounds",
        `${options.bias.lat - 0.2},${options.bias.lng - 0.2}|${options.bias.lat + 0.2},${options.bias.lng + 0.2}`,
      );
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new ProviderUnavailableError(
        this.name,
        `HTTP ${response.status}`,
      );
    }
    const data = (await response.json()) as GoogleGeocodeResponse;
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      throw new ProviderUnavailableError(
        this.name,
        data.error_message ?? data.status ?? "geocode failed",
      );
    }

    const limit = Math.min(options?.limit ?? 5, 10);
    return (data.results ?? [])
      .slice(0, limit)
      .map((r, i) => resultToHit(r, i))
      .filter((h): h is GeocodeHit => h != null);
  }

  async reverse(coordinates: Coordinates): Promise<GeocodeHit | null> {
    const url = new URL(
      "https://maps.googleapis.com/maps/api/geocode/json",
    );
    url.searchParams.set(
      "latlng",
      `${coordinates.lat},${coordinates.lng}`,
    );
    url.searchParams.set("key", this.apiKey);

    const response = await fetch(url);
    if (!response.ok) {
      throw new ProviderUnavailableError(
        this.name,
        `HTTP ${response.status}`,
      );
    }
    const data = (await response.json()) as GoogleGeocodeResponse;
    if (data.status !== "OK") return null;
    return resultToHit(data.results?.[0], 0);
  }
}

function resultToHit(
  r: GoogleGeocodeResult | undefined,
  index: number,
): GeocodeHit | null {
  if (!r) return null;
  const lat = r.geometry?.location?.lat;
  const lng = r.geometry?.location?.lng;
  if (lat == null || lng == null) return null;
  const label = r.formatted_address?.trim();
  if (!label) return null;
  return {
    id: r.place_id ?? `google-geocode-${index}`,
    label,
    coordinates: { lng, lat },
    address: label,
  };
}
