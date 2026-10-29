"use client";

import { useEffect, useState } from "react";
import { getApiClient } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { resolveTrafficSource, trafficConfigured } from "@/lib/traffic";
import { mapillaryConfigured } from "@/lib/mapillary";
import { fetchGoogleProviderStatus } from "@/lib/google-maps";

type StyleInfo = {
  id: "standard" | "dark" | "terrain" | "satellite";
  label: string;
  available: boolean;
  reasonUnavailable?: string;
};

export function LayersPanel({ hideHeader = false }: { hideHeader?: boolean }) {
  const {
    layers,
    toggleLayer,
    styleId,
    setStyleId,
    settings,
    patchSettings,
  } = useAppStore();
  const [styles, setStyles] = useState<StyleInfo[]>([]);
  const [googleConfigured, setGoogleConfigured] = useState(false);

  useEffect(() => {
    void fetchGoogleProviderStatus()
      .then((d) => setGoogleConfigured(d.configured))
      .catch(() => setGoogleConfigured(false));
  }, []);

  useEffect(() => {
    void getApiClient()
      .mapStyles()
      .then((res) => setStyles(res.styles as StyleInfo[]))
      .catch(() =>
        setStyles([
          { id: "standard", label: "Magnexis Standard", available: true },
          { id: "dark", label: "Magnexis Night", available: true },
          {
            id: "terrain",
            label: "Terrain",
            available: false,
            reasonUnavailable: "MapTiler terrain unavailable — check API key",
          },
          {
            id: "satellite",
            label: "Satellite",
            available: false,
            reasonUnavailable: "MapTiler satellite unavailable — check API key",
          },
        ]),
      );
  }, []);

  return (
    <div className="space-y-4">
      {!hideHeader ? (
        <div>
          <h2 className="font-display text-lg font-semibold">Map Appearance</h2>
          <p className="text-sm text-[var(--mx-text-muted)]">
            Magnexis Chromatic basemaps, symbols, and overlays.
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-wider text-[var(--mx-text-muted)]">
          Basemap
        </div>
        {styles.map((s) => (
          <label
            key={s.id}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2 ${
              styleId === s.id
                ? "border-primary bg-primary/10"
                : "border-[var(--mx-border)]"
            } ${!s.available ? "opacity-50" : ""}`}
          >
            <input
              type="radio"
              name="style"
              disabled={!s.available}
              checked={
                s.id === "standard"
                  ? styleId === "standard" &&
                    settings.chromaticTheme === "standard"
                  : s.id === "dark"
                    ? styleId === "dark" &&
                      settings.chromaticTheme === "night"
                    : styleId === s.id
              }
              onChange={() => {
                if (!s.available) return;
                setStyleId(s.id);
                patchSettings({
                  chromaticTheme: s.id === "standard" ? "standard" : "night",
                });
              }}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">{s.label}</span>
              {!s.available && s.reasonUnavailable ? (
                <span className="block text-xs text-[var(--mx-text-muted)]">
                  {s.reasonUnavailable}
                </span>
              ) : null}
            </span>
          </label>
        ))}
        <label
          className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2 ${
            settings.chromaticTheme === "high-contrast"
              ? "border-primary bg-primary/10"
              : "border-[var(--mx-border)]"
          }`}
        >
          <input
            type="radio"
            name="chromatic-extra"
            checked={settings.chromaticTheme === "high-contrast"}
            onChange={() => {
              setStyleId("standard");
              patchSettings({ chromaticTheme: "high-contrast" });
            }}
            className="mt-1"
          />
          <span className="block text-sm font-medium">
            Magnexis High Contrast
          </span>
        </label>
        <label
          className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2 ${
            settings.chromaticTheme === "navigation"
              ? "border-primary bg-primary/10"
              : "border-[var(--mx-border)]"
          }`}
        >
          <input
            type="radio"
            name="chromatic-extra"
            checked={settings.chromaticTheme === "navigation"}
            onChange={() => {
              setStyleId("dark");
              patchSettings({ chromaticTheme: "navigation" });
            }}
            className="mt-1"
          />
          <span className="block text-sm font-medium">
            Magnexis Navigation
          </span>
        </label>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-wider text-[var(--mx-text-muted)]">
          Map symbols
        </div>
        {(
          [
            ["all", "Show all available categories"],
            ["essential", "Essential symbols only"],
            ["hidden", "Hide optional POIs"],
          ] as const
        ).map(([value, label]) => (
          <label
            key={value}
            className="flex items-center justify-between rounded-xl border border-[var(--mx-border)] px-3 py-2 text-sm"
          >
            {label}
            <input
              type="radio"
              name="poi-density"
              checked={settings.poiDensity === value}
              onChange={() => {
                patchSettings({ poiDensity: value });
                if (value === "hidden" && layers.poi) toggleLayer("poi");
                if (value !== "hidden" && !layers.poi) toggleLayer("poi");
              }}
            />
          </label>
        ))}
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-wider text-[var(--mx-text-muted)]">
          3D
        </div>
        <label
          className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm ${
            settings.buildings3d
              ? "border-primary bg-primary/10"
              : "border-[var(--mx-border)]"
          }`}
        >
          <span>
            <span className="block font-medium">3D buildings</span>
            <span className="mt-0.5 block text-[11px] text-[var(--mx-text-muted)]">
              Extrude buildings and tilt the map (Apple Maps–style). Best at
              city zoom.
            </span>
          </span>
          <input
            type="checkbox"
            className="mt-1"
            checked={settings.buildings3d}
            onChange={(e) => patchSettings({ buildings3d: e.target.checked })}
          />
        </label>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-wider text-[var(--mx-text-muted)]">
          Details
        </div>
        {(
          [
            ["showHighwayShields", "Highway shields"],
            ["showRoadNames", "Road names"],
            ["showBuildingFootprints", "Building footprints"],
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            className="flex items-center justify-between rounded-xl border border-[var(--mx-border)] px-3 py-2 text-sm"
          >
            {label}
            <input
              type="checkbox"
              checked={settings[key]}
              onChange={(e) => patchSettings({ [key]: e.target.checked })}
            />
          </label>
        ))}
        {trafficConfigured() ? (
          <label className="flex items-center justify-between rounded-xl border border-[var(--mx-border)] px-3 py-2 text-sm">
            <span>
              Live traffic
              <span className="mt-0.5 block text-[11px] text-[var(--mx-text-muted)]">
                {resolveTrafficSource()?.provider ?? "tiles"} congestion · press
                T to toggle
              </span>
            </span>
            <input
              type="checkbox"
              checked={layers.traffic}
              onChange={() => toggleLayer("traffic")}
            />
          </label>
        ) : (
          <label className="flex items-center justify-between rounded-xl border border-[var(--mx-border)] px-3 py-2 text-sm opacity-50">
            Live traffic
            <input type="checkbox" disabled checked={false} readOnly />
          </label>
        )}
        {mapillaryConfigured() ? (
          <label className="flex items-center justify-between rounded-xl border border-[var(--mx-border)] px-3 py-2 text-sm">
            <span>
              Street view
              <span className="mt-0.5 block text-[11px] text-[var(--mx-text-muted)]">
                Mapillary coverage · click green dots
                {googleConfigured ? " · Google fallback" : ""}
              </span>
            </span>
            <input
              type="checkbox"
              checked={layers.streetView}
              onChange={() => toggleLayer("streetView")}
            />
          </label>
        ) : (
          <label className="flex items-center justify-between rounded-xl border border-[var(--mx-border)] px-3 py-2 text-sm opacity-50">
            Street view
            <input type="checkbox" disabled checked={false} readOnly />
          </label>
        )}
        <p className="text-[11px] text-[var(--mx-text-muted)]">
          {[
            !trafficConfigured()
              ? "Traffic needs TOMTOM_API_KEY on the API (pnpm secrets:tomtom), Mapbox, or NEXT_PUBLIC_TRAFFIC_TILES_URL."
              : "Live traffic uses TomTom flow tiles via the Magnexis API proxy.",
            !mapillaryConfigured()
              ? "Street view coverage overlay needs NEXT_PUBLIC_MAPILLARY_ACCESS_TOKEN from mapillary.com/dashboard/developers."
              : "Street view uses Mapillary community imagery (CC BY-SA).",
            googleConfigured
              ? "Google enrichment is on (Places photos + Street View Static fallback via API proxy)."
              : "Optional: set GOOGLE_MAPS_API_KEY on the API (pnpm secrets:google) for Places photos and Street View fallback.",
            "Indoor maps are not available in this build.",
          ]
            .filter(Boolean)
            .join(" ")}
        </p>
        {(
          [
            ["hotspots", "Hotspots"],
            ["poi", "Points of interest"],
            ["community", "Community issues"],
            ["incidents", "Reported incidents"],
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            className="flex items-center justify-between rounded-xl border border-[var(--mx-border)] px-3 py-2 text-sm"
          >
            <span>
              {label}
              {key === "hotspots" ? (
                <span className="mt-0.5 block text-[11px] text-[var(--mx-text-muted)]">
                  Red circles estimate activity from public-place density — not live foot traffic.
                </span>
              ) : null}
            </span>
            <input
              type="checkbox"
              checked={layers[key]}
              onChange={() => toggleLayer(key)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
