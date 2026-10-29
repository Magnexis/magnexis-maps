import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPool } from "./pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const pool = createPool();
  const migrationsDir = path.resolve(
    __dirname,
    "../../../infrastructure/migrations",
  );

  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    for (const file of files) {
      const id = file.replace(/\.sql$/i, "");
      const already = await client.query<{ id: string }>(
        `SELECT id FROM schema_migrations WHERE id = $1`,
        [id],
      );
      if (already.rows.length > 0) {
        console.log(`Skipping ${file} (already applied)`);
        continue;
      }

      const migrationPath = path.join(migrationsDir, file);
      console.log(`Applying migration: ${migrationPath}`);
      const sql = await readFile(migrationPath, "utf8");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
          [id],
        );
        await client.query("COMMIT");
        console.log(`Applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    console.log("Migrations complete.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
