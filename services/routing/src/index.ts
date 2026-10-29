/**
 * Dedicated routing service boundary.
 * Production path currently uses @magnexis/provider-adapters from the API.
 * This package is reserved for a standalone Valhalla-facing microservice.
 */
export { createRoutingProvider } from "@magnexis/provider-adapters";
