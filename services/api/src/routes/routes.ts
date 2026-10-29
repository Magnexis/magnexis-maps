import type { FastifyInstance } from "fastify";
import {
  MagnexisError,
  ProviderUnavailableError,
  RouteRequestSchema,
} from "@magnexis/shared";

export async function registerRouteRoutes(app: FastifyInstance) {
  app.post("/api/v1/routes", async (request) => {
    const body = RouteRequestSchema.parse(request.body);

    if (!app.router.configured) {
      throw new ProviderUnavailableError(
        "routing",
        "ROUTING_PROVIDER is not configured. Set ROUTING_PROVIDER=tomtom (TOMTOM_API_KEY), osrm, or valhalla. Fake routes are never returned.",
      );
    }

    try {
      const routes = await app.router.route(body);
      const trafficAware = routes.some((r) => r.trafficAware);
      return {
        routes,
        trafficAware,
        notice: trafficAware
          ? "Routes include live traffic from the configured provider (e.g. TomTom)."
          : "Routes are geometry/ETA estimates without live traffic congestion.",
      };
    } catch (error) {
      if (error instanceof MagnexisError) throw error;
      throw new ProviderUnavailableError("routing", String(error));
    }
  });
}
