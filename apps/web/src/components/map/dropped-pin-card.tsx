"use client";

import { useState } from "react";
import { Bookmark, MapPin, Navigation2, Share2, View, X } from "lucide-react";
import { Button } from "@magnexis/ui";
import { savePlaceToAccount, sharePlace } from "@/lib/place-actions";
import { mapillaryConfigured } from "@/lib/mapillary";
import { openStreetViewAt } from "@/lib/open-street-view";
import { PlacePhoto } from "@/components/places/place-photo";

export type DroppedPinInfo = {
  lng: number;
  lat: number;
  title: string;
  /** Secondary context (e.g. category / map-label hint). */
  subtitle?: string;
  /** Full reverse-geocoded address (street, city, ZIP…). */
  address?: string;
  detail?: string;
  loading?: boolean;
};

type Props = {
  pin: DroppedPinInfo | null;
  onClose: () => void;
  onDirections: () => void;
};

function formatCoords(lat: number, lng: number) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function DroppedPinCard({ pin, onClose, onDirections }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [streetLoading, setStreetLoading] = useState(false);
  const canStreetView = mapillaryConfigured();

  if (!pin) return null;

  const titleText = pin.loading ? "Looking up this place…" : pin.title;
  const addressLine = pin.loading
    ? "Looking up address…"
    : pin.address?.trim() || formatCoords(pin.lat, pin.lng);
  const addressIsCoords = !pin.loading && !pin.address?.trim();
  const addressDuplicatesTitle =
    !pin.loading &&
    Boolean(pin.address?.trim()) &&
    pin.address!.trim().toLowerCase() === pin.title.trim().toLowerCase();
  const showSubtitle =
    Boolean(pin.subtitle) &&
    !pin.loading &&
    pin.subtitle!.trim().toLowerCase() !== pin.title.trim().toLowerCase();

  async function handleSave() {
    setStatus(null);
    try {
      await savePlaceToAccount(pin!.title.slice(0, 100), {
        lng: pin!.lng,
        lat: pin!.lat,
      });
      setStatus("Saved to your account");
    } catch {
      setStatus("Sign in to save");
    }
  }

  async function handleShare() {
    setStatus(null);
    try {
      const outcome = await sharePlace({
        label: pin!.title,
        coordinates: { lng: pin!.lng, lat: pin!.lat },
      });
      setStatus(
        outcome === "cancelled"
          ? null
          : outcome === "shared"
            ? "Shared"
            : "Link copied",
      );
    } catch {
      setStatus("Couldn’t share — try again");
    }
  }

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-3 md:justify-start md:pl-4 lg:pl-5"
      style={{ bottom: "var(--mx-peek-stack)" }}
    >
      <div className="pointer-events-auto mx-enter w-full max-w-md rounded-2xl border border-[var(--mx-border)] bg-[var(--mx-surface-glass)] p-3 shadow-[var(--mx-shadow-float)] backdrop-blur-[var(--mx-blur)] sm:p-4 md:max-w-[26rem] lg:max-w-[28rem]">
        {!pin.loading ? (
          <PlacePhoto
            key={`pin-photo-${pin.lng.toFixed(5)}-${pin.lat.toFixed(5)}`}
            lng={pin.lng}
            lat={pin.lat}
            name={pin.title}
            intent="map_pin"
            variant="compact"
            className="mb-3"
          />
        ) : null}
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--mx-accent)]/15 text-[var(--mx-accent)]">
            <MapPin size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-sm font-semibold tracking-tight text-[var(--mx-text)]">
              {titleText}
            </h3>
            {showSubtitle ? (
              <p className="mt-0.5 truncate text-xs text-[var(--mx-text-muted)]">
                {pin.subtitle}
              </p>
            ) : null}
            {!addressDuplicatesTitle ? (
              <p
                className={
                  addressIsCoords
                    ? "mt-1 font-mono text-[11px] text-[var(--mx-text-muted)]"
                    : "mt-1 text-[11px] leading-snug text-[var(--mx-text-muted)]"
                }
              >
                {addressLine}
              </p>
            ) : null}
            {pin.detail && !pin.loading ? (
              <p className="mt-1 text-[11px] text-[var(--mx-text-muted)]">
                {pin.detail}
              </p>
            ) : null}
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-10 w-10 shrink-0 sm:h-9 sm:w-9"
            aria-label="Close dropped pin"
            onClick={onClose}
          >
            <X size={14} />
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button
            size="sm"
            variant="primary"
            className="col-span-3 min-h-10 gap-1.5"
            onClick={onDirections}
            disabled={pin.loading}
          >
            <Navigation2 size={14} />
            Directions
          </Button>
          {canStreetView ? (
            <Button
              size="sm"
              variant="secondary"
              className="col-span-3 gap-1.5"
              disabled={pin.loading || streetLoading}
              onClick={() => {
                setStreetLoading(true);
                setStatus(null);
                void openStreetViewAt(pin.lng, pin.lat).then((ok) => {
                  setStreetLoading(false);
                  if (!ok) setStatus("No street imagery nearby");
                });
              }}
            >
              <View size={14} />
              {streetLoading ? "Looking up…" : "Street view"}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="secondary"
            className="gap-1"
            onClick={() => void handleSave()}
            disabled={pin.loading}
          >
            <Bookmark size={14} />
            Save
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="col-span-2 gap-1"
            onClick={() => void handleShare()}
            disabled={pin.loading}
          >
            <Share2 size={14} />
            Share
          </Button>
        </div>
        {status ? (
          <p className="mt-2 text-center text-[11px] text-[var(--mx-text-muted)]">
            {status}
          </p>
        ) : null}
      </div>
    </div>
  );
}
