/**
 * Browser-facing API origin.
 *
 * Netlify serves the Maps API from the same public origin. Falling back to a
 * relative URL in a production web build keeps the web client functional when
 * a deploy is missing the optional public API-origin variable, while native
 * exports remain protected by their production build-time URL validation.
 */
export function resolveApiBase(
  configuredOrigin = process.env.NEXT_PUBLIC_API_URL,
  nodeEnv = process.env.NODE_ENV,
): string {
  const configured = configuredOrigin?.trim();
  if (configured) return configured.replace(/\/$/, "");

  return nodeEnv === "production" ? "" : "http://localhost:4000";
}
