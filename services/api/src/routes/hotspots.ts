import type { FastifyInstance } from "fastify";
import { HotspotQuerySchema } from "@magnexis/shared";

type HotspotRow = {
  id: string;
  lng: number;
  lat: number;
  place_count: number;
  label: string;
};

/**
 * Public-place density is a useful discovery cue, but it is not live footfall.
 * Keeping this source explicit prevents the UI from overstating what we know.
 */
export async function registerHotspotRoutes(app: FastifyInstance) {
  app.get("/api/v1/hotspots", async (request) => {
    const query = HotspotQuerySchema.parse(request.query);
    // Meter-based Web Mercator buckets make the density stable across map zoom.
    const cellMeters = Math.max(180, Math.min(800, Math.round(query.radiusMeters / 9)));
    const result = await app.db.query<HotspotRow>(
      `WITH nearby AS (
         SELECT geom
         FROM places
         WHERE deleted_at IS NULL
           AND status = 'active'
           AND ST_DWithin(
             geom::geography,
             ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
             $3
           )
       ), buckets AS (
         SELECT
           ST_SnapToGrid(ST_Transform(geom::geometry, 3857), $4) AS cell,
           geom
         FROM nearby
       )
       SELECT
         md5(ST_AsText(cell)) AS id,
         ST_X(ST_Centroid(ST_Collect(geom::geometry))) AS lng,
         ST_Y(ST_Centroid(ST_Collect(geom::geometry))) AS lat,
         COUNT(*)::int AS place_count,
         CONCAT(COUNT(*)::int, ' places nearby') AS label
       FROM buckets
       GROUP BY cell
       HAVING COUNT(*) >= 3
       ORDER BY COUNT(*) DESC, id ASC
       LIMIT $5`,
      [query.lng, query.lat, query.radiusMeters, cellMeters, query.limit],
    );

    const maxCount = Math.max(1, ...result.rows.map((row) => row.place_count));
    return {
      hotspots: result.rows.map((row) => ({
        id: row.id,
        coordinates: { lng: Number(row.lng), lat: Number(row.lat) },
        activityScore: Math.round(30 + (70 * row.place_count) / maxCount),
        placeCount: row.place_count,
        label: row.label,
      })),
      basis: "public_place_density" as const,
      notice:
        "Hotspots estimate nearby activity from public place density. They are not live foot-traffic or device-location data.",
    };
  });
}
