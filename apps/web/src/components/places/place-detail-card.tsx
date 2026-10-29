"use client";

import { useState } from "react";
import {
  Bookmark,
  Clock,
  Compass,
  ExternalLink,
  Navigation2,
  Phone,
  Share2,
  Star,
} from "lucide-react";
import { Button } from "@magnexis/ui";
import type { Place, SearchResult } from "@magnexis/shared";
import { getApiClient } from "@/lib/api";
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
import { useAppStore } from "@/lib/store";
import { PlacePhoto } from "@/components/places/place-photo";

type Props = {
  place: Place | null;
  search: SearchResult | null;
  onDirections?: () => void;
};

export function PlaceDetailCard({ place, search, onDirections }: Props) {
  const {
    setSearchResults,
    setSearchQuery,
    openPanel,
    favoritePlaces,
    toggleFavorite,
  } = useAppStore();
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);

  const coords = place?.coordinates ?? search?.coordinates ?? null;
  const title = place?.name ?? search?.label ?? "Selected place";
  const rawSubtitle = place
    ? [place.address, place.city, place.state].filter(Boolean).join(", ")
    : (search?.address ?? search?.category ?? "");
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
  const asSearch: SearchResult | null =
    search ??
    (coords
      ? {
          id: place?.id ?? `place-${coords.lng}`,
          label: title,
          kind: "place",
          coordinates: coords,
          address: subtitle || undefined,
          source: "internal",
          verified: Boolean(place?.lastVerifiedAt),
        }
      : null);
  const starred = asSearch
    ? favoritePlaces.some((f) => f.id === asSearch.id)
    : false;

  if (!coords && !place && !search) return null;

  async function handleSave() {
    if (!coords) return;
    setSaveMsg(null);
    try {
      await savePlaceToAccount(title.slice(0, 100), coords, place?.id);
      setSaveMsg("Saved to your account");
    } catch {
      setSaveMsg("Sign in to save places");
    }
  }

  async function handleShare() {
    if (!coords) return;
    setShareMsg(null);
    try {
      const outcome = await sharePlace({ label: title, coordinates: coords });
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
  }

  async function handleNearby() {
    if (!coords) return;
    setNearbyLoading(true);
    try {
      const category = place?.category ?? search?.category ?? "business";
      const { places } = await getApiClient().nearbyPlaces({
        lng: coords.lng,
        lat: coords.lat,
        radiusMeters: 5000,
        category,
        limit: 15,
      });
      setSearchQuery(`Near ${title}`);
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
      openPanel("search");
    } catch {
      setShareMsg("Nearby search unavailable");
    } finally {
      setNearbyLoading(false);
    }
  }

  function handleDirections() {
    if (onDirections) {
      onDirections();
      return;
    }
    if (!asSearch) return;
    startDirectionsTo(asSearch);
  }

  return (
    <div className="rounded-2xl border border-[var(--mx-border)] bg-[var(--mx-surface-muted)] p-3 sm:p-4">
      {coords ? (
        <PlacePhoto
          lng={coords.lng}
          lat={coords.lat}
          name={title}
          place={place}
          photoUrl={place?.photoUrl}
          variant="hero"
          className="mb-3"
        />
      ) : null}
      <div className="text-xs uppercase tracking-wider text-[var(--mx-text-muted)]">
        Place
      </div>
      <div className="mt-1 font-display text-base font-semibold tracking-tight">
        {title}
      </div>
      {subtitle ? (
        <p className="mt-0.5 text-sm text-[var(--mx-text-muted)]">{subtitle}</p>
      ) : null}

      {(contact.hours || contact.phone || contact.website) && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {contact.hours ? (
            <li className="flex items-start gap-2 text-[var(--mx-text-muted)]">
              <Clock size={14} className="mt-0.5 shrink-0" aria-hidden />
              <span className="min-w-0">
                {hoursUi.badge ? (
                  <>
                    <span
                      className={
                        hoursUi.status === "open"
                          ? "font-medium text-emerald-500"
                          : "font-medium text-amber-500"
                      }
                    >
                      {hoursUi.badge}
                    </span>
                    {hoursUi.detail && hoursUi.detail !== hoursUi.badge ? (
                      <span className="mt-0.5 block text-xs opacity-80">
                        {hoursUi.detail}
                      </span>
                    ) : null}
                  </>
                ) : (
                  (hoursUi.detail ?? contact.hours)
                )}
              </span>
            </li>
          ) : null}
          {contact.phone ? (
            <li>
              <a
                href={placePhoneHref(contact.phone)}
                className="flex items-center gap-2 text-[var(--mx-accent)] hover:underline"
              >
                <Phone size={14} className="shrink-0" aria-hidden />
                {contact.phone}
              </a>
            </li>
          ) : null}
          {contact.website ? (
            <li>
              <a
                href={contact.website}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-[var(--mx-accent)] hover:underline"
              >
                <ExternalLink size={14} className="shrink-0" aria-hidden />
                Website
              </a>
            </li>
          ) : null}
        </ul>
      )}

      {place ? (
        <p className="mt-2 text-xs text-[var(--mx-text-muted)]">
          Source: {place.sourceName}
          {place.lastVerifiedAt
            ? ` · Verified ${place.lastVerifiedAt}`
            : " · Not independently verified"}
        </p>
      ) : search ? (
        <p className="mt-2 text-xs text-[var(--mx-text-muted)]">
          {search.verified ? "Verified listing" : "Unverified listing"}
          {search.source === "geocoder" ? " · geocoder" : ""}
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button
          size="sm"
          variant="primary"
          className="col-span-2 gap-1.5 sm:col-span-4"
          onClick={handleDirections}
        >
          <Navigation2 size={14} />
          Directions
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="gap-1"
          onClick={() => void handleSave()}
        >
          <Bookmark size={14} />
          Save
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="gap-1"
          aria-pressed={starred}
          disabled={!asSearch}
          onClick={() => asSearch && toggleFavorite(asSearch)}
        >
          <Star
            size={14}
            className={
              starred ? "fill-[var(--mx-accent)] text-[var(--mx-accent)]" : ""
            }
          />
          {starred ? "Starred" : "Star"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="gap-1"
          onClick={() => void handleShare()}
        >
          <Share2 size={14} />
          Share
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="col-span-2 gap-1 sm:col-span-4"
          disabled={nearbyLoading}
          onClick={() => void handleNearby()}
        >
          <Compass size={14} />
          {nearbyLoading ? "Loading…" : "Nearby"}
        </Button>
      </div>
      {saveMsg ? (
        <p className="mt-2 text-xs text-[var(--mx-text-muted)]" role="status">
          {saveMsg}
        </p>
      ) : null}
      {shareMsg ? (
        <p className="mt-1 text-xs text-[var(--mx-text-muted)]" role="status">
          {shareMsg}
        </p>
      ) : null}
    </div>
  );
}
