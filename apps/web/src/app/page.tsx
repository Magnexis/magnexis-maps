"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { HorizonChrome } from "@/components/shell/horizon-chrome";
import { getApiClient } from "@/lib/api";
import { hydrateSettingsFromLocalStorage, useAppStore } from "@/lib/store";
import { parseCoordinates, parseSharedStops } from "@/lib/share-links";

const MapCanvas = dynamic(
  () => import("@/components/map/map-canvas").then((m) => m.MapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[var(--mx-bg)] text-[var(--mx-text)]">
        <img
          src="/logo.png"
          alt=""
          width={72}
          height={72}
          className="rounded-full"
        />
        <p className="font-display text-sm tracking-[0.25em] text-[var(--mx-text-muted)]">
          MAGNEXIS MAPS
        </p>
      </div>
    ),
  },
);

const StreetViewOverlay = dynamic(
  () =>
    import("@/components/map/street-view-overlay").then(
      (m) => m.StreetViewOverlay,
    ),
  { ssr: false },
);

/** Open a shared place link (?q=&lng=&lat=) like Google Maps place URLs. */
function applyPlaceShareDeepLink(params: URLSearchParams) {
  const q = params.get("q")?.trim();
  const coordinates = parseCoordinates(params.get("lng"), params.get("lat"));
  if (!q || !coordinates) return false;
  const { lng, lat } = coordinates;

  const store = useAppStore.getState();
  store.setSearchQuery(q);
  store.setMapView({
    center: { lng, lat },
    zoom: Math.max(store.mapView.zoom, 14),
  });
  const result = {
    id: `share-${lng}-${lat}`,
    label: q,
    kind: "place" as const,
    coordinates: { lng, lat },
    source: "internal" as const,
    verified: false,
  };
  store.setSelectedSearch(result);
  store.pushRecentPlace(result);
  store.openPanel("search");
  return true;
}

/**
 * Open a shared route (?dir=1&olng=&olat=&dlng=&dlat=&oq=&dq=&mode=).
 * Mirrors Google Maps directions deep links without Google APIs.
 */
function applyRouteShareDeepLink(params: URLSearchParams) {
  if (params.get("dir") !== "1") return false;
  const origin = parseCoordinates(params.get("olng"), params.get("olat"));
  const destination = parseCoordinates(params.get("dlng"), params.get("dlat"));
  const stops = parseSharedStops(params.get("stops"));
  if (!origin || !destination || !stops) return false;
  const { lng: olng, lat: olat } = origin;
  const { lng: dlng, lat: dlat } = destination;
  const oq = params.get("oq")?.trim() || "Origin";
  const dq = params.get("dq")?.trim() || "Destination";
  const modeRaw = params.get("mode")?.trim() || "driving";
  const mode =
    modeRaw === "walking" || modeRaw === "cycling" ? modeRaw : "driving";

  const store = useAppStore.getState();
  store.setDirections({
    origin: {
      id: `share-o-${olng}-${olat}`,
      label: oq,
      kind: "geocode",
      coordinates: { lng: olng, lat: olat },
      source: "internal",
      verified: false,
    },
    destination: {
      id: `share-d-${dlng}-${dlat}`,
      label: dq,
      kind: "geocode",
      coordinates: { lng: dlng, lat: dlat },
      source: "internal",
      verified: false,
    },
    waypoints: stops.map((stop, index) => ({
      ...stop,
      id: `share-stop-${index}-${stop.coordinates.lng}-${stop.coordinates.lat}`,
      kind: "geocode",
      source: "geocoder",
      verified: false,
    })),
    mode,
    routes: [],
    selectedRouteIndex: 0,
    error: null,
  });
  store.setMapView({
    center: { lng: (olng + dlng) / 2, lat: (olat + dlat) / 2 },
    zoom: Math.max(store.mapView.zoom, 11),
  });
  store.openPanel("directions");
  return true;
}

function applyShareDeepLink() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (applyRouteShareDeepLink(params)) return;
  applyPlaceShareDeepLink(params);
}

export default function HomePage() {
  const { theme, setApiHealthy } = useAppStore();

  useEffect(() => {
    hydrateSettingsFromLocalStorage();
    applyShareDeepLink();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    void getApiClient()
      .health()
      .then(() => setApiHealthy(true))
      .catch(() => setApiHealthy(false));
  }, [setApiHealthy]);

  return (
    <div className="relative h-[100dvh] max-h-[100dvh] min-h-0 overflow-hidden bg-[var(--mx-bg)]">
      <MapCanvas />
      <HorizonChrome />
      <StreetViewOverlay />
    </div>
  );
}
