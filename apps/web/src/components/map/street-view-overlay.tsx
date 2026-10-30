"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { Button } from "@magnexis/ui";
import { useAppStore } from "@/lib/store";
import { mapillaryAccessToken } from "@/lib/mapillary";

/**
 * Full-bleed street-level viewer:
 * - MapillaryJS when a Mapillary image id is set
 * - MapillaryJS when a Mapillary image id is set
 */
export function StreetViewOverlay() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<{ remove: () => void } | null>(null);
  const imageId = useAppStore((s) => s.streetViewImageId);
  const error = useAppStore((s) => s.streetViewError);
  const closeStreetView = useAppStore((s) => s.closeStreetView);
  const setStreetViewError = useAppStore((s) => s.setStreetViewError);
  const [booting, setBooting] = useState(false);

  useEffect(() => {
    if (!imageId || !containerRef.current) return;
    const token = mapillaryAccessToken();
    if (!token) {
      setStreetViewError(
        "Set NEXT_PUBLIC_MAPILLARY_ACCESS_TOKEN (Mapillary developer client token).",
      );
      return;
    }

    let cancelled = false;
    setBooting(true);
    setStreetViewError(null);

    void (async () => {
      try {
        const { Viewer } = await import("mapillary-js");
        if (cancelled || !containerRef.current) return;

        viewerRef.current?.remove();
        viewerRef.current = null;
        containerRef.current.replaceChildren();

        const viewer = new Viewer({
          accessToken: token,
          container: containerRef.current,
          imageId,
          component: {
            cover: false,
            bearing: true,
            direction: true,
            sequence: true,
            zoom: true,
          },
        });
        viewerRef.current = viewer;
      } catch (err) {
        if (!cancelled) {
          setStreetViewError(
            err instanceof Error
              ? err.message
              : "Could not open Mapillary street imagery.",
          );
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();

    return () => {
      cancelled = true;
      try {
        viewerRef.current?.remove();
      } catch {
        // ignore dispose races
      }
      viewerRef.current = null;
    };
  }, [imageId, setStreetViewError]);

  // Error-only toast when a lookup fails before a viewer opens
  if (!imageId && error) {
    return (
      <div
        className="pointer-events-none absolute inset-x-0 z-[60] flex justify-center px-3"
        style={{ bottom: "var(--mx-peek-stack)" }}
      >
        <div className="pointer-events-auto flex max-w-md items-start gap-2 rounded-xl border border-amber-500/40 bg-[var(--mx-surface)] px-3 py-2 text-sm text-amber-200 shadow-[var(--mx-shadow-float)]">
          <p className="min-w-0 flex-1">{error}</p>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            aria-label="Dismiss"
            onClick={() => setStreetViewError(null)}
          >
            <X size={14} />
          </Button>
        </div>
      </div>
    );
  }

  if (!imageId) return null;

  return (
    <div
      className="absolute inset-0 z-[60] flex flex-col bg-[var(--mx-bg)]"
      role="dialog"
      aria-modal="true"
      aria-label="Street view"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--mx-border)] bg-[var(--mx-surface)] px-3 py-2 sm:px-4">
        <div className="min-w-0">
          <div className="font-display text-sm font-semibold tracking-tight">
            Street view
          </div>
          <p className="truncate text-[11px] text-[var(--mx-text-muted)]">
            Imagery ©{" "}
            <a
              className="underline-offset-2 hover:underline"
              href="https://www.mapillary.com/"
              target="_blank"
              rel="noreferrer"
            >
              Mapillary
            </a>{" "}
            contributors
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <a
            href={`https://www.mapillary.com/app/?pKey=${encodeURIComponent(imageId)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--mx-border)] px-3 text-xs text-[var(--mx-text-muted)] hover:text-[var(--mx-text)]"
          >
            <ExternalLink size={14} />
            Mapillary
          </a>
          <Button
            size="icon"
            variant="secondary"
            className="h-9 w-9"
            aria-label="Close street view"
            onClick={() => closeStreetView()}
          >
            <X size={16} />
          </Button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="absolute inset-0" />
        {booting ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--mx-bg)]/60 text-sm text-[var(--mx-text-muted)]">
            Loading street imagery…
          </div>
        ) : null}
        {error ? (
          <div className="absolute inset-x-4 bottom-4 rounded-xl border border-amber-500/40 bg-[var(--mx-surface)] px-3 py-2 text-sm text-amber-200 sm:inset-x-auto sm:left-4 sm:max-w-md">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
