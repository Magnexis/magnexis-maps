import type { FastifyInstance } from "fastify";
import { PRODUCT_VERSION } from "@magnexis/shared";

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get("/api/v1/health", async () => {
    let database = "ok";
    try {
      await app.db.query("SELECT 1");
    } catch {
      database = "error";
    }

    return {
      status: database === "ok" ? "ok" : "degraded",
      version: PRODUCT_VERSION,
      product: "Magnexis Maps",
      services: {
        database,
        geocoding: app.geocoder.configured ? app.geocoder.name : "unconfigured",
        routing: app.router.configured ? app.router.name : "unconfigured",
      },
      timestamp: new Date().toISOString(),
    };
  });
}
