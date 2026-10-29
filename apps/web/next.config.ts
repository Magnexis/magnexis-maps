import type { NextConfig } from "next";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

/** Monorepo root — API + secrets live in root `.env`; Next only auto-loads `apps/web`. */
const monorepoRoot = path.join(__dirname, "../..");
loadEnvConfig(monorepoRoot);
loadEnvConfig(__dirname);

/**
 * When a server-only TomTom key exists at the repo root, enable the traffic tile
 * proxy flag for the browser (never expose the key itself).
 */
const tomtomKeyPresent = Boolean(
  (process.env.TOMTOM_API_KEY || process.env.TOMTOM_KEY || "").trim(),
);
const trafficProxyExplicit = (
  process.env.NEXT_PUBLIC_TOMTOM_TRAFFIC_PROXY ?? ""
).trim();
const trafficProxy =
  trafficProxyExplicit === "0" || trafficProxyExplicit.toLowerCase() === "false"
    ? "0"
    : trafficProxyExplicit || (tomtomKeyPresent ? "1" : "");

if (trafficProxy) {
  process.env.NEXT_PUBLIC_TOMTOM_TRAFFIC_PROXY = trafficProxy;
}

const nextConfig: NextConfig = {
  ...(process.env.MAGNEXIS_IPHONE_EXPORT === "1" || process.env.MAGNEXIS_WEB_EXPORT === "1"
    ? {
        output: "export" as const,
        distDir: process.env.MAGNEXIS_IPHONE_EXPORT === "1" ? ".next-iphone" : ".next-web",
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_TOMTOM_TRAFFIC_PROXY:
      process.env.NEXT_PUBLIC_TOMTOM_TRAFFIC_PROXY ?? "",
  },
  transpilePackages: [
    "@magnexis/shared",
    "@magnexis/api-client",
    "@magnexis/ui",
    "@magnexis/map-styles",
    "@magnexis/navigation",
    "mapillary-js",
  ],
};

export default nextConfig;
