import type { FastifyInstance } from "fastify";
import { customAlphabet } from "nanoid";
import {
  CreateReportSchema,
  ModerationReviewSchema,
  NotFoundError,
  ReportConfirmationSchema,
  ValidationError,
  type ReportStatus,
} from "@magnexis/shared";
import { requireAuth, requireRoles } from "../plugins/auth.js";
import { evaluateReportHeuristics } from "../services/report-heuristics.js";

const trackingId = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 10);

type ReportRow = {
  id: string;
  tracking_id: string;
  category: string;
  description: string;
  lng: number;
  lat: number;
  place_id: string | null;
  proposed_changes: Record<string, unknown> | null;
  status: ReportStatus;
  created_at: Date;
  updated_at: Date;
  submitter_id: string | null;
};

function mapReport(row: ReportRow) {
  return {
    id: row.id,
    trackingId: row.tracking_id,
    category: row.category,
    description: row.description,
    coordinates: { lng: row.lng, lat: row.lat },
    placeId: row.place_id,
    proposedChanges: row.proposed_changes,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    submitterId: row.submitter_id,
  };
}

export async function registerReportRoutes(app: FastifyInstance) {
  app.post("/api/v1/reports", async (request, reply) => {
    const body = CreateReportSchema.parse(request.body);
    const user = request.user;

    if (!user && !body.guestEmail) {
      throw new ValidationError(
        "Authentication required, or provide guestEmail for a rate-limited guest report.",
      );
    }

    if (!user && body.guestEmail) {
      const recent = await app.db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM correction_reports
         WHERE guest_email = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
        [body.guestEmail],
      );
      if (Number(recent.rows[0]?.count ?? 0) >= app.config.guestReportRateLimitMax) {
        throw new ValidationError(
          "Guest report rate limit exceeded. Sign in or try again later.",
        );
      }
    }

    const recommendation = evaluateReportHeuristics(body);

    // Duplicate candidate check (same category near same point within 24h)
    const dupes = await app.db.query(
      `SELECT id FROM correction_reports
       WHERE category = $1
         AND created_at > NOW() - INTERVAL '24 hours'
         AND ST_DWithin(
           geom::geography,
           ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
           50
         )
       LIMIT 1`,
      [body.category, body.coordinates.lng, body.coordinates.lat],
    );
    if (dupes.rowCount && dupes.rowCount > 0) {
      recommendation.flags.push("possible_duplicate");
      recommendation.priority = "low";
    }

    const tid = `MX-${trackingId()}`;
    const result = await app.db.query<ReportRow>(
      `INSERT INTO correction_reports (
         tracking_id, category, description, geom, place_id, proposed_changes,
         status, submitter_id, guest_email, automated_recommendation
       ) VALUES (
         $1, $2, $3,
         ST_SetSRID(ST_MakePoint($4, $5), 4326),
         $6, $7::jsonb, 'submitted', $8, $9, $10::jsonb
       )
       RETURNING
         id, tracking_id, category, description,
         ST_X(geom::geometry) AS lng, ST_Y(geom::geometry) AS lat,
         place_id, proposed_changes, status, created_at, updated_at, submitter_id`,
      [
        tid,
        body.category,
        body.description,
        body.coordinates.lng,
        body.coordinates.lat,
        body.placeId ?? null,
        JSON.stringify(body.proposedChanges ?? null),
        user?.id ?? null,
        body.guestEmail ?? null,
        JSON.stringify(recommendation),
      ],
    );

    const row = result.rows[0]!;
    await app.db.query(
      `INSERT INTO report_status_history (report_id, from_status, to_status, actor_id, reason)
       VALUES ($1, NULL, 'submitted', $2, 'Initial submission')`,
      [row.id, user?.id ?? null],
    );

    return reply.status(201).send({
      report: mapReport(row),
      automatedRecommendation: recommendation,
      notice:
        "Reports enter moderation and are never auto-published to the canonical map.",
    });
  });

  app.get("/api/v1/reports", async (request) => {
    const user = request.user;
    let result;
    if (user && (user.roles.includes("moderator") || user.roles.includes("administrator"))) {
      result = await app.db.query<ReportRow>(
        `SELECT id, tracking_id, category, description,
                ST_X(geom::geometry) AS lng, ST_Y(geom::geometry) AS lat,
                place_id, proposed_changes, status, created_at, updated_at, submitter_id
         FROM correction_reports
         ORDER BY created_at DESC
         LIMIT 100`,
      );
    } else if (user) {
      result = await app.db.query<ReportRow>(
        `SELECT id, tracking_id, category, description,
                ST_X(geom::geometry) AS lng, ST_Y(geom::geometry) AS lat,
                place_id, proposed_changes, status, created_at, updated_at, submitter_id
         FROM correction_reports
         WHERE submitter_id = $1
         ORDER BY created_at DESC
         LIMIT 100`,
        [user.id],
      );
    } else {
      // Public: limited list of non-sensitive statuses, approximate only
      result = await app.db.query<ReportRow>(
        `SELECT id, tracking_id, category, description,
                ST_X(geom::geometry) AS lng, ST_Y(geom::geometry) AS lat,
                place_id, proposed_changes, status, created_at, updated_at, submitter_id
         FROM correction_reports
         WHERE status IN ('submitted', 'under_review', 'approved', 'applied')
         ORDER BY created_at DESC
         LIMIT 50`,
      );
    }

    return {
      reports: result.rows.map((row) => {
        const mapped = mapReport(row);
        // Redact precise submitter identity from public responses
        if (!user || (!user.roles.includes("moderator") && !user.roles.includes("administrator") && user.id !== row.submitter_id)) {
          return { ...mapped, submitterId: null };
        }
        return mapped;
      }),
    };
  });

  app.get<{ Params: { id: string } }>("/api/v1/reports/:id", async (request) => {
    const result = await app.db.query<ReportRow>(
      `SELECT id, tracking_id, category, description,
              ST_X(geom::geometry) AS lng, ST_Y(geom::geometry) AS lat,
              place_id, proposed_changes, status, created_at, updated_at, submitter_id
       FROM correction_reports
       WHERE id = $1 OR tracking_id = $1`,
      [request.params.id],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError("Report", request.params.id);

    const history = await app.db.query(
      `SELECT from_status, to_status, reason, created_at
       FROM report_status_history
       WHERE report_id = $1
       ORDER BY created_at ASC`,
      [row.id],
    );

    return {
      report: { ...mapReport(row), submitterId: null },
      history: history.rows.map((h) => ({
        fromStatus: h.from_status,
        toStatus: h.to_status,
        reason: h.reason,
        createdAt: (h.created_at as Date).toISOString(),
      })),
    };
  });

  app.post<{ Params: { id: string } }>(
    "/api/v1/reports/:id/confirmations",
    async (request, reply) => {
      const user = requireAuth(request);
      const body = ReportConfirmationSchema.parse(request.body);

      const report = await app.db.query(`SELECT id FROM correction_reports WHERE id = $1`, [
        request.params.id,
      ]);
      if (!report.rowCount) throw new NotFoundError("Report", request.params.id);

      await app.db.query(
        `INSERT INTO report_votes (report_id, user_id, stance, observation)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (report_id, user_id)
         DO UPDATE SET stance = EXCLUDED.stance, observation = EXCLUDED.observation`,
        [request.params.id, user.id, body.stance, body.observation ?? null],
      );

      return reply.status(201).send({
        ok: true,
        notice:
          "Community confirmations inform review priority but are not definitive proof.",
      });
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/v1/admin/reports/:id/review",
    async (request) => {
      const moderator = requireRoles(request, ["moderator", "administrator"]);
      const body = ModerationReviewSchema.parse(request.body);

      const existing = await app.db.query<ReportRow>(
        `SELECT id, tracking_id, category, description,
                ST_X(geom::geometry) AS lng, ST_Y(geom::geometry) AS lat,
                place_id, proposed_changes, status, created_at, updated_at, submitter_id
         FROM correction_reports WHERE id = $1`,
        [request.params.id],
      );
      const report = existing.rows[0];
      if (!report) throw new NotFoundError("Report", request.params.id);

      const statusMap: Record<string, ReportStatus> = {
        approve: "approved",
        reject: "rejected",
        request_more_info: "more_info_needed",
        apply: "applied",
        revert: "reverted",
      };
      const newStatus = statusMap[body.action];
      if (!newStatus) throw new ValidationError("Unknown moderation action");

      // Apply approved correction to place only on explicit "apply"
      if (body.action === "apply") {
        if (report.status !== "approved" && report.status !== "applied") {
          throw new ValidationError(
            "Only approved reports can be applied to the canonical map.",
          );
        }
        if (report.place_id && report.proposed_changes) {
          await applyPlaceCorrection(app, report.place_id, report.proposed_changes, moderator.id);
        }
      }

      if (body.action === "revert" && report.place_id) {
        await revertLatestPlaceVersion(app, report.place_id, moderator.id);
      }

      await app.db.query(
        `UPDATE correction_reports
         SET status = $2, updated_at = NOW()
         WHERE id = $1`,
        [report.id, newStatus],
      );

      await app.db.query(
        `INSERT INTO moderation_actions (
           report_id, moderator_id, action, notes, previous_status, new_status
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          report.id,
          moderator.id,
          body.action,
          body.notes ?? null,
          report.status,
          newStatus,
        ],
      );

      await app.db.query(
        `INSERT INTO report_status_history (report_id, from_status, to_status, actor_id, reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [report.id, report.status, newStatus, moderator.id, body.notes ?? body.action],
      );

      const updated = await app.db.query<ReportRow>(
        `SELECT id, tracking_id, category, description,
                ST_X(geom::geometry) AS lng, ST_Y(geom::geometry) AS lat,
                place_id, proposed_changes, status, created_at, updated_at, submitter_id
         FROM correction_reports WHERE id = $1`,
        [report.id],
      );

      return {
        report: mapReport(updated.rows[0]!),
        notice:
          body.action === "apply"
            ? "Correction applied via versioned place update."
            : "Moderation action recorded.",
      };
    },
  );
}

async function applyPlaceCorrection(
  app: FastifyInstance,
  placeId: string,
  changes: Record<string, unknown>,
  actorId: string,
) {
  const current = await app.db.query(
    `SELECT * FROM places WHERE id = $1`,
    [placeId],
  );
  const place = current.rows[0];
  if (!place) throw new NotFoundError("Place", placeId);

  const versionCount = await app.db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM place_versions WHERE place_id = $1`,
    [placeId],
  );
  const nextVersion = Number(versionCount.rows[0]?.count ?? 0) + 1;

  await app.db.query(
    `INSERT INTO place_versions (place_id, version_number, snapshot, change_source, changed_by)
     VALUES ($1, $2, $3::jsonb, 'community_correction', $4)`,
    [placeId, nextVersion, JSON.stringify(place), actorId],
  );

  const allowed = ["name", "address", "description", "city", "state", "postal_code"] as const;
  const sets: string[] = [];
  const params: unknown[] = [placeId];
  for (const key of allowed) {
    if (key in changes) {
      params.push(changes[key]);
      sets.push(`${key} = $${params.length}`);
    }
  }
  // Coordinate updates if provided as { lng, lat }
  if (
    changes.lng != null &&
    changes.lat != null &&
    typeof changes.lng === "number" &&
    typeof changes.lat === "number"
  ) {
    params.push(changes.lng, changes.lat);
    sets.push(
      `geom = ST_SetSRID(ST_MakePoint($${params.length - 1}, $${params.length}), 4326)`,
    );
  }

  if (sets.length === 0) {
    throw new ValidationError("No applicable proposed changes to apply.");
  }

  sets.push("updated_at = NOW()");
  // Do NOT set last_verified_at unless an actual verification workflow completed
  await app.db.query(
    `UPDATE places SET ${sets.join(", ")} WHERE id = $1`,
    params,
  );

  await app.db.query(
    `INSERT INTO audit_logs (actor_id, action, resource_type, resource_id, metadata)
     VALUES ($1, 'apply_correction', 'place', $2, $3::jsonb)`,
    [actorId, placeId, JSON.stringify({ changes })],
  );
}

async function revertLatestPlaceVersion(
  app: FastifyInstance,
  placeId: string,
  actorId: string,
) {
  const version = await app.db.query<{ snapshot: Record<string, unknown>; version_number: number }>(
    `SELECT snapshot, version_number FROM place_versions
     WHERE place_id = $1
     ORDER BY version_number DESC
     LIMIT 1`,
    [placeId],
  );
  const snap = version.rows[0]?.snapshot;
  if (!snap) {
    throw new ValidationError("No place version available to revert.");
  }

  await app.db.query(
    `UPDATE places SET
       name = $2,
       address = $3,
       description = $4,
       city = $5,
       state = $6,
       postal_code = $7,
       updated_at = NOW()
     WHERE id = $1`,
    [
      placeId,
      snap.name,
      snap.address,
      snap.description,
      snap.city,
      snap.state,
      snap.postal_code,
    ],
  );

  await app.db.query(
    `INSERT INTO audit_logs (actor_id, action, resource_type, resource_id, metadata)
     VALUES ($1, 'revert_correction', 'place', $2, $3::jsonb)`,
    [
      actorId,
      placeId,
      JSON.stringify({ restoredVersion: version.rows[0]?.version_number }),
    ],
  );
}
