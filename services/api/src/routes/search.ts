import type { FastifyInstance } from "fastify";
import {
  GeocodeQuerySchema,
  MagnexisError,
  ProviderUnavailableError,
  ReverseGeocodeQuerySchema,
  SearchQuerySchema,
  type SearchResult,
} from "@magnexis/shared";

export async function registerSearchRoutes(app: FastifyInstance) {
  app.get("/api/v1/search", async (request) => {
    const query = SearchQuerySchema.parse(request.query);
    const params: unknown[] = [query.q, query.limit];
    let orderSql = `ts_rank(search_vector, plainto_tsquery('english', $1)) DESC, name ASC`;

    if (query.lng != null && query.lat != null) {
      params.push(query.lng, query.lat);
      orderSql = `ST_Distance(
        geom::geography,
        ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography
      ) ASC, ${orderSql}`;
    }

    let categoryFilter = "";
    if (query.category) {
      params.push(query.category);
      categoryFilter = `AND category = $${params.length}`;
    }

    const result = await app.db.query<{
      id: string;
      name: string;
      category: SearchResult["category"];
      address: string | null;
      city: string | null;
      lng: number;
      lat: number;
      distance_meters: number | null;
      last_verified_at: Date | null;
    }>(
      `SELECT
         id, name, category, address, city,
         ST_X(geom::geometry) AS lng, ST_Y(geom::geometry) AS lat,
         ${
           query.lng != null && query.lat != null
             ? `ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography)`
             : "NULL"
         } AS distance_meters,
         last_verified_at
       FROM places
       WHERE deleted_at IS NULL
         AND status = 'active'
         AND (
           search_vector @@ plainto_tsquery('english', $1)
           OR name ILIKE '%' || $1 || '%'
           OR city ILIKE '%' || $1 || '%'
           OR address ILIKE '%' || $1 || '%'
         )
         ${categoryFilter}
       ORDER BY ${orderSql}
       LIMIT $2`,
      params,
    );

    const results: SearchResult[] = result.rows.map((row) => ({
      id: row.id,
      label: row.name,
      kind: "place" as const,
      category: row.category,
      coordinates: { lng: row.lng, lat: row.lat },
      address: [row.address, row.city].filter(Boolean).join(", ") || undefined,
      distanceMeters: row.distance_meters ?? undefined,
      source: "internal" as const,
      verified: Boolean(row.last_verified_at),
    }));

    // Optionally enrich with external geocoder when configured (never fabricate)
    if (app.geocoder.configured && results.length < query.limit) {
      try {
        const geoHits = await app.geocoder.geocode(query.q, {
          limit: query.limit - results.length,
          bias:
            query.lng != null && query.lat != null
              ? { lng: query.lng, lat: query.lat }
              : undefined,
        });
        for (const hit of geoHits) {
          results.push({
            id: hit.id,
            label: hit.label,
            kind: "geocode",
            coordinates: hit.coordinates,
            address: hit.address,
            source: "geocoder",
            verified: false,
          });
        }
      } catch (error) {
        if (!(error instanceof ProviderUnavailableError)) {
          throw error;
        }
        // Internal results still returned; geocoder failure is soft
        app.log.warn({ err: error }, "External geocoder unavailable during search");
      }
    }

    return {
      results,
      query: query.q,
      sources: {
        internal: true,
        geocoder: app.geocoder.configured,
      },
    };
  });

  app.get("/api/v1/geocode", async (request) => {
    const query = GeocodeQuerySchema.parse(request.query);
    if (!app.geocoder.configured) {
      throw new ProviderUnavailableError(
        "geocoding",
        "Configure GEOCODING_PROVIDER and GEOCODING_API_URL. Public Nominatim is not permitted.",
      );
    }
    try {
      const results = await app.geocoder.geocode(query.q, {
        limit: query.limit,
        bias:
          query.biasLng != null && query.biasLat != null
            ? { lng: query.biasLng, lat: query.biasLat }
            : undefined,
      });
      return { results, provider: app.geocoder.name };
    } catch (error) {
      if (error instanceof MagnexisError) throw error;
      throw new ProviderUnavailableError("geocoding", String(error));
    }
  });

  app.get("/api/v1/reverse-geocode", async (request) => {
    const query = ReverseGeocodeQuerySchema.parse(request.query);

    // Only surface a seeded place when the click is actually near it.
    // Far "nearest" hits (e.g. 20km) must not become the pin title.
    const NEAR_PLACE_METERS = 350;

    const nearby = await app.db.query<{
      id: string;
      name: string;
      category: string;
      address: string | null;
      city: string | null;
      lng: number;
      lat: number;
      distance_meters: number;
    }>(
      `SELECT
         id, name, category, address, city,
         ST_X(geom::geometry) AS lng, ST_Y(geom::geometry) AS lat,
         ST_Distance(
           geom::geography,
           ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
         ) AS distance_meters
       FROM places
       WHERE deleted_at IS NULL
         AND status = 'active'
         AND ST_DWithin(
           geom::geography,
           ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
           $3
         )
       ORDER BY geom::geography <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
       LIMIT 1`,
      [query.lng, query.lat, NEAR_PLACE_METERS],
    );

    const nearest = nearby.rows[0]
      ? {
          id: nearby.rows[0].id,
          label: nearby.rows[0].name,
          kind: "place" as const,
          category: nearby.rows[0].category,
          coordinates: {
            lng: nearby.rows[0].lng,
            lat: nearby.rows[0].lat,
          },
          address:
            [nearby.rows[0].address, nearby.rows[0].city]
              .filter(Boolean)
              .join(", ") || undefined,
          distanceMeters: nearby.rows[0].distance_meters,
          source: "internal" as const,
          verified: false,
        }
      : null;

    let geocodeResult: {
      id: string;
      label: string;
      coordinates: { lng: number; lat: number };
      address?: string;
    } | null = null;

    if (app.geocoder.configured) {
      try {
        geocodeResult = await app.geocoder.reverse({
          lng: query.lng,
          lat: query.lat,
        });
      } catch (error) {
        app.log.warn({ err: error }, "Reverse geocode provider failed");
      }
    }

    return {
      coordinates: { lng: query.lng, lat: query.lat },
      result: geocodeResult,
      nearestPlace: nearest,
      provider: app.geocoder.configured ? app.geocoder.name : "internal",
    };
  });
}
