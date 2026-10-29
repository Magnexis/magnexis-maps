"use client";

import { createApiClient } from "@magnexis/api-client";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function getApiClient() {
  return createApiClient({
    baseUrl: API_URL,
    getToken: () =>
      typeof window !== "undefined"
        ? window.localStorage.getItem("magnexis_token")
        : null,
  });
}

export { API_URL };
