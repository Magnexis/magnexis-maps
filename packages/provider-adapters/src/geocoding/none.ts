import { ProviderUnavailableError, type Coordinates } from "@magnexis/shared";
import type { GeocodeHit, GeocodingProvider } from "./types.js";

/** Explicit unconfigured geocoder — never fabricates results. */
export class NoneGeocodingProvider implements GeocodingProvider {
  readonly name = "none";
  readonly configured = false;

  async geocode(): Promise<GeocodeHit[]> {
    throw new ProviderUnavailableError(
      "geocoding",
      "GEOCODING_PROVIDER is not configured. Set a licensed/self-hosted provider (not public Nominatim).",
    );
  }

  async reverse(_coordinates: Coordinates): Promise<GeocodeHit | null> {
    throw new ProviderUnavailableError(
      "geocoding",
      "GEOCODING_PROVIDER is not configured.",
    );
  }
}
