"use client";

import { getGeolocation } from "@/lib/geolocation";

import { useEffect, useState } from "react";
import {
  ArrowUpDown,
  Bike,
  Car,
  CircleDot,
  Footprints,
  GripVertical,
  Navigation2,
  ParkingCircle,
  Plus,
  Search,
  Share2,
  X,
} from "lucide-react";
import { Button, Input } from "@magnexis/ui";
import { MagnexisApiError } from "@magnexis/api-client";
import type { SearchResult, TravelMode } from "@magnexis/shared";
import { getApiClient } from "@/lib/api";
import {
  formatArrivalTime,
  formatDistanceMeters,
  formatDurationSeconds,
  formatRouteSummary,
  formatTrafficDelay,
} from "@/lib/format";
import { shareRoute } from "@/lib/place-actions";
import { useAppStore } from "@/lib/store";
import { useStartNavigation } from "@/hooks/use-start-navigation";
import {
  fetchTomTomAlongRoute,
  fetchTomTomCategory,
} from "@/lib/tomtom-client";
import { getMap } from "@/lib/map-registry";
import { MAX_ROUTE_STOPS } from "@/lib/share-links";
import { resolveRouteStops, RouteStopError } from "@/lib/route-stops";

function reorderList<T>(list: T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= list.length ||
    to >= list.length
  ) {
    return list;
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

const MODES: {
  mode: TravelMode;
  label: string;
  short: string;
  icon: typeof Car;
  hint: string;
}[] = [
  {
    mode: "driving",
    label: "Drive",
    short: "Drive",
    icon: Car,
    hint: "Car / rideshare routing",
  },
  {
    mode: "walking",
    label: "Walk",
    short: "Walk",
    icon: Footprints,
    hint: "Pedestrian paths",
  },
  {
    mode: "cycling",
    label: "Bike",
    short: "Bike",
    icon: Bike,
    hint: "Cycling-friendly routes",
  },
];

const MAX_STOPS = MAX_ROUTE_STOPS;

export function DirectionsPanel({
  hideHeader = false,
}: {
  hideHeader?: boolean;
}) {
  const {
    directions,
    setDirections,
    selectedSearch,
    userLocation,
    setUserLocation,
    mapView,
    settings,
  } = useAppStore();
  const startNavigation = useStartNavigation();
  const patchSettings = useAppStore((s) => s.patchSettings);
  const [originQuery, setOriginQuery] = useState("");
  const [destQuery, setDestQuery] = useState("");
  /** Draft stop labels — resolved into directions.waypoints on plan. */
  const [stopDrafts, setStopDrafts] = useState<string[]>(() =>
    directions.waypoints.map((stop) => stop.label),
  );
  const [dragStopIndex, setDragStopIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [alongQuery, setAlongQuery] = useState("");
  const [alongHits, setAlongHits] = useState<SearchResult[]>([]);
  const [alongLoading, setAlongLoading] = useState(false);
  const [parkingHits, setParkingHits] = useState<SearchResult[]>([]);
  const [parkingLoading, setParkingLoading] = useState(false);
  const units = settings.units === "metric" ? "metric" : "imperial";

  const isYourLocation =
    directions.origin?.id === "gps" ||
    directions.origin?.label === "Current location" ||
    directions.origin?.label === "Your location";

  function useYourLocationAsOrigin() {
    const apply = (loc: { lng: number; lat: number }) => {
      setOriginQuery("Your location");
      setDirections({
        origin: {
          id: "gps",
          label: "Your location",
          kind: "geocode",
          coordinates: loc,
          source: "internal",
          verified: false,
        },
        routes: [],
        selectedRouteIndex: 0,
      });
    };
    if (userLocation) {
      apply(userLocation);
      return;
    }
    if (!getGeolocation()) return;
    getGeolocation()?.getCurrentPosition(
      (pos) => {
        const loc = {
          lng: pos.coords.longitude,
          lat: pos.coords.latitude,
        };
        setUserLocation(loc);
        apply(loc);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 60_000 },
    );
  }

  useEffect(() => {
    if (directions.origin?.label && !originQuery) {
      setOriginQuery(directions.origin.label);
    }
    if (directions.destination?.label && !destQuery) {
      setDestQuery(directions.destination.label);
    }
  }, [directions.origin, directions.destination, originQuery, destQuery]);

  // Hydrate drafts from resolved waypoints when they arrive from outside.
  useEffect(() => {
    if (directions.waypoints.length === 0) return;
    setStopDrafts((prev) => {
      if (prev.length > 0 && prev.some((q) => q.trim())) return prev;
      return directions.waypoints.map((w) => w.label);
    });
  }, [directions.waypoints]);

  // Prefer selected search as destination when opening Go from Search
  useEffect(() => {
    if (directions.destination || !selectedSearch?.coordinates) return;
    setDestQuery(selectedSearch.label);
    setDirections({ destination: selectedSearch });
  }, [selectedSearch, directions.destination, setDirections]);

  // Google Maps–style: default origin to GPS when opening Go without one set
  useEffect(() => {
    if (directions.origin || userLocation || !getGeolocation()) return;
    getGeolocation()?.getCurrentPosition(
      (pos) => {
        const loc = {
          lng: pos.coords.longitude,
          lat: pos.coords.latitude,
        };
        setUserLocation(loc);
        if (!useAppStore.getState().directions.origin) {
          setOriginQuery("Your location");
          setDirections({
            origin: {
              id: "gps",
              label: "Your location",
              kind: "geocode",
              coordinates: loc,
              source: "internal",
              verified: false,
            },
          });
        }
      },
      () => {
        /* permission denied — user can still type an origin */
      },
      { enableHighAccuracy: true, maximumAge: 60_000 },
    );
  }, [directions.origin, userLocation, setUserLocation, setDirections]);

  async function resolvePoint(
    query: string,
    fallback?: { lng: number; lat: number; label: string },
  ) {
    if (!query.trim() && fallback) {
      return {
        id: "fallback",
        label: fallback.label,
        kind: "place" as const,
        coordinates: { lng: fallback.lng, lat: fallback.lat },
        source: "internal" as const,
        verified: false,
      };
    }
    const { results } = await getApiClient().search({
      q: query,
      lng: mapView.center.lng,
      lat: mapView.center.lat,
      limit: 1,
    });
    return results[0] ?? null;
  }

  async function planRoute() {
    setLoading(true);
    const snap = useAppStore.getState();
    const dir = snap.directions;
    setDirections({ error: null, routes: [], selectedRouteIndex: 0 });
    try {
      const origin =
        dir.origin ??
        (await resolvePoint(
          originQuery,
          snap.userLocation
            ? {
                lng: snap.userLocation.lng,
                lat: snap.userLocation.lat,
                label: "Your location",
              }
            : undefined,
        ));
      const destination =
        dir.destination ??
        snap.selectedSearch ??
        (await resolvePoint(destQuery));

      if (!origin || !destination) {
        setDirections({
          error: "Set both origin and destination using search results.",
        });
        return;
      }

      const resolvedStops = await resolveRouteStops(
        stopDrafts,
        dir.waypoints,
        resolvePoint,
      );

      setDirections({
        origin,
        destination,
        waypoints: resolvedStops,
      });
      const s = snap.settings;
      const wantAlternatives =
        (dir.mode === "driving" || s.routePreference === "shortest") &&
        resolvedStops.length === 0;
      const { routes } = await getApiClient().createRoute({
        origin: origin.coordinates,
        destination: destination.coordinates,
        mode: dir.mode,
        waypoints: resolvedStops.map((w) => w.coordinates!),
        alternatives: wantAlternatives,
        avoidHighways: s.avoidHighways,
        avoidTolls: s.avoidTolls,
        avoidFerries: s.avoidFerries,
        routePreference: s.routePreference,
      });
      setDirections({
        routes,
        selectedRouteIndex: 0,
        error: routes.length ? null : "No route found for this mode.",
      });
    } catch (err) {
      const message =
        err instanceof MagnexisApiError || err instanceof RouteStopError
          ? err.message
          : "Couldn’t plan this route. Check your connection or try another travel mode.";
      setDirections({ error: message, routes: [], selectedRouteIndex: 0 });
    } finally {
      setLoading(false);
    }
  }

  // Auto-route once both endpoints are known (Google Maps parity),
  // and re-fetch when route options change so the map polyline updates.
  useEffect(() => {
    const { origin, destination, error } = useAppStore.getState().directions;
    if (!origin?.coordinates || !destination?.coordinates) return;
    if (loading) return;
    if (
      error?.includes("ROUTING_PROVIDER") ||
      error?.includes("not configured")
    ) {
      return;
    }
    void planRoute();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire when endpoints / mode / route options change
  }, [
    directions.origin?.id,
    directions.destination?.id,
    directions.waypoints.map((w) => w.id).join("|"),
    stopDrafts.filter((q) => q.trim()).join("|"),
    directions.mode,
    settings.avoidHighways,
    settings.avoidTolls,
    settings.avoidFerries,
    settings.routePreference,
  ]);

  function swapEndpoints() {
    const nextOrigin = directions.destination;
    const nextDest = directions.origin;
    setDirections({
      origin: nextOrigin,
      destination: nextDest,
      waypoints: [...directions.waypoints].reverse(),
      routes: [],
      selectedRouteIndex: 0,
    });
    setOriginQuery(nextOrigin?.label ?? destQuery);
    setDestQuery(nextDest?.label ?? originQuery);
    setStopDrafts((stops) => [...stops].reverse());
  }

  function addStop() {
    if (stopDrafts.length >= MAX_STOPS) return;
    setStopDrafts((q) => [...q, ""]);
    setDirections({ routes: [], selectedRouteIndex: 0 });
  }

  function removeStop(index: number) {
    setStopDrafts((q) => q.filter((_, i) => i !== index));
    setDirections({
      waypoints: directions.waypoints.filter((_, i) => i !== index),
      routes: [],
      selectedRouteIndex: 0,
    });
  }

  function reorderStops(from: number, to: number) {
    if (from === to) return;
    setStopDrafts((prev) => reorderList(prev, from, to));
    setDirections({
      waypoints: reorderList(directions.waypoints, from, to),
      routes: [],
      selectedRouteIndex: 0,
    });
  }

  function clearDirections() {
    setStopDrafts([]);
    setOriginQuery("");
    setDestQuery("");
    setDirections({
      origin: null,
      destination: null,
      waypoints: [],
      routes: [],
      selectedRouteIndex: 0,
      error: null,
    });
  }

  const routes = directions.routes;
  const activeIndex = Math.min(
    directions.selectedRouteIndex,
    Math.max(0, routes.length - 1),
  );
  const route = routes[activeIndex];
  const fastestSeconds = routes.length
    ? Math.min(...routes.map((r) => r.durationSeconds))
    : 0;

  return (
    <div className="space-y-4">
      {!hideHeader ? (
        <div>
          <h2 className="font-display text-lg font-semibold">Directions</h2>
          <p className="text-sm text-[var(--mx-text-muted)]">
            Set A→B (optional stops) and get a real route polyline. Start
            navigation when ready.
          </p>
        </div>
      ) : (
        <p className="text-xs text-[var(--mx-text-muted)]">
          Pick a travel mode, then origin and destination. Congestion overlay is
          under Layers when traffic tiles are configured.
        </p>
      )}

      <div
        role="group"
        aria-label="Travel mode"
        className="grid grid-cols-3 gap-1.5 rounded-xl border border-[var(--mx-border)] bg-[var(--mx-surface-2)]/50 p-1"
      >
        {MODES.map(({ mode, label, icon: Icon, hint }) => {
          const active = directions.mode === mode;
          return (
            <button
              key={mode}
              type="button"
              title={hint}
              aria-pressed={active}
              aria-label={`${label} — ${hint}`}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-2 text-xs font-medium transition ${
                active
                  ? "bg-[var(--mx-accent)] text-[var(--mx-accent-fg,white)] shadow-sm"
                  : "text-[var(--mx-text-muted)] hover:bg-[var(--mx-surface-muted)] hover:text-[var(--mx-text)]"
              }`}
              onClick={() =>
                setDirections({ mode, routes: [], selectedRouteIndex: 0 })
              }
            >
              <Icon size={16} strokeWidth={active ? 2.25 : 1.75} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Your location origin chip (Google Maps parity) */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={isYourLocation}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
            isYourLocation
              ? "border-[var(--mx-accent)] bg-[color-mix(in_srgb,var(--mx-accent)_16%,transparent)] text-[var(--mx-text)]"
              : "border-[var(--mx-border)] bg-[var(--mx-surface-2)] text-[var(--mx-text-muted)] hover:border-[var(--mx-accent)] hover:text-[var(--mx-text)]"
          }`}
          onClick={useYourLocationAsOrigin}
        >
          <CircleDot size={12} className="text-[var(--mx-accent)]" />
          Your location
        </button>
        <span className="text-[11px] text-[var(--mx-text-muted)]">
          as starting point
        </span>
      </div>

      <div className="flex gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <Input
            placeholder="Choose starting point"
            value={originQuery}
            onChange={(e) => {
              setOriginQuery(e.target.value);
              setDirections({ origin: null });
            }}
            aria-label="Route origin"
          />
          {stopDrafts.map((draft, i) => (
            <div
              key={`stop-row-${i}`}
              className={`flex gap-1.5 rounded-lg transition ${
                dragStopIndex === i
                  ? "bg-[var(--mx-surface-muted)] ring-1 ring-[var(--mx-accent)]"
                  : ""
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = Number(e.dataTransfer.getData("text/plain"));
                if (Number.isFinite(from)) reorderStops(from, i);
                setDragStopIndex(null);
              }}
            >
              {stopDrafts.length > 1 ? (
                <button
                  type="button"
                  className="mt-1 flex h-8 w-7 shrink-0 cursor-grab items-center justify-center rounded text-[var(--mx-text-muted)] hover:bg-[var(--mx-surface-muted)] active:cursor-grabbing"
                  draggable
                  aria-label={`Drag to reorder stop ${i + 1}`}
                  title="Drag to reorder"
                  onDragStart={(e) => {
                    setDragStopIndex(i);
                    e.dataTransfer.setData("text/plain", String(i));
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => setDragStopIndex(null)}
                >
                  <GripVertical size={14} />
                </button>
              ) : null}
              <Input
                placeholder={`Stop ${i + 1}`}
                value={draft}
                onChange={(e) => {
                  const value = e.target.value;
                  setStopDrafts((prev) => {
                    const next = [...prev];
                    next[i] = value;
                    return next;
                  });
                  setDirections({ routes: [], selectedRouteIndex: 0 });
                }}
                aria-label={`Route stop ${i + 1}`}
                className="min-w-0 flex-1"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 shrink-0"
                aria-label={`Remove stop ${i + 1}`}
                onClick={() => removeStop(i)}
              >
                <X size={14} />
              </Button>
            </div>
          ))}
          <Input
            placeholder="Choose destination"
            value={destQuery}
            onChange={(e) => {
              setDestQuery(e.target.value);
              setDirections({ destination: null });
            }}
            aria-label="Route destination"
          />
        </div>
        <Button
          size="icon"
          variant="secondary"
          className="mt-1 h-10 w-10 shrink-0 self-center"
          aria-label="Swap origin and destination"
          title="Swap origin and destination"
          onClick={swapEndpoints}
        >
          <ArrowUpDown size={16} />
        </Button>
      </div>

      {stopDrafts.length < MAX_STOPS ? (
        <Button
          size="sm"
          variant="ghost"
          className="w-full gap-1.5 text-[var(--mx-text-muted)]"
          onClick={addStop}
        >
          <Plus size={14} />
          Add stop
        </Button>
      ) : null}

      <div className="flex gap-2">
        <Button
          className="flex-1"
          onClick={() => void planRoute()}
          disabled={loading}
        >
          {loading ? "Routing…" : "Get route"}
        </Button>
        <Button
          variant="secondary"
          className="gap-1.5"
          onClick={useYourLocationAsOrigin}
        >
          <CircleDot size={14} />
          Location
        </Button>
      </div>

      {/* Always-visible avoid chips (Google Maps Go parity) */}
      <div
        role="group"
        aria-label="Route options"
        className="flex flex-wrap gap-1.5"
      >
        {(
          [
            {
              key: "avoidHighways" as const,
              label: "No highways",
              on: settings.avoidHighways,
            },
            {
              key: "avoidTolls" as const,
              label: "No tolls",
              on: settings.avoidTolls,
            },
            {
              key: "avoidFerries" as const,
              label: "No ferries",
              on: settings.avoidFerries,
            },
          ] as const
        ).map((chip) => (
          <button
            key={chip.key}
            type="button"
            aria-pressed={chip.on}
            className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
              chip.on
                ? "border-[var(--mx-accent)] bg-[color-mix(in_srgb,var(--mx-accent)_14%,transparent)] text-[var(--mx-text)]"
                : "border-[var(--mx-border)] bg-[var(--mx-surface-2)] text-[var(--mx-text-muted)] hover:border-[var(--mx-accent)] hover:text-[var(--mx-text)]"
            }`}
            onClick={() => patchSettings({ [chip.key]: !chip.on })}
          >
            {chip.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={settings.routePreference === "shortest"}
          className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
            settings.routePreference === "shortest"
              ? "border-[var(--mx-accent)] bg-[color-mix(in_srgb,var(--mx-accent)_14%,transparent)] text-[var(--mx-text)]"
              : "border-[var(--mx-border)] bg-[var(--mx-surface-2)] text-[var(--mx-text-muted)] hover:border-[var(--mx-accent)] hover:text-[var(--mx-text)]"
          }`}
          onClick={() =>
            patchSettings({
              routePreference:
                settings.routePreference === "shortest"
                  ? "fastest"
                  : "shortest",
            })
          }
        >
          {settings.routePreference === "shortest" ? "Shortest" : "Fastest"}
        </button>
      </div>

      {directions.error ? (
        <div className="space-y-2 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          <p>{directions.error}</p>
          <Button
            size="sm"
            variant="secondary"
            disabled={loading}
            onClick={() => void planRoute()}
          >
            Retry route
          </Button>
        </div>
      ) : null}

      {routes.length > 1 ? (
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--mx-text-muted)]">
            Alternatives
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {routes.map((r, i) => {
              const delta = Math.max(
                0,
                Math.round((r.durationSeconds - fastestSeconds) / 60),
              );
              const selected = i === activeIndex;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setDirections({ selectedRouteIndex: i })}
                  aria-pressed={selected}
                  className={`min-w-[8.5rem] shrink-0 rounded-xl border px-3 py-2.5 text-left transition ${
                    selected
                      ? "border-[var(--mx-accent)] bg-[color-mix(in_srgb,var(--mx-accent)_12%,transparent)]"
                      : "border-[var(--mx-border)] hover:bg-[var(--mx-surface-muted)]"
                  }`}
                >
                  <span className="block text-sm font-semibold tabular-nums">
                    {formatDurationSeconds(r.durationSeconds)}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[var(--mx-text-muted)]">
                    {formatDistanceMeters(r.distanceMeters, units)}
                    {" · "}
                    {delta === 0 ? "Fastest" : `+${delta} min`}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-[var(--mx-text-muted)]">
                    Arrive {formatArrivalTime(r.durationSeconds)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {route ? (
        <div className="space-y-3">
          <div className="rounded-xl bg-[var(--mx-surface-muted)] p-3 text-sm">
            <div className="font-medium">
              {formatRouteSummary(
                route.distanceMeters,
                route.durationSeconds,
                units,
              )}
            </div>
            <div className="mt-0.5 text-xs text-[var(--mx-text-muted)]">
              Arrive by {formatArrivalTime(route.durationSeconds)}
              {formatTrafficDelay(route.trafficDelaySeconds)
                ? ` · ${formatTrafficDelay(route.trafficDelaySeconds)}`
                : ""}
              {" · "}
              {route.provider}
              {route.trafficAware ? " · traffic-aware" : " · no live traffic"}
              {(directions.waypoints?.length ?? 0) > 0
                ? ` · ${directions.waypoints.length} stop${directions.waypoints.length === 1 ? "" : "s"}`
                : ""}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="min-w-0 flex-1 gap-2"
              variant="primary"
              onClick={() => startNavigation()}
            >
              <Navigation2 size={16} />
              Start
            </Button>
            {directions.origin?.coordinates &&
            directions.destination?.coordinates ? (
              <Button
                variant="secondary"
                className="gap-1.5"
                aria-label="Share route link"
                onClick={() => {
                  void (async () => {
                    setShareMsg(null);
                    try {
                      const outcome = await shareRoute({
                        origin: {
                          label: directions.origin!.label,
                          coordinates: directions.origin!.coordinates!,
                        },
                        destination: {
                          label: directions.destination!.label,
                          coordinates: directions.destination!.coordinates!,
                        },
                        mode: directions.mode,
                        waypoints: directions.waypoints,
                      });
                      setShareMsg(
                        outcome === "cancelled"
                          ? null
                          : outcome === "shared"
                            ? "Shared"
                            : "Link copied",
                      );
                    } catch {
                      setShareMsg("Couldn’t share — try again");
                    }
                  })();
                }}
              >
                <Share2 size={16} />
                Share
              </Button>
            ) : null}
            <Button
              variant="secondary"
              className="gap-1.5"
              disabled={parkingLoading || !directions.destination?.coordinates}
              aria-label="Find parking near destination"
              onClick={() => {
                const dest = directions.destination?.coordinates;
                if (!dest) return;
                setParkingLoading(true);
                setParkingHits([]);
                void fetchTomTomCategory({
                  category: "parking",
                  lng: dest.lng,
                  lat: dest.lat,
                  radiusMeters: 1200,
                  limit: 6,
                })
                  .then((hits) => {
                    setParkingHits(
                      hits.map((h) => ({
                        id: h.id,
                        label: h.label,
                        kind: "place" as const,
                        coordinates: h.coordinates,
                        address: h.address,
                        distanceMeters: h.distanceMeters,
                        source: "geocoder" as const,
                        verified: false,
                      })),
                    );
                  })
                  .finally(() => setParkingLoading(false));
              }}
            >
              <ParkingCircle size={16} />
              {parkingLoading ? "…" : "Parking"}
            </Button>
            <Button variant="secondary" onClick={clearDirections}>
              Clear
            </Button>
          </div>
          {shareMsg ? (
            <p className="text-xs text-[var(--mx-text-muted)]" role="status">
              {shareMsg}
            </p>
          ) : null}

          {/* Search along route */}
          <div className="space-y-2 rounded-xl border border-[var(--mx-border)] p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--mx-text-muted)]">
              Search along route
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Gas, coffee, EV charging…"
                value={alongQuery}
                onChange={(e) => setAlongQuery(e.target.value)}
                aria-label="Search along route"
                className="min-w-0 flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (
                      document.getElementById(
                        "mx-along-search-btn",
                      ) as HTMLButtonElement | null
                    )?.click();
                  }
                }}
              />
              <Button
                id="mx-along-search-btn"
                size="icon"
                variant="secondary"
                disabled={alongLoading || alongQuery.trim().length < 2}
                aria-label="Search along route"
                onClick={() => {
                  const pts = route.geometry.coordinates.map(([lng, lat]) => ({
                    lng,
                    lat,
                  }));
                  if (pts.length < 2) return;
                  setAlongLoading(true);
                  setAlongHits([]);
                  void fetchTomTomAlongRoute({
                    q: alongQuery.trim(),
                    points: pts,
                    limit: 8,
                  })
                    .then((hits) => {
                      setAlongHits(
                        hits.map((h) => ({
                          id: h.id,
                          label: h.label,
                          kind: "place" as const,
                          coordinates: h.coordinates,
                          address: h.address,
                          source: "geocoder" as const,
                          verified: false,
                        })),
                      );
                    })
                    .finally(() => setAlongLoading(false));
                }}
              >
                <Search size={16} />
              </Button>
            </div>
            {alongHits.length ? (
              <ul className="max-h-36 space-y-1 overflow-y-auto text-sm">
                {alongHits.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-[var(--mx-surface-muted)]"
                      onClick={() => {
                        if (!hit.coordinates) return;
                        useAppStore.getState().setSelectedSearch(hit);
                        useAppStore.getState().setMapView({
                          center: hit.coordinates,
                          zoom: 15,
                        });
                        getMap()?.flyTo({
                          center: [hit.coordinates.lng, hit.coordinates.lat],
                          zoom: 15,
                          essential: true,
                        });
                      }}
                    >
                      <span className="font-medium">{hit.label}</span>
                      {hit.address ? (
                        <span className="mt-0.5 block text-[11px] text-[var(--mx-text-muted)]">
                          {hit.address}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : alongLoading ? (
              <p className="text-xs text-[var(--mx-text-muted)]">Searching…</p>
            ) : null}
          </div>

          {parkingHits.length ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--mx-text-muted)]">
                Parking near destination
              </p>
              <ul className="max-h-36 space-y-1 overflow-y-auto text-sm">
                {parkingHits.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--mx-border)] px-2.5 py-2 text-left hover:bg-[var(--mx-surface-muted)]"
                      onClick={() => {
                        if (!hit.coordinates) return;
                        setDirections({
                          destination: hit,
                          routes: [],
                          selectedRouteIndex: 0,
                        });
                        setDestQuery(hit.label);
                      }}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {hit.label}
                        </span>
                        {hit.distanceMeters != null ? (
                          <span className="text-[11px] text-[var(--mx-text-muted)]">
                            {formatDistanceMeters(hit.distanceMeters, units)}{" "}
                            away · set as destination
                          </span>
                        ) : (
                          <span className="text-[11px] text-[var(--mx-text-muted)]">
                            Set as destination
                          </span>
                        )}
                      </span>
                      <ParkingCircle
                        size={14}
                        className="shrink-0 text-[var(--mx-accent)]"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <ol className="max-h-[28vh] space-y-2 overflow-y-auto text-sm md:max-h-none">
            {route.maneuvers.map((m, i) => (
              <li
                key={`${i}-${m.instruction}`}
                className="rounded-lg border border-[var(--mx-border)] px-3 py-2"
              >
                {m.instruction}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
