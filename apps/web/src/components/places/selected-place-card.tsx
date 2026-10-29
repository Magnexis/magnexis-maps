"use client";

import { useState } from "react";
import {
  Bookmark,
  Clock,
  ExternalLink,
  Navigation2,
  Phone,
  Share2,
  Star,
  View,
  X,
} from "lucide-react";
import { Button } from "@magnexis/ui";
import type { Place, SearchResult } from "@magnexis/shared";
import { useAppStore } from "@/lib/store";
import { mapillaryConfigured } from "@/lib/mapillary";
import { openStreetViewAt } from "@/lib/open-street-view";
import { PlacePhoto } from "@/components/places/place-photo";
import {
  extractPlaceContact,
  formatHoursLines,
  placePhoneHref,
} from "@/lib/place-contact";
import {
  savePlaceToAccount,
  sharePlace,
  startDirectionsTo,
} from "@/lib/place-actions";

type Props = {
  place: Place | null;
  search: SearchResult | null;
};

/**
 * Compact bottom card when the sheet is collapsed but a place is selected
 * (Google Maps–style peek over the map).
 */
export function SelectedPlaceCard({ place, search }: Props) {
  const {
    setSelectedPlace,
    setSelectedSearch,
    openPanel,
    favoritePlaces,
    toggleFavorite,
  } = useAppStore();
  const [streetLoading, setStreetLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const canStreetView = mapillaryConfigured();

  const maybeCoords = place?.coordinates ?? search?.coordinates ?? null;
  if (!maybeCoords) return null;
  const coords = maybeCoords;

  const title = place?.name ?? search?.label ?? "Selected place";
  const rawSubtitle = place
    ? [place.address, place.city, place.state].filter(Boolean).join(", ")
    : (search?.address ?? search?.category ?? "");
  // Geocoder hits often set label === address — don't repeat the same line.
  const subtitle =
    rawSubtitle &&
    rawSubtitle.trim().toLowerCase() !== title.trim().toLowerCase()
      ? rawSubtitle
      : place
        ? [place.city, place.state].filter(Boolean).join(", ")
        : search?.category &&
            search.category.trim().toLowerCase() !== title.trim().toLowerCase()
          ? search.category
          : "";

  const contact = extractPlaceContact(place?.properties);
  const hoursUi = formatHoursLines(contact);
  const asSearch: SearchResult =
    search ??
    ({
      id: place?.id ?? `place-${coords.lng}`,
      label: title,
      kind: "place",
      coordinates: coords,
      address: subtitle || undefined,
      source: "internal",
      verified: Boolean(place?.lastVerifiedAt),
    } as SearchResult);
  const starred = favoritePlaces.some((f) => f.id === asSearch.id);

  function clear() {
    setSelectedPlace(null);
    setSelectedSearch(null);
  }

  function goDirections() {
    startDirectionsTo(asSearch);
  }

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-3 md:justify-start md:pl-4 md:pr-[4.5rem] lg:pl-5 lg:pr-24"
      style={{ bottom: "var(--mx-peek-stack)" }}
    >
      <div className="mx-place-peek pointer-events-auto mx-enter w-full max-w-md rounded-2xl border bg-[var(--mx-surface-glass)] p-3 backdrop-blur-[var(--mx-blur)] sm:p-4 md:max-w-[min(100%,24rem)] lg:max-w-[26rem]">
        <PlacePhoto
          lng={coords.lng}
          lat={coords.lat}
          name={title}
          place={place}
          photoUrl={place?.photoUrl}
          variant="compact"
          className="mb-3"
        />
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-[0.95rem] font-semibold tracking-tight">
              {title}
            </h3>
            {subtitle ? (
              <p className="mt-0.5 truncate text-xs text-[var(--mx-text-muted)]">
                {subtitle}
              </p>
            ) : null}
            {(contact.hours || contact.phone) && (
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--mx-text-muted)]">
                {contact.hours ? (
                  <span
                    className="inline-flex max-w-[14rem] items-center gap-1"
                    title={hoursUi.detail ?? contact.hours}
                  >
                    <Clock size={11} aria-hidden />
                    {hoursUi.badge ? (
                      <span
                        className={
                          hoursUi.status === "open"
                            ? "font-medium text-emerald-500"
                            : hoursUi.status === "closed"
                              ? "font-medium text-amber-500"
                              : ""
                        }
                      >
                        {hoursUi.badge}
                      </span>
                    ) : (
                      <span className="truncate">{hoursUi.detail}</span>
                    )}
                  </span>
                ) : null}
                {contact.phone ? (
                  <a
                    href={placePhoneHref(contact.phone)}
                    className="inline-flex items-center gap-1 text-[var(--mx-accent)] hover:underline"
                  >
                    <Phone size={11} aria-hidden />
                    Call
                  </a>
                ) : null}
                {contact.website ? (
                  <a
                    href={contact.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[var(--mx-accent)] hover:underline"
                  >
                    <ExternalLink size={11} aria-hidden />
                    Web
                  </a>
                ) : null}
              </div>
            )}
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            aria-label="Clear selection"
            onClick={clear}
          >
            <X size={16} />
          </Button>
        </div>
        <div className="mt-3.5 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="primary"
            className="min-w-0 flex-[1.4] gap-1.5 !rounded-full"
            onClick={goDirections}
          >
            <Navigation2 size={14} />
            Go
          </Button>
          {canStreetView ? (
            <Button
              size="sm"
              variant="secondary"
              className="gap-1.5"
              disabled={streetLoading}
              onClick={() => {
                setStreetLoading(true);
                void openStreetViewAt(coords.lng, coords.lat).finally(() =>
                  setStreetLoading(false),
                );
              }}
            >
              <View size={14} />
              {streetLoading ? "…" : "Street"}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="secondary"
            aria-label={starred ? "Remove favorite" : "Add favorite"}
            aria-pressed={starred}
            onClick={() => toggleFavorite(asSearch)}
          >
            <Star
              size={14}
              className={
                starred ? "fill-[var(--mx-accent)] text-[var(--mx-accent)]" : ""
              }
            />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            aria-label="Save to account"
            onClick={() => {
              setStatus(null);
              void savePlaceToAccount(title.slice(0, 100), coords, place?.id)
                .then(() => setStatus("Saved"))
                .catch(() => setStatus("Sign in to save"));
            }}
          >
            <Bookmark size={14} />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            aria-label="Share place"
            onClick={() => {
              setStatus(null);
              void sharePlace({ label: title, coordinates: coords })
                .then((o) =>
                  setStatus(
                    o === "cancelled"
                      ? null
                      : o === "shared"
                        ? "Shared"
                        : "Link copied",
                  ),
                )
                .catch(() => setStatus("Share failed"));
            }}
          >
            <Share2 size={14} />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => openPanel("search")}
          >
            Details
          </Button>
        </div>
        {status ? (
          <p
            className="mt-2 text-center text-[11px] text-[var(--mx-text-muted)]"
            role="status"
          >
            {status}
          </p>
        ) : null}
      </div>
    </div>
  );
}
