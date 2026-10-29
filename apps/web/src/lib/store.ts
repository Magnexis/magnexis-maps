"use client";

import { create } from "zustand";
import type {
  CorrectionReport,
  Place,
  Route,
  SearchResult,
  TravelMode,
  UserSettings,
} from "@magnexis/shared";
import { DEFAULT_USER_SETTINGS } from "@magnexis/shared";
import {
  type FavoritePlace,
  loadFavorites,
  persistFavorites,
  favoriteFromSearch,
} from "@/lib/favorites";
import {
  type RecentPlace,
  loadRecentPlaces,
  persistRecentPlaces,
  recentFromSearch,
} from "@/lib/recents";

export type SidebarPanel =
  | "search"
  | "directions"
  | "saved"
  | "explore"
  | "community"
  | "layers"
  | "report"
  | "account"
  | "settings";

type MapViewState = {
  center: { lng: number; lat: number };
  zoom: number;
  bearing: number;
  pitch: number;
};

/** Device GPS fix used by the glowing locate marker and directions origin. */
export type UserLocation = {
  lng: number;
  lat: number;
  /** Horizontal accuracy in meters when the browser provides it. */
  accuracy?: number;
  /**
   * Facing direction in degrees clockwise from north (GPS heading and/or
   * device compass). Used for the blue-dot heading cone on mobile.
   */
  heading?: number;
  /** Ground speed in m/s when the browser provides it (null/omit if unknown). */
  speedMps?: number | null;
};

type AppState = {
  theme: "light" | "dark";
  panel: SidebarPanel;
  /** When true, map is full-bleed (Google Maps–style); sheet/settings closed. */
  sheetCollapsed: boolean;
  /**
   * Desktop/tablet sidebar width in px (Google Maps–style map+list split).
   * Clamped in the chrome; persisted to localStorage.
   */
  panelWidthPx: number;
  mapView: MapViewState;
  searchQuery: string;
  searchResults: SearchResult[];
  recentSearches: string[];
  /** Recent places with coordinates (device storage — one-tap Directions). */
  recentPlaces: RecentPlace[];
  /** Local starred places (device storage — complements account Saved). */
  favoritePlaces: FavoritePlace[];
  selectedPlace: Place | null;
  selectedSearch: SearchResult | null;
  userLocation: UserLocation | null;
  layers: {
    poi: boolean;
    community: boolean;
    incidents: boolean;
    /** Live congestion overlay when a traffic tile provider is configured. */
    traffic: boolean;
    /** Mapillary coverage overlay when NEXT_PUBLIC_MAPILLARY_ACCESS_TOKEN is set. */
    streetView: boolean;
    /** Public-place density overlay; does not imply live foot-traffic data. */
    hotspots: boolean;
  };
  /** Active Mapillary image id for the street-level viewer (null = closed). */
  streetViewImageId: string | null;
  /**
   * Google Street View Static fallback when Mapillary misses
   * (coords only — imagery loaded via API proxy).
   */
  streetViewGoogle: { lng: number; lat: number } | null;
  streetViewError: string | null;
  styleId: "standard" | "dark" | "terrain" | "satellite";
  directions: {
    origin: SearchResult | null;
    destination: SearchResult | null;
    /** Intermediate stops (A → stops → B). Max 3 in the UI. */
    waypoints: SearchResult[];
    mode: TravelMode;
    routes: Route[];
    selectedRouteIndex: number;
    error: string | null;
  };
  reportDraft: {
    category: string;
    description: string;
  };
  lastReport: CorrectionReport | null;
  apiHealthy: boolean | null;
  settings: UserSettings;
  navigationActive: boolean;
  voiceMuted: boolean;
  setTheme: (theme: "light" | "dark") => void;
  setPanel: (panel: SidebarPanel) => void;
  setSheetCollapsed: (collapsed: boolean) => void;
  setPanelWidthPx: (width: number) => void;
  openPanel: (panel: SidebarPanel) => void;
  setMapView: (view: Partial<MapViewState>) => void;
  setSearchQuery: (q: string) => void;
  setSearchResults: (results: SearchResult[]) => void;
  pushRecentSearch: (q: string) => void;
  pushRecentPlace: (result: SearchResult) => void;
  toggleFavorite: (result: SearchResult) => void;
  removeFavorite: (id: string) => void;
  setSelectedPlace: (place: Place | null) => void;
  setSelectedSearch: (result: SearchResult | null) => void;
  setUserLocation: (loc: UserLocation | null) => void;
  toggleLayer: (key: keyof AppState["layers"]) => void;
  setStreetViewImageId: (id: string | null) => void;
  setStreetViewGoogle: (coords: { lng: number; lat: number } | null) => void;
  setStreetViewError: (error: string | null) => void;
  closeStreetView: () => void;
  setStyleId: (id: AppState["styleId"]) => void;
  setDirections: (partial: Partial<AppState["directions"]>) => void;
  setReportDraft: (partial: Partial<AppState["reportDraft"]>) => void;
  setLastReport: (report: CorrectionReport | null) => void;
  setApiHealthy: (ok: boolean | null) => void;
  patchSettings: (partial: Partial<UserSettings>) => void;
  setNavigationActive: (active: boolean) => void;
  setVoiceMuted: (muted: boolean) => void;
};

