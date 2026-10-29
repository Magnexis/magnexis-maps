"use client";

import { useState } from "react";
import { Button, EmptyState } from "@magnexis/ui";
import { EXPLORE_CATEGORIES } from "@magnexis/shared";
import { getApiClient } from "@/lib/api";
import { useAppStore } from "@/lib/store";

export function ExplorePanel({ hideHeader = false }: { hideHeader?: boolean }) {
  const { mapView, setSearchResults, setSearchQuery, openPanel, apiHealthy } =
    useAppStore();
  const [loadingCategory, setLoadingCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function explore(category: string, label: string) {
    setError(null);
    setLoadingCategory(category);
    try {
      const { places } = await getApiClient().nearbyPlaces({
        lng: mapView.center.lng,
        lat: mapView.center.lat,
        radiusMeters: 25_000,
        category,
        limit: 20,
      });
      setSearchQuery(label);
      setSearchResults(
        places.map((p) => ({
          id: p.id,
          label: p.name,
          kind: "place" as const,
          category: p.category,
          coordinates: p.coordinates,
          address: p.address ?? undefined,
          source: "internal" as const,
          verified: Boolean(p.lastVerifiedAt),
        })),
      );
      if (places.length === 0) {
        setError(
          `No ${label.toLowerCase()} found within ~25 km of the map center. Pan the map and try again.`,
        );
        return;
      }
      openPanel("search");
    } catch {
      setError(
        apiHealthy === false
          ? "API looks offline — start the Magnexis API to explore nearby places."
          : "Nearby search failed. Check your connection and try again.",
      );
    } finally {
      setLoadingCategory(null);
    }
  }

  return (
    <div className="space-y-4">
      {!hideHeader ? (
        <div>
          <h2 className="font-display text-lg font-semibold">Explore</h2>
          <p className="text-sm text-[var(--mx-text-muted)]">
            Nearby categories from the Magnexis places index around your map
            center.
          </p>
        </div>
      ) : (
        <p className="text-xs text-[var(--mx-text-muted)]">
          Pick a category to list real places near the map center.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {EXPLORE_CATEGORIES.map((c) => (
          <Button
            key={c.category}
            variant="secondary"
            disabled={loadingCategory !== null}
            aria-busy={loadingCategory === c.category}
            onClick={() => void explore(c.category, c.label)}
          >
            {loadingCategory === c.category ? "Searching…" : c.label}
          </Button>
        ))}
      </div>
      {error ? (
        <EmptyState
          title="Nothing to show"
          description={error}
          action={
            <Button
              size="sm"
              variant="secondary"
              disabled={loadingCategory !== null}
              onClick={() => {
                const first = EXPLORE_CATEGORIES[0];
                if (first) void explore(first.category, first.label);
              }}
            >
              Retry nearby
            </Button>
          }
        />
      ) : null}
    </div>
  );
}
