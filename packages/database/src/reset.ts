import { createPool } from "./pool.js";

async function reset() {
  const confirm = process.env.CONFIRM_DB_RESET;
  if (confirm !== "yes") {
    console.error(
      'Refusing to reset. Set CONFIRM_DB_RESET=yes to drop and recreate public schema.',
    );
    process.exitCode = 1;
    return;
  }

  const pool = createPool();
  const client = await pool.connect();
  try {
    await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await client.query("CREATE EXTENSION IF NOT EXISTS postgis;");
    console.log("Database schema reset. Run migrate + seed next.");
  } finally {
    client.release();
    await pool.end();
  }
}

reset();
