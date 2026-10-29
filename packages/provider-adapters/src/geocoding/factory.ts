import type { GeocodingProvider } from "./types.js";
import { NoneGeocodingProvider } from "./none.js";
import { HttpGeocodingProvider } from "./http.js";
import { MapTilerGeocodingProvider } from "./maptiler.js";
import { TomTomGeocodingProvider } from "./tomtom.js";
import { GoogleGeocodingProvider } from "./google.js";
import { readTomTomApiKey } from "../tomtom-key.js";
import { readGoogleMapsApiKey } from "../google-key.js";

function readMaptilerKey(env: NodeJS.ProcessEnv): string {
  return (
    env.MAPTILER_KEY ||
    env.GEOCODING_API_KEY ||
    env.NEXT_PUBLIC_MAPTILER_KEY ||
    ""
  ).trim();
}

export function createGeocodingProvider(
  env: NodeJS.ProcessEnv = process.env,
): GeocodingProvider {
  const provider = (env.GEOCODING_PROVIDER ?? "none").toLowerCase().trim();

  if (provider === "none" || provider === "") {
    return new NoneGeocodingProvider();
  }

  if (provider === "tomtom") {
    const key = readTomTomApiKey(env);
    if (!key) {
      console.warn(
        "[geocoding] Provider 'tomtom' selected but TOMTOM_API_KEY is missing; falling back to none.",
      );
      return new NoneGeocodingProvider();
    }
    return new TomTomGeocodingProvider(key);
  }

  if (provider === "maptiler") {
    const key = readMaptilerKey(env);
    if (!key) {
      console.warn(
        "[geocoding] Provider 'maptiler' selected but MAPTILER_KEY / GEOCODING_API_KEY is missing; falling back to none.",
      );
      return new NoneGeocodingProvider();
    }
    return new MapTilerGeocodingProvider(key);
  }

  if (provider === "google") {
    const key = readGoogleMapsApiKey(env);
    if (!key) {
      console.warn(
        "[geocoding] Provider 'google' selected but GOOGLE_MAPS_API_KEY is missing; falling back to none.",
      );
      return new NoneGeocodingProvider();
    }
    return new GoogleGeocodingProvider(key);
  }

  if (provider === "auto") {
    const tomtom = readTomTomApiKey(env);
    if (tomtom) return new TomTomGeocodingProvider(tomtom);
    const maptiler = readMaptilerKey(env);
    if (maptiler) return new MapTilerGeocodingProvider(maptiler);
    const google = readGoogleMapsApiKey(env);
    if (google) return new GoogleGeocodingProvider(google);
    console.warn(
      "[geocoding] Provider 'auto' but no TOMTOM_API_KEY, MAPTILER_KEY, or GOOGLE_MAPS_API_KEY; falling back to none.",
    );
    return new NoneGeocodingProvider();
  }

  const baseUrl = env.GEOCODING_API_URL;
  const apiKey = env.GEOCODING_API_KEY;

  if (!baseUrl) {
    console.warn(
      `[geocoding] Provider '${provider}' selected but GEOCODING_API_URL is missing; falling back to none.`,
    );
    return new NoneGeocodingProvider();
  }

  return new HttpGeocodingProvider({
    name: provider,
    baseUrl,
    apiKey,
  });
}
