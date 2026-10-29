import type { Route, RouteRequest } from "@magnexis/shared";

export interface RoutingProvider {
  readonly name: string;
  readonly configured: boolean;
  /** Set trafficAware true only when live traffic was applied (e.g. TomTom). */
  route(request: RouteRequest): Promise<Route[]>;
}
