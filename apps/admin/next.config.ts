import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@magnexis/api-client", "@magnexis/ui", "@magnexis/shared"],
};

export default nextConfig;
