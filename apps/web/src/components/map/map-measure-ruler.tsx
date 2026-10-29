"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GeoJSONSource, Map, MapMouseEvent } from "maplibre-gl";
import { Ruler, X } from "lucide-react";
import { Button } from "@magnexis/ui";
import { getMap, subscribeMap } from "@/lib/map-registry";
import { formatDistanceMeters } from "@/lib/format";
import { useAppStore } from "@/lib/store";

const MEASURE_SOURCE = "mx-measure";
const MEASURE_LINE = "mx-measure-line";
const MEASURE_POINTS = "mx-measure-points";

type LngLat = { lng: number; lat: number };

function haversineMeters(a: LngLat, b: LngLat): number {
  const R = 6371008.8;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function pathMeters(points: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineMeters(points[i - 1], points[i]);
  }
  return total;
}

/** Meters of ground distance represented by `pixelHeight` at map center (vertical). */
function metersForVerticalPixels(map: Map, pixelHeight: number): number {
  const c = map.getContainer();
  const x = c.clientWidth / 2;
  const y = c.clientHeight / 2;
  const half = pixelHeight / 2;
  const a = map.unproject([x, y - half]);
  const b = map.unproject([x, y + half]);
  return haversineMeters(
    { lng: a.lng, lat: a.lat },
    { lng: b.lng, lat: b.lat },
  );
}

function niceScaleMeters(raw: number, imperial: boolean): number {
  if (!Number.isFinite(raw) || raw <= 0) return imperial ? 1609.344 : 1000;
  if (imperial) {
    const feet = raw * 3.28084;
    const niceFt = [50, 100, 200, 500, 1000, 2000, 5280, 10560, 26400, 52800];
    for (const ft of niceFt) {
      if (ft >= feet * 0.45) return ft / 3.28084;
    }
    return niceFt[niceFt.length - 1] / 3.28084;
  }
  const niceM = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  for (const m of niceM) {
    if (m >= raw * 0.45) return m;
  }
  return niceM[niceM.length - 1];
}

function ensureMeasureLayers(map: Map) {
  if (!map.getSource(MEASURE_SOURCE)) {
    map.addSource(MEASURE_SOURCE, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  if (!map.getLayer(MEASURE_LINE)) {
    map.addLayer({
      id: MEASURE_LINE,
      type: "line",
      source: MEASURE_SOURCE,
      filter: ["==", ["geometry-type"], "LineString"],
      paint: {
        "line-color": "#37D9FF",
        "line-width": 3,
        "line-opacity": 0.95,
      },
    });
  }
  if (!map.getLayer(MEASURE_POINTS)) {
    map.addLayer({
      id: MEASURE_POINTS,
      type: "circle",
      source: MEASURE_SOURCE,
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-radius": 6,
        "circle-color": "#37D9FF",
        "circle-stroke-width": 2,
        "circle-stroke-color": "#08111F",
      },
    });
  }
}

function setMeasureData(map: Map, points: LngLat[]) {
  const source = map.getSource(MEASURE_SOURCE) as GeoJSONSource | undefined;
  if (!source) return;
  const features: Array<{
    type: "Feature";
    properties: Record<string, unknown>;
    geometry:
      | { type: "Point"; coordinates: [number, number] }
      | { type: "LineString"; coordinates: [number, number][] };
  }> = points.map((p, i) => ({
    type: "Feature",
    properties: { i },
    geometry: { type: "Point", coordinates: [p.lng, p.lat] },
  }));
  if (points.length >= 2) {
    features.push({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: points.map((p) => [p.lng, p.lat] as [number, number]),
      },
    });
  }
  source.setData({ type: "FeatureCollection", features });
}

/** Reference pixel height for scale math; rendered bar stays compact near the FAB. */
const RULER_PX = 72;
/** Visual height clamped to sit beside the compact measure control. */
const SCALE_MIN_PX = 28;
const SCALE_MAX_PX = 52;

/**
 * Vertical map scale (real ground distance) + tap-to-measure path tool.
 */
