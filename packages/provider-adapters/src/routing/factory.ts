import type { RoutingProvider } from "./types.js";
import { NoneRoutingProvider } from "./none.js";
import { ValhallaRoutingProvider } from "./valhalla.js";
import { OsrmRoutingProvider } from "./osrm.js";
import { TomTomRoutingProvider } from "./tomtom.js";
import { readTomTomApiKey } from "../tomtom-key.js";

/** Public OSRM demo — fine for local/dev; self-host for production. */
const DEFAULT_OSRM_URL = "https://router.project-osrm.org";

export function createRoutingProvider(
  env: NodeJS.ProcessEnv = process.env,
): RoutingProvider {
  const provider = (env.ROUTING_PROVIDER ?? "none").toLowerCase().trim();

  if (provider === "none" || provider === "") {
    return new NoneRoutingProvider();
  }

  if (provider === "tomtom") {
    const key = readTomTomApiKey(env);
    if (!key) {
      console.warn(
        "[routing] ROUTING_PROVIDER=tomtom but TOMTOM_API_KEY is missing; falling back to none.",
      );
      return new NoneRoutingProvider();
    }
    return new TomTomRoutingProvider(key);
  }

  if (provider === "osrm") {
    const url = (env.OSRM_URL ?? DEFAULT_OSRM_URL).trim();
    return new OsrmRoutingProvider(url);
  }

  if (provider === "auto") {
    const tomtomKey = readTomTomApiKey(env);
    if (tomtomKey) return new TomTomRoutingProvider(tomtomKey);
    const url = (env.OSRM_URL ?? DEFAULT_OSRM_URL).trim();
    return new OsrmRoutingProvider(url);
  }

  if (provider === "valhalla") {
    const url = env.VALHALLA_URL;
    if (!url) {
      console.warn(
        "[routing] ROUTING_PROVIDER=valhalla but VALHALLA_URL is missing; falling back to none.",
      );
      return new NoneRoutingProvider();
    }
    return new ValhallaRoutingProvider(url);
  }

  console.warn(`[routing] Unknown provider '${provider}'; using none.`);
  return new NoneRoutingProvider();
}
