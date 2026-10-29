import type { FastifyInstance } from "fastify";
import { requireRoles } from "../plugins/auth.js";

export async function registerAdminRoutes(app: FastifyInstance) {
  app.get("/api/v1/admin/overview", async (request) => {
    requireRoles(request, ["moderator", "administrator"]);

    const [places, reports, jobs, incidents] = await Promise.all([
      app.db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM places WHERE deleted_at IS NULL`,
      ),
      app.db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM correction_reports WHERE status IN ('submitted', 'under_review')`,
      ),
      app.db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM ingestion_jobs WHERE status = 'failed'`,
      ),
      app.db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM incident_reports
         WHERE deleted_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())`,
      ),
    ]);

    const latestImport = await app.db.query(
      `SELECT MAX(imported_at) AS latest FROM places`,
    );

    return {
      totalPlaces: Number(places.rows[0]?.count ?? 0),
      pendingReports: Number(reports.rows[0]?.count ?? 0),
      failedIngestionJobs: Number(jobs.rows[0]?.count ?? 0),
      activeIncidents: Number(incidents.rows[0]?.count ?? 0),
      latestPlaceImportAt: latestImport.rows[0]?.latest
        ? (latestImport.rows[0].latest as Date).toISOString()
        : null,
      coverage: "Connecticut development seed + global basemap (provider-dependent)",
      geocoding: app.geocoder.configured ? app.geocoder.name : "unconfigured",
      routing: app.router.configured ? app.router.name : "unconfigured",
    };
  });

  app.get("/api/v1/admin/ingestion-jobs", async (request) => {
    requireRoles(request, ["administrator"]);
    const result = await app.db.query(
      `SELECT id, job_type, status, region, started_at, finished_at,
              records_added, records_updated, records_removed, records_conflicted,
              error_message, created_at
       FROM ingestion_jobs
       ORDER BY created_at DESC
       LIMIT 50`,
    );
    return { jobs: result.rows };
  });

  app.get("/api/v1/admin/reports", async (request) => {
    requireRoles(request, ["moderator", "administrator"]);
    const result = await app.db.query(
      `SELECT id, tracking_id, category, status, created_at, updated_at,
              automated_recommendation,
              ST_X(geom::geometry) AS lng, ST_Y(geom::geometry) AS lat
       FROM correction_reports
       WHERE status IN ('submitted', 'under_review', 'more_info_needed', 'approved')
       ORDER BY created_at ASC
       LIMIT 100`,
    );
    return {
      reports: result.rows.map((r) => ({
        id: r.id,
        trackingId: r.tracking_id,
        category: r.category,
        status: r.status,
        coordinates: { lng: r.lng, lat: r.lat },
        automatedRecommendation: r.automated_recommendation,
        createdAt: (r.created_at as Date).toISOString(),
        updatedAt: (r.updated_at as Date).toISOString(),
      })),
    };
  });
}
