import type { FastifyInstance } from "fastify";
import { placeRowToPlace, type PlaceRow } from "@magnexis/database";
import {
  NearbyQuerySchema,
  NotFoundError,
  PlacesQuerySchema,
} from "@magnexis/shared";

const PLACE_SELECT = `
  SELECT
    id, name, category, description, address, city, state, postal_code, country,
    ST_X(geom::geometry) AS lng, ST_Y(geom::geometry) AS lat,
    source_name, source_id, source_dataset_version, imported_at, last_verified_at,
    confidence, status, properties
  FROM places
`;

export async function registerPlaceRoutes(app: FastifyInstance) {
  app.get("/api/v1/places", async (request) => {
    const query = PlacesQuerySchema.parse(request.query);
    const params: unknown[] = [];
    const where: string[] = ["deleted_at IS NULL", "status = 'active'"];

    if (query.q) {
      params.push(query.q);
      where.push(`search_vector @@ plainto_tsquery('english', $${params.length})`);
    }
    if (query.category) {
      params.push(query.category);
      where.push(`category = $${params.length}`);
    }
    if (query.bbox) {
      params.push(
        query.bbox.west,
        query.bbox.south,
        query.bbox.east,
        query.bbox.north,
      );
      where.push(
        `geom && ST_MakeEnvelope($${params.length - 3}, $${params.length - 2}, $${params.length - 1}, $${params.length}, 4326)`,
      );
    }

    params.push(query.limit);
    const limitIdx = params.length;
    params.push(query.offset);
    const offsetIdx = params.length;

    const whereSql = where.join(" AND ");
    const count = await app.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM places WHERE ${whereSql}`,
      params.slice(0, params.length - 2),
    );

    const result = await app.db.query<PlaceRow>(
      `${PLACE_SELECT}
       WHERE ${whereSql}
       ORDER BY name ASC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );

    return {
      places: result.rows.map(placeRowToPlace),
      total: Number(count.rows[0]?.count ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  });

  app.get("/api/v1/places/nearby", async (request) => {
    const query = NearbyQuerySchema.parse(request.query);
    const params: unknown[] = [
      query.lng,
      query.lat,
      query.radiusMeters,
      query.limit,
    ];
    let categoryFilter = "";
    if (query.category) {
      params.push(query.category);
      categoryFilter = `AND category = $${params.length}`;
    }

    const result = await app.db.query<PlaceRow & { distance_meters: number }>(
      `${PLACE_SELECT.replace("FROM places", `,
        ST_Distance(
          geom::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) AS distance_meters
       FROM places`)}
       WHERE deleted_at IS NULL
         AND status = 'active'
         AND ST_DWithin(
           geom::geography,
           ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
           $3
         )
         ${categoryFilter}
       ORDER BY distance_meters ASC
       LIMIT $4`,
      params,
    );

    return {
      places: result.rows.map((row) => ({
        ...placeRowToPlace(row),
        distanceMeters: row.distance_meters,
      })),
    };
  });

  app.get<{ Params: { id: string } }>("/api/v1/places/:id", async (request) => {
    const result = await app.db.query<PlaceRow>(
      `${PLACE_SELECT} WHERE id = $1 AND deleted_at IS NULL`,
      [request.params.id],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError("Place", request.params.id);
    }
    return { place: placeRowToPlace(row) };
  });
}
