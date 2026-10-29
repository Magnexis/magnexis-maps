import type {
  CreateReport,
  CorrectionReport,
  CreateSavedPlace,
  DeleteAccount,
  Incident,
  Hotspot,
  Place,
  Route,
  RouteRequest,
  SearchResult,
  UserPublic,
} from "@magnexis/shared";

export type ApiClientOptions = {
  baseUrl: string;
  getToken?: () => string | null | undefined;
  fetchImpl?: typeof fetch;
};

export class MagnexisApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "MagnexisApiError";
  }
}

export function createApiClient(options: ApiClientOptions) {
  const fetchFn = options.fetchImpl ?? fetch;

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    if (!headers.has("Content-Type") && init?.body) {
      headers.set("Content-Type", "application/json");
    }
    const token = options.getToken?.();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetchFn(`${options.baseUrl}${path}`, {
      ...init,
      headers,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new MagnexisApiError(
        (payload as { error?: string }).error ?? response.statusText,
        response.status,
        (payload as { code?: string }).code,
        (payload as { details?: unknown }).details,
      );
    }
    return payload as T;
  }

  return {
    health: () =>
      request<{
        status: string;
        version: string;
        services: Record<string, string>;
      }>("/api/v1/health"),

    search: (params: {
      q: string;
      lng?: number;
      lat?: number;
      category?: string;
      limit?: number;
    }) => {
      const qs = new URLSearchParams();
      qs.set("q", params.q);
      if (params.lng != null) qs.set("lng", String(params.lng));
      if (params.lat != null) qs.set("lat", String(params.lat));
      if (params.category) qs.set("category", params.category);
      if (params.limit) qs.set("limit", String(params.limit));
      return request<{ results: SearchResult[] }>(`/api/v1/search?${qs}`);
    },

    getPlace: (id: string) => request<{ place: Place }>(`/api/v1/places/${id}`),

    nearbyPlaces: (params: {
      lng: number;
      lat: number;
      radiusMeters?: number;
      category?: string;
      limit?: number;
    }) => {
      const qs = new URLSearchParams({
        lng: String(params.lng),
        lat: String(params.lat),
      });
      if (params.radiusMeters)
        qs.set("radiusMeters", String(params.radiusMeters));
      if (params.category) qs.set("category", params.category);
      if (params.limit) qs.set("limit", String(params.limit));
      return request<{ places: Place[] }>(`/api/v1/places/nearby?${qs}`);
    },

    hotspots: (params: {
      lng: number;
      lat: number;
      radiusMeters?: number;
      limit?: number;
    }) => {
      const qs = new URLSearchParams({
        lng: String(params.lng),
        lat: String(params.lat),
      });
      if (params.radiusMeters) qs.set("radiusMeters", String(params.radiusMeters));
      if (params.limit) qs.set("limit", String(params.limit));
      return request<{
        hotspots: Hotspot[];
        basis: "public_place_density";
        notice: string;
      }>(`/api/v1/hotspots?${qs}`);
    },

    listPlaces: (params?: { q?: string; limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.q) qs.set("q", params.q);
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.offset) qs.set("offset", String(params.offset));
      const suffix = qs.toString() ? `?${qs}` : "";
      return request<{ places: Place[]; total: number }>(
        `/api/v1/places${suffix}`,
      );
    },

    createRoute: (body: RouteRequest) =>
      request<{ routes: Route[]; trafficAware: boolean }>("/api/v1/routes", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    createReport: (body: CreateReport) =>
      request<{ report: CorrectionReport }>("/api/v1/reports", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    getReport: (id: string) =>
      request<{ report: CorrectionReport }>(`/api/v1/reports/${id}`),

    listReports: () =>
      request<{ reports: CorrectionReport[] }>("/api/v1/reports"),

    listIncidents: () =>
      request<{ incidents: Incident[] }>("/api/v1/incidents"),

    register: (body: {
      email: string;
      password: string;
      displayName: string;
    }) =>
      request<{ user: UserPublic; token: string }>("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    login: (body: { email: string; password: string }) =>
      request<{ user: UserPublic; token: string }>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    googleAuthStatus: () =>
      request<{ configured: boolean; clientId: string | null }>(
        "/api/v1/auth/google/status",
      ),

    loginWithGoogle: (body: { idToken: string }) =>
      request<{ user: UserPublic; token: string }>("/api/v1/auth/google", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    githubAuthStatus: () =>
      request<{ configured: boolean; clientId: string | null }>(
        "/api/v1/auth/github/status",
      ),

    loginWithGitHub: (body: { code: string; redirectUri: string }) =>
      request<{ user: UserPublic; token: string }>("/api/v1/auth/github", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    gitlabAuthStatus: () =>
      request<{ configured: boolean; clientId: string | null }>(
        "/api/v1/auth/gitlab/status",
      ),

    loginWithGitLab: (body: { code: string; redirectUri: string }) =>
      request<{ user: UserPublic; token: string }>("/api/v1/auth/gitlab", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    me: () => request<{ user: UserPublic }>("/api/v1/me"),

    deleteAccount: async (body: DeleteAccount): Promise<{ deleted: true }> => {
      const result = await request<{ deleted?: unknown }>("/api/v1/me", {
        method: "DELETE",
        body: JSON.stringify(body),
      });
      if (result?.deleted !== true) {
        throw new MagnexisApiError(
          "Account deletion could not be confirmed. Check your account before retrying.",
          502,
          "INVALID_DELETION_RESPONSE",
        );
      }
      return { deleted: true };
    },

    listSavedPlaces: () =>
      request<{ savedPlaces: unknown[] }>("/api/v1/me/saved-places"),

    createSavedPlace: (body: CreateSavedPlace) =>
      request<{ savedPlace: unknown }>("/api/v1/me/saved-places", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    mapStyles: () =>
      request<{
        styles: Array<{
          id: string;
          label: string;
          styleUrl: string;
          available: boolean;
          reasonUnavailable?: string;
        }>;
      }>("/api/v1/map-styles"),

    reverseGeocode: (params: { lng: number; lat: number }) => {
      const qs = new URLSearchParams({
        lng: String(params.lng),
        lat: String(params.lat),
      });
      return request<{
        coordinates: { lng: number; lat: number };
        result: {
          id: string;
          label: string;
          coordinates: { lng: number; lat: number };
          address?: string;
        } | null;
        nearestPlace: SearchResult | null;
        provider: string;
      }>(`/api/v1/reverse-geocode?${qs}`);
    },
  };
}

export type MagnexisApiClient = ReturnType<typeof createApiClient>;
