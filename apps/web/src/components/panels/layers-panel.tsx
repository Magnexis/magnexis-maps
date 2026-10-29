"use client";

import { useEffect, useState } from "react";
import { getApiClient } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { resolveTrafficSource, trafficConfigured } from "@/lib/traffic";
import { mapillaryConfigured } from "@/lib/mapillary";
import { fetchGoogleProviderStatus } from "@/lib/google-maps";
import { MapChoiceRow } from "@/components/ui/map-choice";

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

  const streetViewAvailable = mapillaryConfigured() || googleConfigured;

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
        {styles.map((s) => {
          const selected =
            s.id === "standard"
              ? styleId === "standard" &&
                settings.chromaticTheme === "standard"
              : s.id === "dark"
                ? styleId === "dark" && settings.chromaticTheme === "night"
                : styleId === s.id;
          return (
            <MapChoiceRow
              key={s.id}
              selected={selected}
              disabled={!s.available}
              title={s.label}
              description={
                !s.available && s.reasonUnavailable
                  ? s.reasonUnavailable
                  : undefined
              }
              onSelect={() => {
                if (!s.available) return;
                setStyleId(s.id);
                patchSettings({
                  chromaticTheme: s.id === "standard" ? "standard" : "night",
                });
              }}
            />
          );
        })}
        <MapChoiceRow
          selected={settings.chromaticTheme === "high-contrast"}
          title="Magnexis High Contrast"
          onSelect={() => {
            setStyleId("standard");
            patchSettings({ chromaticTheme: "high-contrast" });
          }}
        />
        <MapChoiceRow
          selected={settings.chromaticTheme === "navigation"}
          title="Magnexis Navigation"
          onSelect={() => {
            setStyleId("dark");
            patchSettings({ chromaticTheme: "navigation" });
          }}
        />
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
          <MapChoiceRow
            key={value}
            selected={settings.poiDensity === value}
            title={label}
            onSelect={() => {
              patchSettings({ poiDensity: value });
              if (value === "hidden" && layers.poi) toggleLayer("poi");
              if (value !== "hidden" && !layers.poi) toggleLayer("poi");
            }}
          />
        ))}
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-wider text-[var(--mx-text-muted)]">
          3D
        </div>
        <MapChoiceRow
          multi
          selected={settings.buildings3d}
          title="3D buildings"
          description="Extrude buildings and tilt the map. Best at city zoom."
          onSelect={() => patchSettings({ buildings3d: !settings.buildings3d })}
        />
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
          <MapChoiceRow
            key={key}
            multi
            selected={settings[key]}
            title={label}
            onSelect={() => patchSettings({ [key]: !settings[key] })}
          />
        ))}
        {trafficConfigured() ? (
          <MapChoiceRow
            multi
            selected={layers.traffic}
            title="Live traffic"
            description={`${resolveTrafficSource()?.provider ?? "tiles"} congestion · press T to toggle`}
            onSelect={() => toggleLayer("traffic")}
          />
        ) : (
          <MapChoiceRow
            multi
            selected={false}
            disabled
            title="Live traffic"
            description="Needs TOMTOM_API_KEY on the API"
            onSelect={() => undefined}
          />
        )}
        {streetViewAvailable ? (
          <MapChoiceRow
            multi
            selected={layers.streetView}
            title="Street view"
            description={
              mapillaryConfigured()
                ? `Mapillary coverage · click green dots${
                    googleConfigured ? " · Google fallback" : ""
                  }`
                : "Google Street View · tap the map to open imagery"
            }
            onSelect={() => toggleLayer("streetView")}
          />
        ) : (
          <MapChoiceRow
            multi
            selected={false}
            disabled
            title="Street view"
            description="Needs Mapillary token and/or GOOGLE_MAPS_API_KEY on the API"
            onSelect={() => undefined}
          />
        )}
        <p className="text-[11px] text-[var(--mx-text-muted)]">
          {[
            !trafficConfigured()
              ? "Traffic needs TOMTOM_API_KEY on the API (pnpm secrets:tomtom), Mapbox, or NEXT_PUBLIC_TRAFFIC_TILES_URL."
              : "Live traffic uses TomTom flow tiles via the Magnexis API proxy.",
            !mapillaryConfigured() && !googleConfigured
              ? "Street view needs NEXT_PUBLIC_MAPILLARY_ACCESS_TOKEN and/or GOOGLE_MAPS_API_KEY."
              : !mapillaryConfigured()
                ? "Street view uses Google Street View Static via the API proxy (Mapillary optional for coverage dots)."
                : "Street view uses Mapillary community imagery (CC BY-SA).",
            googleConfigured
              ? "Google enrichment is on (Places photos + Street View Static)."
              : "Optional: set GOOGLE_MAPS_API_KEY on the API for Places photos and Street View.",
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
          <MapChoiceRow
            key={key}
            multi
            selected={layers[key]}
            title={label}
            description={
              key === "hotspots"
                ? "Red circles estimate activity from public-place density — not live foot traffic."
                : undefined
            }
            onSelect={() => toggleLayer(key)}
          />
        ))}
      </div>
    </div>
  );
}
