import { createPool } from "@magnexis/database";
import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";

async function main() {
  const config = loadConfig();
  const pool = createPool(config.databaseUrl);

  try {
    await pool.query("SELECT 1");
  } catch (error) {
    console.error(
      "\n[Magnexis API] Database connection failed.\n" +
        "Start infrastructure with: pnpm docker:up\n" +
        "Then run: pnpm db:migrate && pnpm db:seed\n" +
        "Check the server's DATABASE_URL configuration.\n",
    );
    process.exit(1);
  }

  const app = await buildApp({ config, pool });

  try {
    await app.listen({ host: config.host, port: config.port });
    app.log.info(
      `Magnexis Maps API listening on http://${config.host}:${config.port}`,
    );
    app.log.info(`OpenAPI docs at http://localhost:${config.port}/docs`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

main();
