import type { FastifyInstance } from "fastify";

export async function registerMapStyleRoutes(app: FastifyInstance) {
  app.get("/api/v1/map-styles", async () => {
    return {
      styles: app.mapStyles,
      attribution:
        process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ??
        "© OpenStreetMap contributors | © Magnexis Maps",
    };
  });
}
