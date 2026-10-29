import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import bcrypt from "bcryptjs";
import pg from "pg";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { createSessionToken } from "../plugins/auth.js";
import type { AppConfig } from "../config.js";

const databaseUrl = process.env.MAGNEXIS_ACCOUNT_TEST_DATABASE_URL;
const schema = `magnexis_delete_test_${randomUUID().replaceAll("-", "")}`;
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const place = "33333333-3333-4333-8333-333333333333";
const report = "44444444-4444-4444-8444-444444444444";
const otherReport = "55555555-5555-4555-8555-555555555555";
const password = "Synthetic-password-123";
const secret = "isolated-account-deletion-test-secret";
const payload = { password, confirmation: "DELETE" };
const config: AppConfig = {
  nodeEnv: "test",
  host: "127.0.0.1",
  port: 4000,
  corsOrigin: "http://localhost:3000",
  databaseUrl: "unused",
  redisUrl: "unused",
  jwtSecret: secret,
  rateLimitMax: 120,
  rateLimitWindowMs: 60_000,
  guestReportRateLimitMax: 5,
  logLevel: "silent",
};

describe.skipIf(!databaseUrl)(
  "account deletion against isolated PostgreSQL schema",
  () => {
    let admin: pg.Pool;
    let pool: pg.Pool;
    let app: FastifyInstance;
    let hash: string;
    const headers = () => ({
      authorization: `Bearer ${createSessionToken({ id: alice, email: "alice@example.test" }, secret)}`,
    });
    const count = async (table: string, where = "") =>
      Number(
        (await pool.query(`SELECT count(*) FROM ${table} ${where}`)).rows[0]
          .count,
      );

    beforeAll(async () => {
      const url = new URL(databaseUrl!);
      if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
        throw new Error("Integration tests require a local database.");
      if (!/^magnexis_delete_test_[a-f0-9]+$/.test(schema))
        throw new Error("Unsafe test schema.");
      admin = new pg.Pool({ connectionString: databaseUrl });
      await admin.query(`CREATE SCHEMA "${schema}"`);
      pool = new pg.Pool({
        connectionString: databaseUrl,
        options: `-c search_path=${schema},public`,
      });
      const migrations = new URL(
        "../../../../infrastructure/migrations/",
        import.meta.url,
      );
      for (const file of (await readdir(migrations))
        .filter((name) => name.endsWith(".sql"))
        .sort()) {
        await pool.query(await readFile(new URL(file, migrations), "utf8"));
      }
      hash = await bcrypt.hash(password, 4);
    }, 30_000);

    beforeEach(async () => {
      await pool.query(
        `TRUNCATE TABLE "${schema}".users, "${schema}".places CASCADE`,
      );
      await pool.query(
        `INSERT INTO users (id,email,password_hash,display_name) VALUES ($1,'alice@example.test',$3,'Alice'),($2,'bob@example.test',$3,'Bob')`,
        [alice, bob, hash],
      );
      await pool.query(
        `INSERT INTO user_roles (user_id,role) VALUES ($1,'user'),($2,'user')`,
        [alice, bob],
      );
      await pool.query(
        `INSERT INTO user_preferences (user_id) VALUES ($1),($2)`,
        [alice, bob],
      );
      await pool.query(
        `INSERT INTO sessions (user_id,token_hash,expires_at) VALUES ($1,'alice-session',NOW()+INTERVAL '1 day'),($2,'bob-session',NOW()+INTERVAL '1 day')`,
        [alice, bob],
      );
      await pool.query(
        `INSERT INTO places (id,name,category,geom,source_name) VALUES ($1,'Public park','park',ST_SetSRID(ST_MakePoint(-72,41),4326),'test')`,
        [place],
      );
      await pool.query(
        `INSERT INTO saved_places (user_id,label,geom) VALUES ($1,'Private home',ST_SetSRID(ST_MakePoint(-72,41),4326)),($2,'Bob save',ST_SetSRID(ST_MakePoint(-72,41),4326))`,
        [alice, bob],
      );
      await pool.query(
        `INSERT INTO correction_reports (id,tracking_id,category,description,geom,submitter_id) VALUES ($1,'test-alice','other','Alice private report',ST_SetSRID(ST_MakePoint(-72,41),4326),$3),($2,'test-bob','other','Bob report',ST_SetSRID(ST_MakePoint(-72,41),4326),$4)`,
        [report, otherReport, alice, bob],
      );
      await pool.query(
        `INSERT INTO correction_proposals (report_id,field_name,proposed_value) VALUES ($1,'name','"Proposed name"')`,
        [report],
      );
      await pool.query(
        `INSERT INTO report_evidence (report_id,storage_key,mime_type,byte_size,uploaded_by) VALUES ($1,'synthetic/alice','image/png',1,$3),($2,'synthetic/alice-on-bob','image/png',1,$3),($2,'synthetic/bob','image/png',1,$4)`,
        [report, otherReport, alice, bob],
      );
      await pool.query(
        `INSERT INTO report_votes (report_id,user_id,stance,observation) VALUES ($1,$2,'confirm','Private observation')`,
        [otherReport, alice],
      );
      await pool.query(
        `INSERT INTO moderation_actions (report_id,moderator_id,action,notes,previous_status,new_status) VALUES ($1,$2,'review','Private reviewer note','submitted','under_review')`,
        [otherReport, alice],
      );
      await pool.query(
        `INSERT INTO report_status_history (report_id,to_status,actor_id,reason) VALUES ($1,'under_review',$2,'Private reviewer reason')`,
        [otherReport, alice],
      );
      await pool.query(
        `INSERT INTO place_versions (place_id,version_number,snapshot,change_source,changed_by) VALUES ($1,1,'{"name":"Public park"}','community',$2)`,
        [place, alice],
      );
      await pool.query(
        `INSERT INTO business_claims (place_id,claimant_id,reviewed_by,evidence) VALUES ($1,$2,$3,'{"private":"claim"}'),($1,$3,$2,'{}')`,
        [place, alice, bob],
      );
      await pool.query(
        `INSERT INTO business_updates (place_id,claimant_id,reviewed_by,field_changes) VALUES ($1,$2,$3,'{}'),($1,$3,$2,'{}')`,
        [place, alice, bob],
      );
      await pool.query(
        `INSERT INTO incident_reports (category,description,geom,reporter_id) VALUES ('other','Private incident',ST_SetSRID(ST_MakePoint(-72,41),4326),$1)`,
        [alice],
      );
      await pool.query(
        `INSERT INTO audit_logs (actor_id,action,resource_type,resource_id,metadata) VALUES ($1::uuid,'test','account',$1::text,'{"email":"alice@example.test"}'),($2,'test','report',$3::text,'{"private":"report details"}'),($2,'test','place',$4::text,'{"public":true}')`,
        [alice, bob, report, place],
      );
      app = await buildApp({ config, pool });
    });
    afterEach(async () => {
      await app?.close();
    });
    afterAll(async () => {
      await pool?.end();
      if (admin && /^magnexis_delete_test_[a-f0-9]+$/.test(schema))
        await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin?.end();
    });

    it("authenticates an existing session on the shared API routes", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/me",
        headers: headers(),
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().user.id).toBe(alice);
    });
    it("deletes the account and private records while preserving anonymous map history and other users", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/me",
        headers: headers(),
        payload,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ deleted: true });
      expect(await count("users", `WHERE id='${alice}'`)).toBe(0);
      expect(await count("users", `WHERE id='${bob}'`)).toBe(1);
      for (const table of [
        "sessions",
        "saved_places",
        "user_preferences",
        "user_roles",
      ]) {
        expect(await count(table, `WHERE user_id='${alice}'`)).toBe(0);
        expect(await count(table, `WHERE user_id='${bob}'`)).toBe(1);
      }
      expect(await count("correction_reports", `WHERE id='${report}'`)).toBe(0);
      expect(
        await count("correction_reports", `WHERE id='${otherReport}'`),
      ).toBe(1);
      expect(await count("correction_proposals")).toBe(0);
      expect(await count("report_evidence")).toBe(1);
      expect(await count("report_votes")).toBe(0);
      expect(await count("incident_reports")).toBe(0);
      expect(await count("business_claims")).toBe(1);
      expect(await count("business_updates")).toBe(1);
      expect(
        (await pool.query("SELECT changed_by,snapshot FROM place_versions"))
          .rows[0],
      ).toEqual({ changed_by: null, snapshot: { name: "Public park" } });
      expect(
        (await pool.query("SELECT moderator_id,notes FROM moderation_actions"))
          .rows[0],
      ).toEqual({ moderator_id: null, notes: null });
      expect(
        (await pool.query("SELECT actor_id,reason FROM report_status_history"))
          .rows[0],
      ).toEqual({ actor_id: null, reason: null });
      expect(
        (await pool.query("SELECT reviewed_by FROM business_claims")).rows[0]
          .reviewed_by,
      ).toBeNull();
      expect(
        (
          await pool.query(
            "SELECT metadata FROM audit_logs WHERE resource_type='place'",
          )
        ).rows[0].metadata,
      ).toEqual({ public: true });
      expect(
        (
          await pool.query(
            "SELECT metadata FROM audit_logs WHERE resource_type!='place'",
          )
        ).rows.every((row) => JSON.stringify(row.metadata) === "{}"),
      ).toBe(true);
    });
    it("rejects missing authentication and incorrect passwords without changing data", async () => {
      expect(
        (await app.inject({ method: "DELETE", url: "/api/v1/me", payload }))
          .statusCode,
      ).toBe(401);
      expect(
        (
          await app.inject({
            method: "DELETE",
            url: "/api/v1/me",
            headers: headers(),
            payload: { ...payload, password: "incorrect" },
          })
        ).statusCode,
      ).toBe(403);
      expect(await count("users")).toBe(2);
      expect(await count("saved_places")).toBe(2);
    });
    it("rejects invalid confirmation and attempts to supply a different account id", async () => {
      for (const body of [
        { password, confirmation: "delete" },
        { password: "", confirmation: "DELETE" },
        { ...payload, userId: bob },
      ]) {
        expect(
          (
            await app.inject({
              method: "DELETE",
              url: "/api/v1/me",
              headers: headers(),
              payload: body,
            })
          ).statusCode,
        ).toBe(400);
      }
      expect(await count("users")).toBe(2);
    });
    it("invalidates issued tokens and prevents login after deletion", async () => {
      const authorization = headers();
      expect(
        (
          await app.inject({
            method: "DELETE",
            url: "/api/v1/me",
            headers: authorization,
            payload,
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await app.inject({
            method: "GET",
            url: "/api/v1/me",
            headers: authorization,
          })
        ).statusCode,
      ).toBe(401);
      expect(
        (
          await app.inject({
            method: "DELETE",
            url: "/api/v1/me",
            headers: authorization,
            payload,
          })
        ).statusCode,
      ).toBe(401);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/auth/login",
            payload: { email: "alice@example.test", password },
          })
        ).statusCode,
      ).toBe(401);
    });
    it("allows the shared web client to preflight DELETE from an approved origin", async () => {
      const response = await app.inject({
        method: "OPTIONS",
        url: "/api/v1/me",
        headers: {
          origin: "http://localhost:3000",
          "access-control-request-method": "DELETE",
          "access-control-request-headers": "authorization,content-type",
        },
      });
      expect(response.statusCode).toBe(204);
      expect(response.headers["access-control-allow-methods"]).toContain(
        "DELETE",
      );
      expect(response.headers["access-control-allow-origin"]).toBe(
        "http://localhost:3000",
      );
    });
    it("limits repeated password guesses without deleting any data", async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        expect(
          (
            await app.inject({
              method: "DELETE",
              url: "/api/v1/me",
              headers: headers(),
              payload: { ...payload, password: "incorrect" },
            })
          ).statusCode,
        ).toBe(403);
      }
      expect(
        (
          await app.inject({
            method: "DELETE",
            url: "/api/v1/me",
            headers: headers(),
            payload,
          })
        ).statusCode,
      ).toBe(429);
      expect(await count("users")).toBe(2);
    });
    it("handles simultaneous requests without partial deletion or success for a second account", async () => {
      const results = await Promise.all(
        [1, 2].map(() =>
          app.inject({
            method: "DELETE",
            url: "/api/v1/me",
            headers: headers(),
            payload,
          }),
        ),
      );
      expect(results.map((result) => result.statusCode).sort()).toEqual([
        200, 401,
      ]);
      expect(await count("users")).toBe(1);
    });
    it("deletes an empty account without requiring saved places or contributions", async () => {
      const id = randomUUID();
      await pool.query(
        "INSERT INTO users (id,email,password_hash,display_name) VALUES ($1,'empty@example.test',$2,'Empty account')",
        [id, hash],
      );
      const authorization = {
        authorization: `Bearer ${createSessionToken({ id, email: "empty@example.test" }, secret)}`,
      };
      expect(
        (
          await app.inject({
            method: "DELETE",
            url: "/api/v1/me",
            headers: authorization,
            payload,
          })
        ).statusCode,
      ).toBe(200);
      expect(await count("users")).toBe(2);
    });
    it("rolls back every removal when the database rejects the final delete", async () => {
      await pool.query(
        `CREATE OR REPLACE FUNCTION block_test_delete() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'Synthetic deletion failure'; END; $$ LANGUAGE plpgsql`,
      );
      await pool.query(
        `CREATE TRIGGER block_test_delete BEFORE DELETE ON users FOR EACH ROW EXECUTE FUNCTION block_test_delete()`,
      );
      try {
        const response = await app.inject({
          method: "DELETE",
          url: "/api/v1/me",
          headers: headers(),
          payload,
        });
        expect(response.statusCode).toBe(503);
        expect(response.json().code).toBe("ACCOUNT_DELETION_UNAVAILABLE");
        expect(await count("users")).toBe(2);
        expect(await count("saved_places")).toBe(2);
        expect(await count("report_evidence")).toBe(3);
        expect(
          (await pool.query("SELECT changed_by FROM place_versions")).rows[0]
            .changed_by,
        ).toBe(alice);
        expect(
          (
            await app.inject({
              method: "GET",
              url: "/api/v1/me",
              headers: headers(),
            })
          ).statusCode,
        ).toBe(200);
      } finally {
        await pool.query("DROP TRIGGER block_test_delete ON users");
      }
    });
    it("returns a useful client error for malformed account input", async () => {
      const response = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: { email: "invalid" } });
      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe("VALIDATION_ERROR");
    });
    it("allows the email to be reused without reviving the deleted account's session", async () => {
      const oldHeaders = headers();
      expect(
        (
          await app.inject({
            method: "DELETE",
            url: "/api/v1/me",
            headers: oldHeaders,
            payload,
          })
        ).statusCode,
      ).toBe(200);
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          email: "alice@example.test",
          password,
          displayName: "New account",
        },
      });
      expect(response.statusCode).toBe(201);
      expect(response.json().user.id).not.toBe(alice);
      expect(
        (
          await app.inject({
            method: "GET",
            url: "/api/v1/me",
            headers: oldHeaders,
          })
        ).statusCode,
      ).toBe(401);
    });
  },
);
