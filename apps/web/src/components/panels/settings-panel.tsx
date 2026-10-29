"use client";

import { useEffect, useState } from "react";
import { SegmentedControl, Button } from "@magnexis/ui";
import { clearRecentSearches, useAppStore } from "@/lib/store";
import { DEFAULT_USER_SETTINGS } from "@magnexis/shared";
import { trafficConfigured } from "@/lib/traffic";
import { mapillaryConfigured } from "@/lib/mapillary";
import { fetchGoogleProviderStatus } from "@/lib/google-maps";

export function SettingsPanel() {
  const {
    settings,
    patchSettings,
    setTheme,
    theme,
    setStyleId,
    recentSearches,
  } = useAppStore();
  const [tomtomConfigured, setTomtomConfigured] = useState<boolean | null>(
    null,
  );
  const [googleConfigured, setGoogleConfigured] = useState<boolean | null>(
    null,
  );

  useEffect(() => {
    const base = (
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
    ).replace(/\/$/, "");
    void fetch(`${base}/api/v1/providers/tomtom/status`)
      .then((r) => r.json())
      .then((d: { configured?: boolean }) =>
        setTomtomConfigured(Boolean(d.configured)),
      )
      .catch(() => setTomtomConfigured(false));
    void fetchGoogleProviderStatus()
      .then((d) => setGoogleConfigured(d.configured))
      .catch(() => setGoogleConfigured(false));
  }, []);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mx-text-muted)]">
          Appearance
        </h3>
        <SegmentedControl
          aria-label="Theme"
          value={theme}
          onChange={(v) => setTheme(v)}
          options={[
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
          ]}
        />
        <label className="flex items-center justify-between text-sm">
          Reduced motion
          <input
            type="checkbox"
            checked={settings.reducedMotion}
            onChange={(e) => patchSettings({ reducedMotion: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between text-sm">
          Interface density
          <select
            className="rounded-lg border border-[var(--mx-border)] bg-[var(--mx-surface-2)] px-2 py-1"
            value={settings.density}
            onChange={(e) =>
              patchSettings({
                density: e.target.value as "comfortable" | "compact",
              })
            }
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </label>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mx-text-muted)]">
          Map
        </h3>
        <label className="flex items-center justify-between text-sm">
          Preferred style
          <select
            className="rounded-lg border border-[var(--mx-border)] bg-[var(--mx-surface-2)] px-2 py-1"
            value={settings.mapStyle}
            onChange={(e) => {
              const v = e.target.value as
                "standard" | "dark" | "terrain" | "satellite";
              patchSettings({ mapStyle: v });
              setStyleId(v);
            }}
          >
            <option value="standard">Magnexis Standard</option>
            <option value="dark">Magnexis Night</option>
            <option value="terrain">Terrain</option>
            <option value="satellite">Satellite</option>
          </select>
        </label>
        <label className="flex items-center justify-between text-sm">
          Show POIs
          <input
            type="checkbox"
            checked={settings.showPoi}
            onChange={(e) => {
              patchSettings({ showPoi: e.target.checked });
              if (useAppStore.getState().layers.poi !== e.target.checked) {
                useAppStore.getState().toggleLayer("poi");
              }
            }}
          />
        </label>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mx-text-muted)]">
          Navigation
        </h3>
        <label className="flex items-center justify-between text-sm">
          Voice guidance
          <input
            type="checkbox"
            checked={settings.voiceGuidanceEnabled}
            onChange={(e) =>
              patchSettings({ voiceGuidanceEnabled: e.target.checked })
            }
          />
        </label>
        <label className="flex items-center justify-between text-sm">
          Units
          <select
            className="rounded-lg border border-[var(--mx-border)] bg-[var(--mx-surface-2)] px-2 py-1"
            value={settings.units}
            onChange={(e) =>
              patchSettings({
                units: e.target.value as "metric" | "imperial",
              })
            }
          >
            <option value="imperial">Miles</option>
            <option value="metric">Kilometers</option>
          </select>
        </label>
        <label className="flex items-center justify-between text-sm">
          Guidance detail
          <select
            className="rounded-lg border border-[var(--mx-border)] bg-[var(--mx-surface-2)] px-2 py-1"
            value={settings.voiceVerbosity}
            onChange={(e) =>
              patchSettings({
                voiceVerbosity: e.target.value as
                  "brief" | "normal" | "detailed",
              })
            }
          >
            <option value="brief">Brief</option>
            <option value="normal">Normal</option>
            <option value="detailed">Detailed</option>
          </select>
        </label>
        <label className="block text-sm">
          Voice speed ({settings.voiceRate.toFixed(1)}×)
          <input
            type="range"
            min={0.7}
            max={1.4}
            step={0.1}
            value={settings.voiceRate}
            onChange={(e) =>
              patchSettings({ voiceRate: Number(e.target.value) })
            }
            className="mt-2 w-full"
          />
        </label>

        <div className="border-t border-[var(--mx-border)] pt-3">
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--mx-text-muted)]">
            Route options
          </h4>
          <p className="mb-3 text-[11px] leading-relaxed text-[var(--mx-text-muted)]">
            Applied when you get directions. Avoid highways uses OSRM{" "}
            <code className="rounded bg-[var(--mx-surface-2)] px-1">
              exclude=motorway
            </code>
            .
          </p>
          <div className="space-y-2.5">
            <label className="flex items-center justify-between text-sm">
              Avoid highways
              <input
                type="checkbox"
                checked={settings.avoidHighways}
                onChange={(e) =>
                  patchSettings({ avoidHighways: e.target.checked })
                }
              />
            </label>
            <label className="flex items-center justify-between text-sm">
              Avoid tolls
              <input
                type="checkbox"
                checked={settings.avoidTolls}
                onChange={(e) =>
                  patchSettings({ avoidTolls: e.target.checked })
                }
              />
            </label>
            <label className="flex items-center justify-between text-sm">
              Avoid ferries
              <input
                type="checkbox"
                checked={settings.avoidFerries}
                onChange={(e) =>
                  patchSettings({ avoidFerries: e.target.checked })
                }
              />
            </label>
            <label className="flex items-center justify-between text-sm">
              Route preference
              <select
                className="rounded-lg border border-[var(--mx-border)] bg-[var(--mx-surface-2)] px-2 py-1"
                value={settings.routePreference}
                onChange={(e) =>
                  patchSettings({
                    routePreference: e.target.value as "fastest" | "shortest",
                  })
                }
              >
                <option value="fastest">Fastest</option>
                <option value="shortest">Shortest</option>
              </select>
            </label>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mx-text-muted)]">
          Providers
        </h3>
        <ul className="space-y-2 text-sm text-[var(--mx-text-muted)]">
          <li>
            TomTom (routing / search / traffic):{" "}
            <span className="text-[var(--mx-text)]">
              {tomtomConfigured == null
                ? "checking…"
                : tomtomConfigured
                  ? "configured on API"
                  : "not set"}
            </span>
          </li>
          <li>
            Live traffic overlay:{" "}
            <span className="text-[var(--mx-text)]">
              {trafficConfigured() ? "ready" : "off"}
            </span>
          </li>
          <li>
            Mapillary street view:{" "}
            <span className="text-[var(--mx-text)]">
              {mapillaryConfigured() ? "ready" : "off"}
            </span>
          </li>
          <li>
            Google enrichment (Places photos / Street View):{" "}
            <span className="text-[var(--mx-text)]">
              {googleConfigured == null
                ? "checking…"
                : googleConfigured
                  ? "configured on API"
                  : "not set"}
            </span>
          </li>
        </ul>
        <p className="text-[11px] leading-relaxed text-[var(--mx-text-muted)]">
          Connected features depend on service availability and regional
          coverage. Features without a configured provider remain unavailable;
          map and place information always shows the available source data.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mx-text-muted)]">
          Keyboard
        </h3>
        <ul className="space-y-1.5 text-xs text-[var(--mx-text-muted)]">
          <li>
            <kbd className="rounded border border-[var(--mx-border)] px-1">
              ⌘/Ctrl+K
            </kbd>{" "}
            or{" "}
            <kbd className="rounded border border-[var(--mx-border)] px-1">
              /
            </kbd>{" "}
            — search
          </li>
          <li>
            <kbd className="rounded border border-[var(--mx-border)] px-1">
              G
            </kbd>{" "}
            /{" "}
            <kbd className="rounded border border-[var(--mx-border)] px-1">
              D
            </kbd>{" "}
            — directions
          </li>
          <li>
            <kbd className="rounded border border-[var(--mx-border)] px-1">
              L
            </kbd>{" "}
            — layers
          </li>
          <li>
            <kbd className="rounded border border-[var(--mx-border)] px-1">
              N
            </kbd>{" "}
            — reset north
          </li>
          <li>
            <kbd className="rounded border border-[var(--mx-border)] px-1">
              T
            </kbd>{" "}
            — traffic (when configured)
          </li>
          <li>
            <kbd className="rounded border border-[var(--mx-border)] px-1">
              Esc
            </kbd>{" "}
            — close panel / clear selection
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mx-text-muted)]">
          Privacy
        </h3>
        <p className="text-xs text-[var(--mx-text-muted)]">
          Foreground location supports map positioning and guidance. Recent
          searches and local favorites stay on this device. Connected providers
          receive the requests needed for search, maps, imagery, and routes.
        </p>
        <a
          className="block text-sm text-[var(--mx-accent)] underline"
          href="/privacy/"
        >
          Privacy & your device
        </a>
        <Button
          variant="secondary"
          size="sm"
          disabled={recentSearches.length === 0}
          onClick={() => clearRecentSearches()}
        >
          Clear recent searches
          {recentSearches.length > 0 ? ` (${recentSearches.length})` : ""}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            patchSettings(DEFAULT_USER_SETTINGS);
            setTheme("dark");
            clearRecentSearches();
          }}
        >
          Reset settings to defaults
        </Button>
      </section>
    </div>
  );
}
