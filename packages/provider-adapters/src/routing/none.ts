import { ProviderUnavailableError, type Route, type RouteRequest } from "@magnexis/shared";
import type { RoutingProvider } from "./types.js";

export class NoneRoutingProvider implements RoutingProvider {
  readonly name = "none";
  readonly configured = false;

  async route(_request: RouteRequest): Promise<Route[]> {
    throw new ProviderUnavailableError(
      "routing",
      "ROUTING_PROVIDER is not configured. Set VALHALLA_URL (or compatible) to enable real routes.",
    );
  }
}
