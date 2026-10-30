"use client";

import { createApiClient } from "@magnexis/api-client";
import { resolveApiBase } from "./api-base";

export const API_URL = resolveApiBase();

export function getApiClient() {
  return createApiClient({
    baseUrl: API_URL,
    getToken: () =>
      typeof window !== "undefined"
        ? window.localStorage.getItem("magnexis_token")
        : null,
  });
}
