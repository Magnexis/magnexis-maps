/** Resolve the server-only TomTom API key (never prefer NEXT_PUBLIC for server work). */
export function readTomTomApiKey(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.TOMTOM_API_KEY ||
    env.TOMTOM_KEY ||
    // Legacy / traffic-only public key — last resort for local demos
    env.NEXT_PUBLIC_TOMTOM_KEY ||
    ""
  ).trim();
}

export function tomtomKeyConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return readTomTomApiKey(env).length > 0;
}