const defaultCenter = {
  lng: Number(process.env.NEXT_PUBLIC_DEFAULT_CENTER_LNG ?? -72.6851),
  lat: Number(process.env.NEXT_PUBLIC_DEFAULT_CENTER_LAT ?? 41.599998),
};

const RECENT_SEARCHES_KEY = "magnexis_recent_searches";
const PANEL_WIDTH_KEY = "magnexis_panel_width_px";
const PANEL_WIDTH_MIN = 280;
const PANEL_WIDTH_MAX = 560;
const PANEL_WIDTH_DEFAULT = 352;

function clampPanelWidth(n: number): number {
  if (!Number.isFinite(n)) return PANEL_WIDTH_DEFAULT;
  return Math.min(PANEL_WIDTH_MAX, Math.max(PANEL_WIDTH_MIN, Math.round(n)));
}

function loadPanelWidth(): number {
  if (typeof window === "undefined") return PANEL_WIDTH_DEFAULT;
  try {
    const raw = window.localStorage.getItem(PANEL_WIDTH_KEY);
    if (!raw) return PANEL_WIDTH_DEFAULT;
    return clampPanelWidth(Number(raw));
  } catch {
    return PANEL_WIDTH_DEFAULT;
  }
}

function persistPanelWidth(width: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PANEL_WIDTH_KEY, String(clampPanelWidth(width)));
  } catch {
    // quota / private mode
  }
}

export { PANEL_WIDTH_MIN, PANEL_WIDTH_MAX, PANEL_WIDTH_DEFAULT };

function loadLocalSettings(): UserSettings {
  if (typeof window === "undefined") return DEFAULT_USER_SETTINGS;
  try {
    const raw = window.localStorage.getItem("magnexis_settings");
    if (!raw) return DEFAULT_USER_SETTINGS;
    return { ...DEFAULT_USER_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_USER_SETTINGS;
  }
}

function loadRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string").slice(0, 8);
  } catch {
    return [];
  }
}

