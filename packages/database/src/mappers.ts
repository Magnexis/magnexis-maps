import type { Place } from "@magnexis/shared";

export type PlaceRow = {
  id: string;
  name: string;
  category: Place["category"];
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  lng: number;
  lat: number;
  source_name: string;
  source_id: string | null;
  source_dataset_version: string | null;
  imported_at: Date;
  last_verified_at: Date | null;
  confidence: number | null;
  status: Place["status"];
  properties: Record<string, unknown>;
};

export function placeRowToPlace(row: PlaceRow): Place {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    address: row.address,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
    coordinates: { lng: row.lng, lat: row.lat },
    sourceName: row.source_name,
    sourceId: row.source_id,
    sourceDatasetVersion: row.source_dataset_version,
    importedAt: row.imported_at.toISOString(),
    lastVerifiedAt: row.last_verified_at?.toISOString() ?? null,
    confidence: row.confidence,
    status: row.status,
    properties: row.properties,
  };
}
