import pg from "pg";

const { Pool } = pg;

export type DbPool = pg.Pool;

let pool: DbPool | null = null;

export function createPool(connectionString?: string): DbPool {
  const url =
    connectionString ??
    process.env.DATABASE_URL ??
    "postgresql://magnexis:magnexis@localhost:5433/magnexis_maps";

  const created = new Pool({
    connectionString: url,
    max: 20,
    idleTimeoutMillis: 30_000,
  });

  pool = created;
  return created;
}

export function getPool(): DbPool {
  if (!pool) {
    return createPool();
  }
  return pool;
}
