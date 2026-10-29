"use client";

import { useEffect, useState } from "react";
import { Briefcase, Home, MapPin, Navigation2 } from "lucide-react";
import { Button, Input } from "@magnexis/ui";
import { getApiClient } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { getMap } from "@/lib/map-registry";
import {
  loadHomeWork,
  searchFromSlot,
  setHomeWorkSlot,
  type HomeWorkSlots,
} from "@/lib/home-work";
import { startDirectionsTo } from "@/lib/place-actions";

type Saved = {
  id: string;
  label: string;
  coordinates: { lng: number; lat: number };
};

export function SavedPanel({ hideHeader = false }: { hideHeader?: boolean }) {
  const {
    mapView,
    setSelectedSearch,
    openPanel,
    setMapView,
    userLocation,
    setDirections,
    selectedSearch,
  } = useAppStore();
  const [items, setItems] = useState<Saved[]>([]);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [slots, setSlots] = useState<HomeWorkSlots>({ home: null, work: null });

  useEffect(() => {
    setSlots(loadHomeWork());
  }, []);

  async function refresh() {
    try {
      const { savedPlaces } = await getApiClient().listSavedPlaces();
      setItems(savedPlaces as Saved[]);
      setError(null);
    } catch {
      setError("Sign in to sync saved places.");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function saveCurrent() {
    try {
      await getApiClient().createSavedPlace({
        label: label || "Saved place",
        lng: mapView.center.lng,
        lat: mapView.center.lat,
      });
      setLabel("");
      await refresh();
    } catch {
      setError("Could not save place. Sign in first.");
    }
  }

  function openSaved(item: Saved) {
    setSelectedSearch({
      id: item.id,
      label: item.label,
      kind: "place",
      coordinates: item.coordinates,
      source: "internal",
      verified: false,
    });
    setMapView({ center: item.coordinates, zoom: Math.max(mapView.zoom, 14) });
    getMap()?.flyTo({
      center: [item.coordinates.lng, item.coordinates.lat],
      zoom: Math.max(mapView.zoom, 14),
      essential: true,
    });
    openPanel("search");
  }

  function directionsTo(item: Saved) {
    const dest = {
      id: item.id,
      label: item.label,
      kind: "place" as const,
      coordinates: item.coordinates,
      source: "internal" as const,
      verified: false,
    };
    setDirections({
      destination: dest,
      origin: userLocation
        ? {
            id: "gps",
            label: "Your location",
            kind: "geocode",
            coordinates: userLocation,
            source: "internal",
            verified: false,
          }
        : null,
      routes: [],
      selectedRouteIndex: 0,
      error: null,
    });
    openPanel("directions");
  }

  return (
    <div className="space-y-4">
      {!hideHeader ? (
        <div>
          <h2 className="font-display text-lg font-semibold">Saved places</h2>
          <p className="text-sm text-[var(--mx-text-muted)]">
            Bookmarks synced to your Magnexis account.
          </p>
        </div>
      ) : (
        <p className="text-xs text-[var(--mx-text-muted)]">
          Tap a saved place to open it on the map or get directions.
        </p>
      )}

      {/* Home / Work shortcuts (device-local, Google Maps parity) */}
      <div className="grid grid-cols-2 gap-2">
        {(["home", "work"] as const).map((kind) => {
          const slot = slots[kind];
          const Icon = kind === "home" ? Home : Briefcase;
          return (
            <div
              key={kind}
              className="rounded-xl border border-[var(--mx-border)] p-2.5"
            >
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-[var(--mx-text-muted)]">
                <Icon size={12} />
                {kind === "home" ? "Home" : "Work"}
              </div>
              {slot ? (
                <>
                  <p className="truncate text-sm font-medium">{slot.label}</p>
                  <div className="mt-2 flex gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="min-w-0 flex-1"
                      onClick={() => startDirectionsTo(searchFromSlot(kind, slot))}
                    >
                      Go
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Clear ${kind}`}
                      onClick={() => setSlots(setHomeWorkSlot(kind, null))}
                    >
                      ×
                    </Button>
                  </div>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    const from =
                      selectedSearch?.coordinates
                        ? {
                            label: selectedSearch.label,
                            coordinates: selectedSearch.coordinates,
                            address: selectedSearch.address,
                            updatedAt: new Date().toISOString(),
                          }
                        : {
                            label: kind === "home" ? "Home" : "Work",
                            coordinates: { ...mapView.center },
                            updatedAt: new Date().toISOString(),
                          };
                    setSlots(setHomeWorkSlot(kind, from));
                  }}
                >
                  Set {kind === "home" ? "Home" : "Work"}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <Input
        placeholder="Label for map center"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <Button onClick={() => void saveCurrent()}>Save map center</Button>
      {error ? <p className="text-sm text-amber-300">{error}</p> : null}
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex gap-2 rounded-xl border border-[var(--mx-border)] p-2"
          >
            <button
              type="button"
              className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[var(--mx-surface-muted)]"
              onClick={() => openSaved(item)}
            >
              <span className="flex items-center gap-2 font-medium">
                <MapPin size={14} className="shrink-0 text-[var(--mx-accent)]" />
                {item.label}
              </span>
            </button>
            <Button
              size="sm"
              variant="secondary"
              className="shrink-0 gap-1"
              aria-label={`Directions to ${item.label}`}
              onClick={() => directionsTo(item)}
            >
              <Navigation2 size={14} />
            </Button>
          </li>
        ))}
      </ul>
      {!items.length && !error ? (
        <p className="text-sm text-[var(--mx-text-muted)]">
          No saved places yet. Save from search results or the map pin card.
        </p>
      ) : null}
    </div>
  );
}
