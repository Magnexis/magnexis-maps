"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Place } from "@magnexis/shared";
import { usePlacePhoto } from "@/hooks/use-place-photo";
import type { PlacePhotoIntent } from "@/lib/place-photo";

type Props = {
  lng: number;
  lat: number;
  name?: string | null;
  place?: Place | null;
  photoUrl?: string | null;
  properties?: Record<string, unknown> | null;
  /** Tall hero for detail panels; compact strip for peek cards. */
  variant?: "hero" | "compact";
  /** `map_pin` skips Wikipedia so drops don't share one landmark photo. */
  intent?: PlacePhotoIntent;
  className?: string;
};

/**
 * Real photograph for a place / pin (Google Places → Mapillary → listing → Wikimedia).
 * Shows loading → image(s), or an honest “No photo nearby” when all sources fail.
 * When multiple sources hit, a small carousel lets you flip between them.
 */
export function PlacePhoto({
  lng,
  lat,
  name,
  place,
  photoUrl,
  properties,
  variant = "hero",
  intent = "place",
  className = "",
}: Props) {
  const { url, attribution, loading, photos, index, setIndex } = usePlacePhoto(
    lng,
    lat,
    {
      place,
      name,
      photoUrl: photoUrl ?? place?.photoUrl,
      properties: properties ?? place?.properties,
      intent,
    },
  );

  const height = variant === "compact" ? "h-28 sm:h-32" : "h-40 sm:h-48";
  const multi = photos.length > 1;

  if (loading) {
    return (
      <div
        className={`w-full animate-pulse rounded-xl bg-[var(--mx-surface-2)] ${height} ${className}`}
        aria-busy="true"
        aria-label="Loading place photo"
      />
    );
  }

  if (!url) {
    return (
      <div
        className={`flex w-full items-center justify-center rounded-xl border border-dashed border-[var(--mx-border)] bg-[var(--mx-surface-2)]/60 px-3 text-center text-[11px] text-[var(--mx-text-muted)] ${height} ${className}`}
      >
        No photo nearby
      </div>
    );
  }

  return (
    <figure
      className={`relative w-full overflow-hidden rounded-xl ${height} ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- remote Mapillary/Wikimedia URLs */}
      <img
        src={url}
        alt={
          name
            ? `Photo of ${name}${multi ? ` (${index + 1} of ${photos.length})` : ""}`
            : "Place photo"
        }
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
      {attribution ? (
        <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-2 pb-1.5 pt-6 text-[10px] text-white/90">
          {attribution}
          {multi ? ` · ${index + 1}/${photos.length}` : ""}
        </figcaption>
      ) : null}
      {multi ? (
        <>
          <button
            type="button"
            className="absolute left-1.5 top-1/2 z-[1] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/60"
            aria-label="Previous photo"
            onClick={() => setIndex(index - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="absolute right-1.5 top-1/2 z-[1] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/60"
            aria-label="Next photo"
            onClick={() => setIndex(index + 1)}
          >
            <ChevronRight size={16} />
          </button>
          <div
            className="absolute bottom-7 left-1/2 z-[1] flex -translate-x-1/2 gap-1"
            role="tablist"
            aria-label="Photo sources"
          >
            {photos.map((_, i) => (
              <button
                key={photos[i]!.url}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Photo ${i + 1}`}
                className={`h-1.5 rounded-full transition ${
                  i === index ? "w-3 bg-white" : "w-1.5 bg-white/50"
                }`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        </>
      ) : null}
    </figure>
  );
}
