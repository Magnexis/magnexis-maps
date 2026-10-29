import type { FastifyInstance } from "fastify";
import { CreateIncidentSchema } from "@magnexis/shared";
import { requireAuth } from "../plugins/auth.js";

export async function registerIncidentRoutes(app: FastifyInstance) {
  app.get("/api/v1/incidents", async () => {
    const result = await app.db.query(
      `SELECT id, category, description,
              ST_X(geom::geometry) AS lng, ST_Y(geom::geometry) AS lat,
              created_at, expires_at, verification_status, source
       FROM incident_reports
       WHERE deleted_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC
       LIMIT 200`,
    );

    return {
      incidents: result.rows.map((r) => ({
        id: r.id,
        category: r.category,
        description: r.description,
        coordinates: { lng: r.lng, lat: r.lat },
        createdAt: (r.created_at as Date).toISOString(),
        expiresAt: r.expires_at
          ? (r.expires_at as Date).toISOString()
          : null,
        verificationStatus: r.verification_status,
        source: r.source,
      })),
      notice:
        "Incident overlay only. Live traffic speed / congestion routing is disabled until legitimate traffic inputs exist.",
    };
  });

  app.post("/api/v1/incidents", async (request, reply) => {
    const user = requireAuth(request);
    const body = CreateIncidentSchema.parse(request.body);
    const expiresAt =
      body.expiresAt ??
      new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

    const result = await app.db.query(
      `INSERT INTO incident_reports (
         category, description, geom, expires_at, verification_status, source, reporter_id
       ) VALUES (
         $1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, 'unverified', 'user', $6
       )
       RETURNING id, category, description,
                 ST_X(geom::geometry) AS lng, ST_Y(geom::geometry) AS lat,
                 created_at, expires_at, verification_status, source`,
      [
        body.category,
        body.description,
        body.coordinates.lng,
        body.coordinates.lat,
        expiresAt,
        user.id,
      ],
    );
    const r = result.rows[0]!;
    return reply.status(201).send({
      incident: {
        id: r.id,
        category: r.category,
        description: r.description,
        coordinates: { lng: r.lng, lat: r.lat },
        createdAt: (r.created_at as Date).toISOString(),
        expiresAt: r.expires_at
          ? (r.expires_at as Date).toISOString()
          : null,
        verificationStatus: r.verification_status,
        source: r.source,
      },
    });
  });
}