export function MapMeasureRuler() {
  const units = useAppStore((s) => s.settings.units);
  const imperial = units !== "metric";
  const [map, setMap] = useState<Map | null>(null);
  const [scaleLabel, setScaleLabel] = useState("—");
  const [scaleHeightPx, setScaleHeightPx] = useState(SCALE_MAX_PX);
  const [measuring, setMeasuring] = useState(false);
  const [points, setPoints] = useState<LngLat[]>([]);

  const measured = useMemo(() => pathMeters(points), [points]);

  const refreshScale = useCallback(() => {
    const m = map ?? getMap();
    if (!m?.isStyleLoaded?.() && !m) return;
    const live = m ?? getMap();
    if (!live) return;
    try {
      const raw = metersForVerticalPixels(live, RULER_PX);
      const nice = niceScaleMeters(raw, imperial);
      const px = Math.max(
        SCALE_MIN_PX,
        Math.min(SCALE_MAX_PX, (nice / raw) * RULER_PX),
      );
      setScaleHeightPx(px);
      setScaleLabel(formatDistanceMeters(nice, imperial ? "imperial" : "metric"));
    } catch {
      // map not ready
    }
  }, [map, imperial]);

  useEffect(() => subscribeMap(setMap), []);

  useEffect(() => {
    if (!map) return;
    refreshScale();
    const onMove = () => refreshScale();
    map.on("move", onMove);
    map.on("zoom", onMove);
    map.on("resize", onMove);
    return () => {
      map.off("move", onMove);
      map.off("zoom", onMove);
      map.off("resize", onMove);
    };
  }, [map, refreshScale]);

  useEffect(() => {
    if (!map) return;
    const onStyle = () => {
      if (measuring || points.length) {
        try {
          ensureMeasureLayers(map);
          setMeasureData(map, points);
        } catch {
          // ignore
        }
      }
      refreshScale();
    };
    map.on("style.load", onStyle);
    return () => {
      map.off("style.load", onStyle);
    };
  }, [map, measuring, points, refreshScale]);

  useEffect(() => {
    if (!map) return;
    if (!measuring && points.length === 0) {
      const source = map.getSource(MEASURE_SOURCE) as GeoJSONSource | undefined;
      source?.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    try {
      ensureMeasureLayers(map);
      setMeasureData(map, points);
    } catch {
      // style may be swapping
    }
  }, [map, measuring, points]);

  useEffect(() => {
    if (!map || !measuring) return;
    const onClick = (e: MapMouseEvent) => {
      e.originalEvent.stopPropagation();
      const next = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      setPoints((prev) => [...prev, next]);
    };
    map.getCanvas().style.cursor = "crosshair";
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
      map.getCanvas().style.cursor = "";
    };
  }, [map, measuring]);

  // Expose measuring flag so map-canvas can skip drop-pin.
  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as Window & { __mxMeasuring?: boolean }).__mxMeasuring = measuring;
    return () => {
      (window as Window & { __mxMeasuring?: boolean }).__mxMeasuring = false;
    };
  }, [measuring]);

  function clearMeasure() {
    setPoints([]);
    setMeasuring(false);
  }

  const showMeasureLine = measuring || points.length > 0;
  const distanceLabel =
    points.length > 0
      ? formatDistanceMeters(measured, imperial ? "imperial" : "metric")
      : null;

  return (
    <>
      {/* Bottom-left: compact map scale + slim ruler toggle */}
      <div
        className="pointer-events-none absolute left-3 z-20 flex items-end gap-1.5 sm:left-4"
        style={{ bottom: "var(--mx-measure-stack)" }}
      >
        <div
          className="mx-scale-ruler pointer-events-none flex min-h-8 flex-col justify-end"
          aria-label={`Map scale ${scaleLabel}`}
        >
          <div className="mx-scale-ruler__unit flex flex-col items-center px-0.5">
            <span className="mb-0.5 max-w-[2.75rem] truncate text-center text-[9px] font-semibold leading-none tabular-nums tracking-tight text-[var(--mx-text)] [text-shadow:0_1px_2px_color-mix(in_srgb,var(--mx-bg)_70%,transparent)]">
              {scaleLabel}
            </span>
            <div
              className="mx-scale-ruler__bar relative w-[10px]"
              style={{ height: scaleHeightPx }}
            >
              <span
                className="mx-scale-ruler__cap mx-scale-ruler__cap--top"
                aria-hidden
              />
              <span className="mx-scale-ruler__spine" aria-hidden />
              <span className="mx-scale-ruler__tick" aria-hidden />
              <span
                className="mx-scale-ruler__cap mx-scale-ruler__cap--bottom"
                aria-hidden
              />
            </div>
          </div>
        </div>

        <div className="pointer-events-auto">
          <Button
            size="icon"
            variant="ghost"
            className={
              measuring
                ? "!h-8 !w-8 !rounded-[var(--mx-radius-sm)] !bg-transparent !text-[var(--mx-accent)] hover:!bg-transparent hover:!text-[var(--mx-accent)]"
                : "!h-8 !w-8 !rounded-[var(--mx-radius-sm)] !bg-transparent !shadow-none hover:!bg-transparent"
            }
            aria-label={measuring ? "Stop measuring" : "Measure distance"}
            aria-pressed={measuring}
            title={
              measuring
                ? "Measuring — tap the map to add points"
                : "Measure distance on the map"
            }
            onClick={() => {
              if (measuring) {
                setMeasuring(false);
              } else {
                setMeasuring(true);
                setPoints([]);
              }
            }}
          >
            <Ruler
              size={14}
              strokeWidth={measuring ? 2.35 : 2}
              className="drop-shadow-[0_1px_2px_color-mix(in_srgb,var(--mx-bg)_65%,transparent)]"
            />
          </Button>
        </div>
      </div>

      {/* Centered status line just above the bottom dock — no bubble */}
      {showMeasureLine ? (
        <div
          className="pointer-events-none absolute inset-x-0 z-20 flex justify-center px-4"
          style={{
            bottom: "calc(var(--mx-status-stack) + 1.65rem)",
          }}
          role="status"
          aria-live="polite"
        >
          <div className="pointer-events-auto flex max-w-[min(100%,22rem)] items-baseline justify-center gap-2 text-center">
            <p className="min-w-0 text-[13px] font-semibold leading-tight tabular-nums tracking-tight text-[var(--mx-text)] [text-shadow:0_1px_3px_color-mix(in_srgb,var(--mx-bg)_75%,transparent),0_0_12px_color-mix(in_srgb,var(--mx-bg)_45%,transparent)] sm:text-sm">
              {distanceLabel ?? "Tap the map to measure"}
              {points.length > 0 ? (
                <span className="ml-1.5 text-[11px] font-medium text-[var(--mx-text-muted)]">
                  · {points.length} pt{points.length === 1 ? "" : "s"}
                  {measuring ? " · tap map" : ""}
                </span>
              ) : null}
            </p>
            {points.length > 0 ? (
              <button
                type="button"
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--mx-text-muted)] transition hover:bg-[color-mix(in_srgb,var(--mx-surface-2)_70%,transparent)] hover:text-[var(--mx-text)]"
                aria-label="Clear measurement"
                title="Clear measurement"
                onClick={clearMeasure}
              >
                <X size={13} strokeWidth={2.25} />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
