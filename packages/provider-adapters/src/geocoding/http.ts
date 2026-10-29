import type { Coordinates } from "@magnexis/shared";
import { ProviderUnavailableError } from "@magnexis/shared";
import type { GeocodeHit, GeocodingProvider } from "./types.js";

type HttpGeocodingConfig = {
  name: string;
  baseUrl: string;
  apiKey?: string;
};

/**
 * Generic HTTP geocoding adapter.
 * Expects a JSON API returning { results: [{ id, label, lng, lat, address? }] }
 * or MapTiler-like { features: [...] } — adapt via GEOCODING_PROVIDER docs.
 *
 * Intentionally refuses calls to public Nominatim hosts.
 */
export class HttpGeocodingProvider implements GeocodingProvider {
  readonly name: string;
  readonly configured = true;
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(config: HttpGeocodingConfig) {
    this.name = config.name;
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.assertNotPublicNominatim(this.baseUrl);
  }

  private assertNotPublicNominatim(url: string) {
    const blocked = [
      "nominatim.openstreetmap.org",
      "nominatim.org",
    ];
    if (blocked.some((host) => url.includes(host))) {
      throw new Error(
        "Public Nominatim endpoints are not permitted for Magnexis Maps geocoding/autocomplete. Configure a licensed or self-hosted provider.",
      );
    }
  }

  async geocode(
    query: string,
    options?: { limit?: number; bias?: Coordinates },
  ): Promise<GeocodeHit[]> {
    const url = new URL(`${this.baseUrl}/geocode`);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(options?.limit ?? 5));
    if (options?.bias) {
      url.searchParams.set("lng", String(options.bias.lng));
      url.searchParams.set("lat", String(options.bias.lat));
    }
    if (this.apiKey) {
      url.searchParams.set("key", this.apiKey);
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new ProviderUnavailableError(
        this.name,
        `HTTP ${response.status}`,
      );
    }

    const data = (await response.json()) as {
      results?: Array<{
        id?: string;
        label: string;
        lng: number;
        lat: number;
        address?: string;
      }>;
    };

    return (data.results ?? []).map((r, i) => ({
      id: r.id ?? `${this.name}-${i}`,
      label: r.label,
      coordinates: { lng: r.lng, lat: r.lat },
      address: r.address,
    }));
  }

  async reverse(coordinates: Coordinates): Promise<GeocodeHit | null> {
    const url = new URL(`${this.baseUrl}/reverse`);
    url.searchParams.set("lng", String(coordinates.lng));
    url.searchParams.set("lat", String(coordinates.lat));
    if (this.apiKey) {
      url.searchParams.set("key", this.apiKey);
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new ProviderUnavailableError(
        this.name,
        `HTTP ${response.status}`,
      );
    }

    const data = (await response.json()) as {
      result?: {
        id?: string;
        label: string;
        lng: number;
        lat: number;
        address?: string;
      } | null;
    };

    if (!data.result) return null;
    return {
      id: data.result.id ?? `${this.name}-reverse`,
      label: data.result.label,
      coordinates: { lng: data.result.lng, lat: data.result.lat },
      address: data.result.address,
    };
  }
}
