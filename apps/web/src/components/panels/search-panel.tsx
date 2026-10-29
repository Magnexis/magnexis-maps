"use client";

import { useEffect, useState, type MouseEvent } from "react";
import {
  Briefcase,
  Clock,
  Home,
  MapPin,
  Loader2,
  Navigation2,
  Star,
  WifiOff,
} from "lucide-react";
import { Input, Button, EmptyState } from "@magnexis/ui";
import { MagnexisApiError } from "@magnexis/api-client";
import { EXPLORE_CATEGORIES } from "@magnexis/shared";
import type { SearchResult } from "@magnexis/shared";
import { getApiClient } from "@/lib/api";
import { searchFromFavorite } from "@/lib/favorites";
import { searchFromRecent } from "@/lib/recents";
import { startDirectionsTo } from "@/lib/place-actions";
import { clearRecentSearches, useAppStore } from "@/lib/store";
import { PlaceDetailCard } from "@/components/places/place-detail-card";
import {
  loadHomeWork,
  searchFromSlot,
  type HomeWorkSlots,
} from "@/lib/home-work";

export function SearchPanel({ hideHeader = false }: { hideHeader?: boolean }) {
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    recentSearches,
    recentPlaces,
    pushRecentPlace,
    favoritePlaces,
    toggleFavorite,
    setSelectedSearch,
    setSelectedPlace,
    mapView,
    selectedPlace,
    selectedSearch,
    apiHealthy,
  } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [homeWork, setHomeWork] = useState<HomeWorkSlots>({
    home: null,
    work: null,
  });

  useEffect(() => {
    setHomeWork(loadHomeWork());
  }, [favoritePlaces.length, recentPlaces.length]);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setLoading(false);
      return;
    }
    const handle = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const api = getApiClient();
        const { results } = await api.search({
          q: searchQuery.trim(),
          lng: mapView.center.lng,
          lat: mapView.center.lat,
          limit: 12,
        });
        setSearchResults(results);
      } catch (err) {
        setSearchResults([]);
        setError(
          err instanceof MagnexisApiError
            ? err.message
            : "Search unavailable. Is the API running?",
        );
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => clearTimeout(handle);
  }, [searchQuery, mapView.center.lng, mapView.center.lat, setSearchResults]);

  async function selectResult(result: SearchResult) {
    setSelectedSearch(result);
    pushRecentPlace(result);
    if (result.source === "internal") {
      try {
        const { place } = await getApiClient().getPlace(result.id);
        setSelectedPlace(place);
      } catch {
        setSelectedPlace(null);
      }
    } else {
      setSelectedPlace(null);
    }
    useAppStore.getState().setSheetCollapsed(true);
  }

  function directionsToResult(result: SearchResult, e?: MouseEvent) {
    e?.stopPropagation();
    pushRecentPlace(result);
    setSelectedSearch(result);
    startDirectionsTo(result);
  }

  function pickCategory(label: string, category: string) {
    setActiveCategory(category);
    setSearchQuery(label);
  }

  const idle = searchQuery.trim().length < 2;
  const placesRecent = recentPlaces ?? [];
  const queriesRecent = recentSearches ?? [];
  const favorites = favoritePlaces ?? [];
  const favIds = new Set(favorites.map((f) => f.id));

  return (
    <div className="space-y-4">
      {!hideHeader ? (
        <div>
          <h2 className="font-display text-lg font-semibold">Search</h2>
          <p className="text-sm text-[var(--mx-text-muted)]">
            Places, addresses, and landmarks — pick a result or tap Directions
            to route.
          </p>
        </div>
      ) : null}
      {!hideHeader ? (
        <div className="relative">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              const top = searchResults[0];
              if (top?.coordinates) {
                directionsToResult(top);
              }
            }}
            placeholder="Search a place, then Directions or Enter to go"
            aria-label="Search places"
            aria-busy={loading}
          />
          {loading ? (
            <Loader2
              className="absolute right-3 top-2.5 animate-spin text-primary"
              size={16}
              aria-hidden
            />
          ) : null}
        </div>
      ) : loading ? (
        <div
          className="flex items-center gap-2 text-xs text-[var(--mx-text-muted)]"
          role="status"
        >
          <Loader2 className="animate-spin text-primary" size={14} />
          Searching nearby…
        </div>
      ) : null}

      {apiHealthy === false && idle ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-200">
          <WifiOff size={16} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <span>
              API looks offline — search and nearby may fail until the Magnexis
              API is reachable.
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void getApiClient()
                  .health()
                  .then(() => useAppStore.getState().setApiHealthy(true))
                  .catch(() => useAppStore.getState().setApiHealthy(false));
              }}
            >
              Retry connection
            </Button>
          </div>
        </div>
      ) : null}

      {idle && (homeWork.home || homeWork.work) ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Home and work">
          {homeWork.home ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--mx-border)] bg-[var(--mx-surface-2)] px-3 py-1.5 text-xs font-medium hover:border-[var(--mx-accent)]"
              onClick={() =>
                startDirectionsTo(searchFromSlot("home", homeWork.home!))
              }
            >
              <Home size={12} className="text-[var(--mx-accent)]" />
              Home
            </button>
          ) : null}
          {homeWork.work ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--mx-border)] bg-[var(--mx-surface-2)] px-3 py-1.5 text-xs font-medium hover:border-[var(--mx-accent)]"
              onClick={() =>
                startDirectionsTo(searchFromSlot("work", homeWork.work!))
              }
            >
              <Briefcase size={12} className="text-[var(--mx-accent)]" />
              Work
            </button>
          ) : null}
        </div>
      ) : null}

      {idle ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Categories">
          {EXPLORE_CATEGORIES.slice(0, 10).map((c) => {
            const on = activeCategory === c.category;
            return (
              <button
                key={c.category}
                type="button"
                aria-pressed={on}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  on
                    ? "border-[var(--mx-accent)] bg-[color-mix(in_srgb,var(--mx-accent)_14%,transparent)] text-[var(--mx-text)]"
                    : "border-[var(--mx-border)] bg-[var(--mx-surface-2)] text-[var(--mx-text-muted)] hover:border-[var(--mx-accent)] hover:text-[var(--mx-text)]"
                }`}
                onClick={() => pickCategory(c.label, c.category)}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {error ? (
        <EmptyState
          title="Search failed"
          description={error}
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setError(null);
                setSearchQuery(searchQuery.trim() ? `${searchQuery} ` : "cafe");
              }}
            >
              Try again
            </Button>
          }
        />
      ) : null}

      {selectedPlace || selectedSearch ? (
        <div className="space-y-2">
          <PlaceDetailCard
            place={selectedPlace}
            search={selectedSearch}
          />
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-[var(--mx-text-muted)]"
            onClick={() => useAppStore.getState().openPanel("report")}
          >
            Report an issue
          </Button>
        </div>
      ) : null}

      {searchResults.length > 0 ? (
        <ul className="space-y-1" aria-label="Search results">
          {searchResults.map((r) => {
            const starred = favIds.has(r.id);
            return (
              <li key={r.id}>
                <div className="flex items-stretch gap-1 rounded-xl hover:bg-[var(--mx-surface-muted)]">
                  <button
                    type="button"
                    onClick={() => void selectResult(r)}
                    className="flex min-w-0 flex-1 items-start gap-3 px-3 py-2 text-left"
                  >
                    <MapPin className="mt-0.5 shrink-0 text-primary" size={16} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {r.label}
                      </span>
                      <span className="block truncate text-xs text-[var(--mx-text-muted)]">
                        {r.address ?? r.category ?? r.kind}
                        {r.verified ? " · verified" : " · unverified"}
                        {r.source === "geocoder" ? " · geocoder" : ""}
                      </span>
                    </span>
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="my-1.5 h-9 w-9 shrink-0"
                    aria-label={
                      starred
                        ? `Remove ${r.label} from favorites`
                        : `Save ${r.label} to favorites`
                    }
                    aria-pressed={starred}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(r);
                    }}
                  >
                    <Star
                      size={14}
                      className={starred ? "fill-[var(--mx-accent)] text-[var(--mx-accent)]" : ""}
                    />
                  </Button>
                  {r.coordinates ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="my-1.5 mr-1.5 shrink-0 gap-1 px-2"
                      aria-label={`Directions to ${r.label}`}
                      onClick={(e) => directionsToResult(r, e)}
                    >
                      <Navigation2 size={14} />
                      <span className="hidden sm:inline">Go</span>
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : searchQuery.trim().length >= 2 && !loading && !error ? (
        <EmptyState
          title="No places found"
          description={`Nothing matched “${searchQuery.trim()}” near the map. Try a shorter query or a category chip.`}
        />
      ) : null}

      {idle && placesRecent.length > 0 ? (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--mx-text-muted)]">
              Recent places
            </div>
            <button
              type="button"
              className="text-[11px] text-[var(--mx-text-muted)] underline-offset-2 hover:underline"
              onClick={() => clearRecentSearches()}
            >
              Clear
            </button>
          </div>
          <ul className="space-y-1">
            {placesRecent.slice(0, 6).map((r) => {
              const result = searchFromRecent(r);
              return (
                <li key={r.id}>
                  <div className="flex items-stretch gap-1 rounded-xl hover:bg-[var(--mx-surface-muted)]">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm"
                      onClick={() => {
                        setSearchQuery(r.label);
                        void selectResult(result);
                      }}
                    >
                      <Clock
                        size={14}
                        className="shrink-0 text-[var(--mx-text-muted)]"
                      />
                      <span className="min-w-0">
                        <span className="block truncate">{r.label}</span>
                        {r.address ? (
                          <span className="block truncate text-[11px] text-[var(--mx-text-muted)]">
                            {r.address}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="my-1 mr-1 shrink-0 gap-1"
                      aria-label={`Directions to ${r.label}`}
                      onClick={() => startDirectionsTo(result)}
                    >
                      <Navigation2 size={14} />
                      <span className="hidden sm:inline">Go</span>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {idle && favorites.length > 0 ? (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--mx-text-muted)]">
              Favorites
            </div>
          </div>
          <ul className="space-y-1">
            {favorites.slice(0, 8).map((fav) => (
              <li key={fav.id}>
                <div className="flex items-stretch gap-1 rounded-xl hover:bg-[var(--mx-surface-muted)]">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm"
                    onClick={() => {
                      const result = searchFromFavorite(fav);
                      setSearchQuery(fav.label);
                      void selectResult(result);
                    }}
                  >
                    <Star
                      size={14}
                      className="shrink-0 fill-[var(--mx-accent)] text-[var(--mx-accent)]"
                    />
                    <span className="min-w-0 truncate">{fav.label}</span>
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="my-1 mr-1 shrink-0"
                    aria-label={`Directions to ${fav.label}`}
                    onClick={() =>
                      startDirectionsTo(searchFromFavorite(fav))
                    }
                  >
                    <Navigation2 size={14} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {idle && placesRecent.length === 0 && queriesRecent.length > 0 ? (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--mx-text-muted)]">
              Recent searches
            </div>
            <button
              type="button"
              className="text-[11px] text-[var(--mx-text-muted)] underline-offset-2 hover:underline"
              onClick={() => clearRecentSearches()}
            >
              Clear
            </button>
          </div>
          <ul className="space-y-1">
            {queriesRecent.map((q) => (
              <li key={q}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-[var(--mx-surface-muted)]"
                  onClick={() => setSearchQuery(q)}
                >
                  <Clock
                    size={14}
                    className="shrink-0 text-[var(--mx-text-muted)]"
                  />
                  <span className="truncate">{q}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {idle &&
      favorites.length === 0 &&
      placesRecent.length === 0 &&
      queriesRecent.length === 0 &&
      !selectedPlace &&
      !selectedSearch ? (
        <EmptyState
          title="Find a place"
          description="Type an address or name, or tap a category. Star results to keep them on this device — recent places get one-tap Directions."
        />
      ) : null}
    </div>
  );
}
