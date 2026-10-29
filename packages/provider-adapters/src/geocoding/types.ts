import type { Coordinates } from "@magnexis/shared";

export type GeocodeHit = {
  id: string;
  label: string;
  coordinates: Coordinates;
  address?: string;
};

export interface GeocodingProvider {
  readonly name: string;
  readonly configured: boolean;
  geocode(query: string, options?: {
    limit?: number;
    bias?: Coordinates;
  }): Promise<GeocodeHit[]>;
  reverse(coordinates: Coordinates): Promise<GeocodeHit | null>;
}