function persistRecentSearches(items: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(items));
  } catch {
    // quota / private mode — ignore
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  theme: "dark",
  panel: "search",
  sheetCollapsed: true,
  panelWidthPx: PANEL_WIDTH_DEFAULT,
  mapView: {
    center: defaultCenter,
    zoom: Number(process.env.NEXT_PUBLIC_DEFAULT_ZOOM ?? 8),
    bearing: 0,
    pitch: 0,
  },
  searchQuery: "",
  searchResults: [],
  recentSearches: loadRecentSearches(),
  recentPlaces: loadRecentPlaces(),
  favoritePlaces: loadFavorites(),
  selectedPlace: null,
  selectedSearch: null,
  userLocation: null,
  layers: {
    poi: true,
    community: true,
    incidents: true,
    /** Opt-in via Layers panel — not a map chrome control. */
    traffic: false,
    streetView: false,
    hotspots: true,
  },
  streetViewImageId: null,
  streetViewGoogle: null,
  streetViewError: null,
  styleId: "dark",
  directions: {
    origin: null,
    destination: null,
    waypoints: [],
    mode: "driving",
    routes: [],
    selectedRouteIndex: 0,
    error: null,
  },
  reportDraft: {
    category: "other",
    description: "",
  },
  lastReport: null,
  apiHealthy: null,
  settings: DEFAULT_USER_SETTINGS,
  navigationActive: false,
  voiceMuted: false,
  setTheme: (theme) => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);
    }
    set({ theme });
    get().patchSettings({ theme });
  },
  setPanel: (panel) => set({ panel }),
  setSheetCollapsed: (sheetCollapsed) => set({ sheetCollapsed }),
  setPanelWidthPx: (width) => {
    const panelWidthPx = clampPanelWidth(width);
    persistPanelWidth(panelWidthPx);
    set({ panelWidthPx });
  },
  openPanel: (panel) => set({ panel, sheetCollapsed: false }),
  setMapView: (view) =>
    set((s) => ({ mapView: { ...s.mapView, ...view } })),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSearchResults: (searchResults) => set({ searchResults }),
  pushRecentSearch: (q) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    set((s) => {
      const recentSearches = [
        trimmed,
        ...s.recentSearches.filter((x) => x !== trimmed),
      ].slice(0, 8);
      persistRecentSearches(recentSearches);
      return { recentSearches };
    });
  },
  pushRecentPlace: (result) => {
    const next = recentFromSearch(result);
    if (!next) return;
    set((s) => {
      const prior = s.recentPlaces ?? [];
      const recentPlaces = [
        next,
        ...prior.filter((x) => x.id !== next.id),
      ].slice(0, 12);
      persistRecentPlaces(recentPlaces);
      return { recentPlaces };
    });
    get().pushRecentSearch(result.label);
  },
  toggleFavorite: (result) => {
    const next = favoriteFromSearch(result);
    if (!next) return;
    set((s) => {
      const exists = s.favoritePlaces.some((f) => f.id === next.id);
      const favoritePlaces = exists
        ? s.favoritePlaces.filter((f) => f.id !== next.id)
        : [next, ...s.favoritePlaces.filter((f) => f.id !== next.id)].slice(
            0,
            40,
          );
      persistFavorites(favoritePlaces);
      return { favoritePlaces };
    });
  },
  removeFavorite: (id) => {
    set((s) => {
      const favoritePlaces = s.favoritePlaces.filter((f) => f.id !== id);
      persistFavorites(favoritePlaces);
      return { favoritePlaces };
    });
  },
  setSelectedPlace: (selectedPlace) => set({ selectedPlace }),
  setSelectedSearch: (selectedSearch) => set({ selectedSearch }),
  setUserLocation: (userLocation) => set({ userLocation }),
  toggleLayer: (key) =>
    set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),
  setStreetViewImageId: (streetViewImageId) =>
    set({
      streetViewImageId,
      streetViewGoogle: streetViewImageId ? null : get().streetViewGoogle,
      streetViewError: null,
    }),
  setStreetViewGoogle: (streetViewGoogle) =>
    set({
      streetViewGoogle,
      streetViewImageId: streetViewGoogle ? null : get().streetViewImageId,
      streetViewError: null,
    }),
  setStreetViewError: (streetViewError) => set({ streetViewError }),
  closeStreetView: () =>
    set({
      streetViewImageId: null,
      streetViewGoogle: null,
      streetViewError: null,
    }),
  setStyleId: (styleId) => {
    set({ styleId });
    get().patchSettings({ mapStyle: styleId });
  },
  setDirections: (partial) =>
    set((s) => ({ directions: { ...s.directions, ...partial } })),
  setReportDraft: (partial) =>
    set((s) => ({ reportDraft: { ...s.reportDraft, ...partial } })),
  setLastReport: (lastReport) => set({ lastReport }),
  setApiHealthy: (apiHealthy) => set({ apiHealthy }),
  patchSettings: (partial) => {
    const settings = { ...get().settings, ...partial };
    if (typeof window !== "undefined") {
      window.localStorage.setItem("magnexis_settings", JSON.stringify(settings));
    }
    set({ settings });
  },
  setNavigationActive: (navigationActive) => set({ navigationActive }),
  setVoiceMuted: (voiceMuted) => set({ voiceMuted }),
}));

/** Hydrate settings after mount (avoids SSR mismatch). */
export function getActiveRoute(directions: AppState["directions"]) {
  if (!directions.routes.length) return undefined;
  const i = Math.min(
    Math.max(0, directions.selectedRouteIndex),
    directions.routes.length - 1,
  );
  return directions.routes[i];
}

export function hydrateSettingsFromLocalStorage() {
  const settings = loadLocalSettings();
  useAppStore.setState({
    settings,
    recentSearches: loadRecentSearches(),
    recentPlaces: loadRecentPlaces(),
    favoritePlaces: loadFavorites(),
    panelWidthPx: loadPanelWidth(),
  });
  if (settings.theme === "light" || settings.theme === "dark") {
    useAppStore.getState().setTheme(settings.theme);
  }
  if (
    settings.mapStyle === "standard" ||
    settings.mapStyle === "dark" ||
    settings.mapStyle === "terrain" ||
    settings.mapStyle === "satellite"
  ) {
    useAppStore.setState({ styleId: settings.mapStyle });
  }
}

/** Clear recent search history (Settings / privacy). */
export function clearRecentSearches() {
  persistRecentSearches([]);
  persistRecentPlaces([]);
  useAppStore.setState({ recentSearches: [], recentPlaces: [] });
}
