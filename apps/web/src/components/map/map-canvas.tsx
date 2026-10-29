"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, {
  type GeoJSONSource,
  type Map,
  type MapMouseEvent,
  type Marker,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  OPENFREEMAP_STYLES,
  applyBasemapPoiDensity,
  applyBuildings3d,
  applyChromaticPaints,
  applyRouteShieldLabelContrast,
  ensureBasemapDetails,
  isLowDetailDemoStyle,
  paletteFor,
  poiCircleColorExpression,
  poiLabelColorExpression,
  promoteMapLabelLayers,
  resolveClientBasemapUrl,
  resolveGeoSymbol,
  shouldShowGeoSymbol,
  geoSymbolSvgDataUrl,
  GEO_SYMBOLS,
  type ChromaticTheme,
  type PoiDensityMode,
  type GeoSymbolCategory,
} from "@magnexis/map-styles";
import { useAppStore, type UserLocation } from "@/lib/store";
import { getApiClient } from "@/lib/api";
import { registerMap } from "@/lib/map-registry";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useDeviceHeading } from "@/hooks/use-device-heading";
import {
  resolveTrafficSource,
  trafficLineColorExpression,
  type TrafficSourceConfig,
} from "@/lib/traffic";
import {
  MAPILLARY_LAYER_IMAGES,
  MAPILLARY_LAYER_SEQUENCES,
  MAPILLARY_SOURCE_ID,
  mapillaryConfigured,
  mapillaryCoverageTilesUrl,
} from "@/lib/mapillary";
import {
  DroppedPinCard,
  type DroppedPinInfo,
} from "@/components/map/dropped-pin-card";
import { MapMeasureRuler } from "@/components/map/map-measure-ruler";

const DEFAULT_STYLE = resolveClientBasemapUrl(
  process.env.NEXT_PUBLIC_MAP_STYLE_URL,
  "dark",
);

function chromaticThemeFrom(
  styleId: "standard" | "dark" | "terrain" | "satellite",
  override?: ChromaticTheme,
): ChromaticTheme {
  if (
    override === "standard" ||
    override === "night" ||
    override === "navigation" ||
    override === "high-contrast"
  ) {
    return override;
  }
  return styleId === "standard" ? "standard" : "night";
}

function routeColors(theme: ChromaticTheme) {
  const p = paletteFor(theme);
  return { line: p.activeRoute, casing: p.activeRouteCasing };
}

function prepareBasemap(
  map: Map,
  styleId: AppStyleId,
  themeOverride?: ChromaticTheme,
  poiDensity: PoiDensityMode = "all",
) {
  const theme = chromaticThemeFrom(styleId, themeOverride);
  // Satellite + terrain: hybrid imagery surface (OFM roads/labels/shields on raster).
  const labelSurface =
    styleId === "satellite" || styleId === "terrain" ? "imagery" : "vector";
  // Shared label pipeline runs for EVERY map type (street / night / terrain / satellite).
  try {
    ensureBasemapDetails(map, theme, poiDensity, labelSurface, {
      // Satellite has no useful sprite; terrain outdoor keeps MapTiler icons.
      ensureSprite: styleId === "satellite",
    });
  } catch {
    // Never block paints if detail injection fails
  }
  // Satellite imagery must keep provider raster colors; do not paint Chromatic land/roads.
  // Terrain keeps hillshade/raster look — Chromatic only on vector street styles.
  if (styleId !== "satellite" && styleId !== "terrain") {
    applyChromaticPaints(map, theme);
  }
  applyRouteShieldLabelContrast(
    map,
    styleId === "satellite" ||
      styleId === "terrain" ||
      (theme !== "standard" && theme !== "high-contrast"),
  );
  readdOverlayLayers(map, theme);
  void ensureGeoSymbolImages(map, theme !== "standard");
  const { settings: prepSettings } = useAppStore.getState();
  applyBuildings3d(
    map,
    Boolean(prepSettings.buildings3d),
    theme,
    prepSettings.showBuildingFootprints,
  );
  // Place/town labels above route / traffic / POI / search pins (Google-like).
  try {
    promoteMapLabelLayers(map);
  } catch {
    // ignore
  }
}

function currentPoiDensity(): PoiDensityMode {
  return useAppStore.getState().settings.poiDensity as PoiDensityMode;
}

async function refreshNearbyPois(map: Map) {
  const density = currentPoiDensity();
  if (density === "hidden" || !useAppStore.getState().layers.poi) {
    const source = map.getSource("mx-poi") as GeoJSONSource | undefined;
    source?.setData({ type: "FeatureCollection", features: [] });
    return;
  }
  try {
    const zoom = map.getZoom();
    const center = map.getCenter();
    // Clamp to NearbyQuerySchema (max 50 km / 100 results) — wider values 400.
    // Tighter radius at city zoom keeps density readable; still fills downtown.
    const radiusMeters = Math.min(
      50_000,
      zoom < 10 ? 50_000 : zoom < 12 ? 35_000 : zoom < 14 ? 16_000 : 7_000,
    );
    const nearby = await getApiClient().nearbyPlaces({
      lng: center.lng,
      lat: center.lat,
      radiusMeters,
      limit: zoom >= 12 ? 100 : zoom >= 10 ? 80 : 60,
    });
    const source = map.getSource("mx-poi") as GeoJSONSource | undefined;
    source?.setData({
      type: "FeatureCollection",
      features: nearby.places
        .map((p) => {
          const symbol = resolveGeoSymbol(p.category, p.name);
          return {
            type: "Feature" as const,
            geometry: {
              type: "Point" as const,
              coordinates: [p.coordinates.lng, p.coordinates.lat] as [
                number,
                number,
              ],
            },
            properties: {
              id: p.id,
              name: p.name,
              category: p.category,
              symbolCategory: symbol.category,
              symbolPriority: symbol.priority,
              iconId: symbol.iconId,
            },
            _symbol: symbol,
          };
        })
        .filter((f) => shouldShowGeoSymbol(f._symbol, zoom, density))
        .map(({ _symbol: _, ...f }) => f),
    });
  } catch {
    // API may be down — basemap POIs still render
  }
}

/** Refresh activity-estimate circles. The API explicitly identifies their basis. */
async function refreshHotspots(map: Map) {
  const source = map.getSource("mx-hotspots") as GeoJSONSource | undefined;
  if (!source) return;
  if (!useAppStore.getState().layers.hotspots) {
    source.setData({ type: "FeatureCollection", features: [] });
    return;
  }
  try {
    const center = map.getCenter();
    const radiusMeters = Math.min(30_000, map.getZoom() < 10 ? 24_000 : map.getZoom() < 13 ? 12_000 : 6_000);
    const { hotspots } = await getApiClient().hotspots({
      lng: center.lng,
      lat: center.lat,
      radiusMeters,
      limit: 12,
    });
    source.setData({
      type: "FeatureCollection",
      features: hotspots.map((hotspot) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [hotspot.coordinates.lng, hotspot.coordinates.lat] as [number, number],
        },
        properties: {
          id: hotspot.id,
          label: hotspot.label,
          activityScore: hotspot.activityScore,
          placeCount: hotspot.placeCount,
        },
      })),
    });
  } catch {
    // This optional discovery layer must never interrupt normal map use.
    source.setData({ type: "FeatureCollection", features: [] });
  }
}

/** Register GeoSymbol SVG icons so mx-poi-symbol can render category glyphs. */
async function ensureGeoSymbolImages(map: Map, night = true) {
  const tasks: Promise<void>[] = [];
  for (const def of Object.values(GEO_SYMBOLS)) {
    if (map.hasImage(def.iconId)) continue;
    const url = geoSymbolSvgDataUrl(def.category as GeoSymbolCategory, night);
    tasks.push(
      new Promise<void>((resolve) => {
        const img = new Image(48, 48);
        img.onload = () => {
          try {
            if (!map.hasImage(def.iconId)) {
              map.addImage(def.iconId, img, { pixelRatio: 2 });
            }
          } catch {
            // style mid-swap
          }
          resolve();
        };
        img.onerror = () => resolve();
        img.src = url;
      }),
    );
  }
  await Promise.all(tasks);
}

/**
 * Register style.load BEFORE setStyle — cached styles can emit load in the same
 * turn, and `once` after `setStyle` misses Chromatic / shield / overlay re-apply.
 */
function setBasemapStyle(
  map: Map,
  url: string,
  onReady: () => void,
) {
  map.once("style.load", onReady);
  map.setStyle(url);
}

type AppStyleId = "standard" | "dark" | "terrain" | "satellite";

function ensureTrafficOverlay(map: Map) {
  const cfg = resolveTrafficSource();
  if (!cfg) return;

  const visible = useAppStore.getState().layers.traffic
    ? "visible"
    : "none";

  try {
    if (!map.getSource(cfg.id)) {
      addTrafficSource(map, cfg);
    }

    if (cfg.kind === "raster-tiles") {
      if (!map.getLayer("mx-traffic-raster")) {
        map.addLayer({
          id: "mx-traffic-raster",
          type: "raster",
          source: cfg.id,
          paint: { "raster-opacity": 0.42 },
        });
      }
      map.setLayoutProperty("mx-traffic-raster", "visibility", visible);
      return;
    }

    if (!map.getLayer("mx-traffic-flow")) {
      map.addLayer({
        id: "mx-traffic-flow",
        type: "line",
        source: cfg.id,
        "source-layer": cfg.sourceLayer,
        layout: {
          "line-cap": "butt",
          "line-join": "round",
          visibility: visible,
        },
        paint: {
          "line-color": trafficLineColorExpression(
            cfg.congestionProperty,
            cfg.provider,
          ) as never,
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            8,
            0.75,
            12,
            1.5,
            16,
            2.75,
          ],
          "line-opacity": 0.48,
          "line-dasharray": [2.2, 1.6],
        },
        minzoom: 8,
      });
    } else {
      map.setLayoutProperty("mx-traffic-flow", "visibility", visible);
    }
  } catch {
    // Missing tileset / bad TileJSON — leave traffic off rather than break the map.
  }
}

function addTrafficSource(map: Map, cfg: TrafficSourceConfig) {
  if (cfg.kind === "vector-tilejson") {
    map.addSource(cfg.id, { type: "vector", url: cfg.url });
    return;
  }
  if (cfg.kind === "vector-tiles") {
    map.addSource(cfg.id, {
      type: "vector",
      tiles: cfg.tiles,
      minzoom: cfg.minzoom ?? 0,
      maxzoom: cfg.maxzoom ?? 22,
    });
    return;
  }
  map.addSource(cfg.id, {
    type: "raster",
    tiles: cfg.tiles,
    tileSize: cfg.tileSize ?? 256,
  });
}

/** Mapillary coverage lines + image dots (click opens street viewer). */
function ensureMapillaryCoverage(map: Map) {
  if (!mapillaryConfigured()) return;
  const visible = useAppStore.getState().layers.streetView
    ? "visible"
    : "none";

  try {
    if (!map.getSource(MAPILLARY_SOURCE_ID)) {
      map.addSource(MAPILLARY_SOURCE_ID, {
        type: "vector",
        tiles: [mapillaryCoverageTilesUrl()],
        minzoom: 6,
        maxzoom: 14,
      });
    }

    if (!map.getLayer(MAPILLARY_LAYER_SEQUENCES)) {
      map.addLayer({
        id: MAPILLARY_LAYER_SEQUENCES,
        type: "line",
        source: MAPILLARY_SOURCE_ID,
        "source-layer": "sequence",
        layout: {
          "line-cap": "round",
          "line-join": "round",
          visibility: visible,
        },
        paint: {
          "line-color": "#05CB63",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            1.5,
            14,
            3,
            16,
            4,
          ],
          "line-opacity": 0.85,
        },
        minzoom: 10,
      });
    } else {
      map.setLayoutProperty(MAPILLARY_LAYER_SEQUENCES, "visibility", visible);
    }

    if (!map.getLayer(MAPILLARY_LAYER_IMAGES)) {
      map.addLayer({
        id: MAPILLARY_LAYER_IMAGES,
        type: "circle",
        source: MAPILLARY_SOURCE_ID,
        "source-layer": "image",
        layout: { visibility: visible },
        paint: {
          "circle-color": "#05CB63",
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12,
            3,
            16,
            6,
            18,
            8,
          ],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#FFFFFF",
          "circle-opacity": 0.95,
        },
        minzoom: 12,
      });
    } else {
      map.setLayoutProperty(MAPILLARY_LAYER_IMAGES, "visibility", visible);
    }
  } catch {
    // Missing token / tileset — leave street coverage off.
  }
}

function readdOverlayLayers(map: Map, theme: ChromaticTheme = "night") {
  const route = routeColors(theme);

  if (!map.getSource("mx-route")) {
    map.addSource("mx-route", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    // Bright blue nav overlay — separate from gold Chromatic interstates
    map.addLayer({
      id: "mx-route-casing",
      type: "line",
      source: "mx-route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": route.casing,
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          8,
          7,
          14,
          12,
          18,
          16,
        ],
        "line-opacity": 0.75,
      },
    });
    map.addLayer({
      id: "mx-route-line",
      type: "line",
      source: "mx-route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": route.line,
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          8,
          4,
          14,
          8,
          18,
          12,
        ],
        "line-opacity": 0.95,
      },
    });
  } else {
    if (map.getLayer("mx-route-casing")) {
      map.setPaintProperty("mx-route-casing", "line-color", route.casing);
    }
    if (map.getLayer("mx-route-line")) {
      map.setPaintProperty("mx-route-line", "line-color", route.line);
    }
  }

  if (!map.getSource("mx-poi")) {
    map.addSource("mx-poi", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  if (!map.getSource("mx-hotspots")) {
    map.addSource("mx-hotspots", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "mx-hotspots-glow",
      type: "circle",
      source: "mx-hotspots",
      layout: { visibility: useAppStore.getState().layers.hotspots ? "visible" : "none" },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 11, 14, 20, 18, 30],
        "circle-color": "#EF4444",
        "circle-opacity": 0.16,
        "circle-blur": 0.55,
      },
    });
    map.addLayer({
      id: "mx-hotspots-circle",
      type: "circle",
      source: "mx-hotspots",
      layout: { visibility: useAppStore.getState().layers.hotspots ? "visible" : "none" },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 5, 14, 9, 18, 13],
        "circle-color": "#E54747",
        "circle-stroke-width": 2,
        "circle-stroke-color": "rgba(255,255,255,0.96)",
        "circle-opacity": 0.9,
      },
    });
  }
  const lightPoiChrome = theme === "standard" || theme === "high-contrast";
  const poiHalo = lightPoiChrome
    ? "rgba(255, 255, 255, 0.92)"
    : "rgba(8, 17, 31, 0.9)";

  if (!map.getLayer("mx-poi-circle")) {
    map.addLayer({
      id: "mx-poi-circle",
      type: "circle",
      source: "mx-poi",
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10,
          5,
          14,
          7,
          17,
          9,
        ],
        "circle-color": poiCircleColorExpression() as never,
        // Google-like solid category discs with white rim
        "circle-stroke-width": 2,
        "circle-stroke-color": "#FFFFFF",
        "circle-opacity": 0.95,
      },
    });
  } else {
    map.setPaintProperty(
      "mx-poi-circle",
      "circle-color",
      poiCircleColorExpression() as never,
    );
    map.setPaintProperty("mx-poi-circle", "circle-stroke-color", "#FFFFFF");
    map.setPaintProperty("mx-poi-circle", "circle-opacity", 0.95);
  }
  if (!map.getLayer("mx-poi-symbol")) {
    map.addLayer({
      id: "mx-poi-symbol",
      type: "symbol",
      source: "mx-poi",
      layout: {
        "icon-image": ["coalesce", ["get", "iconId"], "mx-poi-generic"],
        "icon-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          11,
          0.55,
          14,
          0.72,
          17,
          0.9,
        ],
        "icon-allow-overlap": false,
        "icon-ignore-placement": false,
        "text-field": [
          "step",
          ["zoom"],
          "",
          14,
          ["coalesce", ["get", "name"], ""],
        ],
        // OFM glyphs: Noto only — "…,Open Sans Regular" 404s and blanks the map
        "text-font": ["Noto Sans Regular"],
        "text-size": 11,
        "text-offset": [0, 1.15],
        "text-anchor": "top",
        "text-optional": true,
        "text-max-width": 8,
      },
      paint: {
        "text-color": poiLabelColorExpression() as never,
        "text-halo-color": poiHalo,
        "text-halo-width": lightPoiChrome ? 1.5 : 1.25,
      },
    });
  } else {
    map.setPaintProperty(
      "mx-poi-symbol",
      "text-color",
      poiLabelColorExpression() as never,
    );
    map.setPaintProperty("mx-poi-symbol", "text-halo-color", poiHalo);
  }

  if (!map.getSource("mx-selection")) {
    map.addSource("mx-selection", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "mx-selection-circle",
      type: "circle",
      source: "mx-selection",
      paint: {
        "circle-radius": 11,
        "circle-color": "#247BFF",
        "circle-stroke-width": 3,
        "circle-stroke-color": "#FFFFFF",
      },
    });
  }

  if (!map.getSource("mx-search-results")) {
    map.addSource("mx-search-results", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "mx-search-results-circle",
      type: "circle",
      source: "mx-search-results",
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          8,
          5,
          14,
          8,
          18,
          10,
        ],
        // Magnexis blue pin (not Google #EA4335) — sits under place labels via promoteMapLabelLayers
        "circle-color": "#247BFF",
        "circle-stroke-width": 2.5,
        "circle-stroke-color": "#FFFFFF",
        "circle-opacity": 0.95,
      },
    });
  }

  ensureTrafficOverlay(map);
  ensureMapillaryCoverage(map);

  if (!map.getSource("mx-incidents")) {
    map.addSource("mx-incidents", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "mx-incidents-circle",
      type: "circle",
      source: "mx-incidents",
      paint: {
        "circle-radius": 8,
        "circle-color": "#9A7B78",
        "circle-stroke-width": 2,
        "circle-stroke-color": "#FFFFFF",
      },
    });
  }

  // Accuracy halo for the glowing current-location marker (center is a DOM Marker).
  if (!map.getSource("mx-user-loc")) {
    map.addSource("mx-user-loc", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "mx-user-loc-accuracy",
      type: "fill",
      source: "mx-user-loc",
      paint: {
        "fill-color": "#3188ff",
        "fill-opacity": 0.14,
      },
    });
    map.addLayer({
      id: "mx-user-loc-accuracy-outline",
      type: "line",
      source: "mx-user-loc",
      paint: {
        "line-color": "#3188ff",
        "line-opacity": 0.35,
        "line-width": 1.25,
      },
    });
  }

  // Style reloads wipe sources — restore accuracy fill from the store.
  syncUserLocationAccuracy(map);

  // mx-* layers are appended on top; restore place labels above pins/route/traffic.
  try {
    promoteMapLabelLayers(map);
  } catch {
    // ignore mid-style-swap failures
  }
}

/** Approximate geodesic circle for GPS accuracy (meters → polygon). */
function accuracyCircleFeature(loc: UserLocation): {
  type: "Feature";
  properties: Record<string, never>;
  geometry: { type: "Polygon"; coordinates: [number, number][][] };
} | null {
  const radius = loc.accuracy;
  if (radius == null || !Number.isFinite(radius) || radius <= 0) return null;
  // Cap so a poor fix does not paint half the city.
  const meters = Math.min(Math.max(radius, 8), 2500);
  const steps = 64;
  const coords: [number, number][] = [];
  const earth = 6371008.8;
  const lat1 = (loc.lat * Math.PI) / 180;
  const lng1 = (loc.lng * Math.PI) / 180;
  const ang = meters / earth;
  for (let i = 0; i <= steps; i++) {
    const brng = (i / steps) * Math.PI * 2;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(ang) +
        Math.cos(lat1) * Math.sin(ang) * Math.cos(brng),
    );
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(brng) * Math.sin(ang) * Math.cos(lat1),
        Math.cos(ang) - Math.sin(lat1) * Math.sin(lat2),
      );
    coords.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [coords] },
  };
}

function syncUserLocationAccuracy(map: Map) {
  const source = map.getSource("mx-user-loc") as GeoJSONSource | undefined;
  if (!source) return;
  const loc = useAppStore.getState().userLocation;
  if (!loc) {
    source.setData({ type: "FeatureCollection", features: [] });
    return;
  }
  const circle = accuracyCircleFeature(loc);
  source.setData({
    type: "FeatureCollection",
    features: circle ? [circle] : [],
  });
}

function createUserLocationElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "mx-user-location";
  el.setAttribute("aria-label", "Your current location");
  el.innerHTML =
    '<span class="mx-user-location__cone" aria-hidden="true"></span>' +
    '<span class="mx-user-location__pulse" aria-hidden="true"></span>' +
    '<span class="mx-user-location__pulse-2" aria-hidden="true"></span>' +
    '<span class="mx-user-location__dot" aria-hidden="true"></span>';
  return el;
}

/** Apply GPS/compass heading to the blue-dot cone (degrees CW from north). */
function syncUserLocationHeading(
  marker: Marker,
  heading: number | undefined,
): void {
  const el = marker.getElement();
  if (heading != null && Number.isFinite(heading)) {
    el.classList.add("mx-user-location--has-heading");
    marker.setRotationAlignment("map");
    marker.setRotation(heading);
  } else {
    el.classList.remove("mx-user-location--has-heading");
    marker.setRotation(0);
    marker.setRotationAlignment("viewport");
  }
}

function basemapForStyleId(
  styleId: "standard" | "dark" | "terrain" | "satellite",
  apiUrl?: string | null,
): string {
  const theme = styleId === "standard" ? "standard" : "dark";
  return resolveClientBasemapUrl(apiUrl, theme);
}

function labelFromMapFeatures(map: Map, point: maplibregl.Point): string | null {
  const layers = (map.getStyle()?.layers ?? [])
    .filter((l) => {
      if (l.type !== "symbol") return false;
      const id = l.id.toLowerCase();
      return (
        id.includes("name") ||
        id.includes("place") ||
        id.includes("label") ||
        id.includes("road")
      );
    })
    .map((l) => l.id)
    .filter((id) => map.getLayer(id));

  if (layers.length === 0) return null;

  const features = map.queryRenderedFeatures(point, { layers });
  // Prefer road/street labels over city/place labels. Painting a large
  // "Hartford" place label under the pointer previously made every tap
  // look like the same location when reverse geocode was slow/missing.
  let best: { name: string; score: number } | null = null;
  for (const f of features) {
    const p = f.properties ?? {};
    const name =
      (typeof p.name === "string" && p.name) ||
      (typeof p.name_en === "string" && p.name_en) ||
      (typeof p.ref === "string" && p.ref) ||
      (typeof p["name:en"] === "string" && p["name:en"]);
    if (!name) continue;
    const layerId = (f.layer?.id ?? "").toLowerCase();
    let score = 50;
    if (
      /road|street|highway|transportation|path|bridge/.test(layerId) ||
      p.class === "street" ||
      p.class === "secondary" ||
      p.class === "primary" ||
      p.class === "tertiary"
    ) {
      score = 10;
    } else if (/poi|housenumber|address|building/.test(layerId)) {
      score = 20;
    } else if (/place|settlement|city|town|village|suburb|locality/.test(layerId)) {
      score = 80;
    }
    if (!best || score < best.score) {
      best = { name, score };
    }
  }
  return best?.name ?? null;
}

function createPinElement(className = "mx-drop-pin"): HTMLDivElement {
  const el = document.createElement("div");
  el.className = className;
  el.setAttribute("role", "img");
  el.setAttribute(
    "aria-label",
    className.includes("search") ? "Selected place" : "Dropped pin",
  );
  // Inner SVG so MapLibre's positioning transform on the root does not
  // clobber the pin shape (CSS rotate on the root was being overwritten).
  el.innerHTML =
    '<span class="mx-drop-pin__glyph" aria-hidden="true">' +
    '<svg viewBox="0 0 28 36" width="28" height="36" focusable="false">' +
    '<path class="mx-drop-pin__shape" d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z"/>' +
    '<circle class="mx-drop-pin__hole" cx="14" cy="13" r="5.25"/>' +
    "</svg></span>";
  return el;
}

/** Letter badge for directions origin / stops / destination (A, B, C…). */
function createWaypointElement(
  letter: string,
  role: "origin" | "stop" | "destination",
): HTMLDivElement {
  const el = document.createElement("div");
  el.className = `mx-waypoint-marker mx-waypoint-marker--${role}`;
  el.setAttribute("role", "img");
  const roleLabel =
    role === "origin"
      ? "Route origin"
      : role === "destination"
        ? "Route destination"
        : "Route stop";
  el.setAttribute("aria-label", `${roleLabel} ${letter}`);
  el.innerHTML =
    `<span class="mx-waypoint-marker__badge" aria-hidden="true">${letter}</span>`;
  return el;
}

function waypointLetter(index: number): string {
  return String.fromCharCode(65 + Math.min(index, 25));
}

export function MapCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const userLocMarkerRef = useRef<Marker | null>(null);
  const selectionMarkerRef = useRef<Marker | null>(null);
  /** Directions A/B/C markers — distinct from drop-pin and GPS glow. */
  const waypointMarkersRef = useRef<Marker[]>([]);
  const applyingCameraRef = useRef(false);
  const applyingCameraTokenRef = useRef(0);
  /** True while mirroring MapLibre → store so we don't easeTo back into a gesture. */
  const syncingFromMapRef = useRef(false);
  const clickSeq = useRef(0);
  const [basemapNote, setBasemapNote] = useState<string | null>(null);
  const [droppedPin, setDroppedPin] = useState<DroppedPinInfo | null>(null);
  const {
    mapView,
    setMapView,
    selectedSearch,
    selectedPlace,
    searchResults,
    directions,
    layers,
    styleId,
    settings,
    setUserLocation,
    userLocation,
    setSelectedSearch,
    setSelectedPlace,
    openPanel,
    setDirections,
  } = useAppStore();
  const chromaticTheme = settings.chromaticTheme as ChromaticTheme;

  // Continuous GPS while the map is open (home + navigate).
  useGeolocation({ enabled: true });
  // Mobile compass → heading cone on the blue location marker.
  useDeviceHeading({ enabled: true });

  const clearDroppedPin = () => {
    setDroppedPin(null);
    markerRef.current?.remove();
    markerRef.current = null;
    const sel = useAppStore.getState().selectedSearch;
    if (sel?.source === "user_submission" && sel.id.startsWith("drop-")) {
      setSelectedSearch(null);
    }
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DEFAULT_STYLE,
      center: [mapView.center.lng, mapView.center.lat],
      zoom: mapView.zoom,
      maxZoom: 22,
      maxPitch: 70,
      pitch: mapView.pitch,
      bearing: mapView.bearing,
      // Attribution lives in Horizon chrome (compact) — avoid MapLibre's bulky ctrl.
      attributionControl: false,
    });

    // Vertical scale + measure tool live in <MapMeasureRuler /> (not ScaleControl).
    // Belt-and-suspenders: drop any leftover attrib DOM from a prior map instance.
    map.getContainer()
      .querySelectorAll(".maplibregl-ctrl-attrib")
      .forEach((el) => el.remove());

    const syncCameraFromMap = () => {
      // Always mirror gestures into the store. Loop prevention is handled by
      // syncingFromMapRef in the store→map effect — do not gate on
      // applyingCameraRef (a swallowed moveend used to block compass forever).
      syncingFromMapRef.current = true;
      const c = map.getCenter();
      setMapView({
        center: { lng: c.lng, lat: c.lat },
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      });
    };
    // moveend covers pan/zoom; rotate/pitch keep the compass icon live while gesturing
    map.on("moveend", syncCameraFromMap);
    map.on("rotate", syncCameraFromMap);
    map.on("pitch", syncCameraFromMap);

    map.dragRotate.enable();
    map.touchZoomRotate.enableRotation();
    map.touchPitch.enable();

    map.on("error", (e) => {
      // MapLibre emits errors for individual tiles/glyphs/sprites. Matching
      // /tile|style/i caused a false "basemap unavailable" banner whenever a
      // single vector tile request failed or was cancelled.
      const err = e.error as Error & { status?: number; url?: string };
      const msg = `${err?.message ?? ""} ${err?.url ?? ""}`;
      const status = err?.status;
      const isStyleDocFailure =
        /error loading style|failed to fetch.*(styles?\/|style\.json)/i.test(
          msg,
        ) ||
        ((status === 401 || status === 403 || status === 404) &&
          /\/styles?\//i.test(msg) &&
          !/\/tiles?\//i.test(msg));
      if (!isStyleDocFailure) return;

      const fallback =
        styleId === "standard"
          ? OPENFREEMAP_STYLES.liberty
          : OPENFREEMAP_STYLES.dark;
      setBasemapNote("Basemap style failed to load; retrying OpenFreeMap.");
      setBasemapStyle(map, fallback, () => {
        prepareBasemap(
          map,
          styleId,
          useAppStore.getState().settings.chromaticTheme as ChromaticTheme,
        );
        setBasemapNote(null);
      });
    });

    const placeDroppedPin = async (e: MapMouseEvent) => {
      const { lng, lat } = e.lngLat;
      const seq = ++clickSeq.current;
      const mapLabel = labelFromMapFeatures(map, e.point);

      // Pin marker first so the tap point is visible immediately.
      if (!markerRef.current) {
        markerRef.current = new maplibregl.Marker({
          element: createPinElement("mx-drop-pin"),
          anchor: "bottom",
          draggable: true,
          pitchAlignment: "viewport",
          rotationAlignment: "viewport",
        })
          .setLngLat([lng, lat])
          .addTo(map);

        markerRef.current.on("dragend", () => {
          const pos = markerRef.current?.getLngLat();
          if (!pos) return;
          void placeDroppedPin({
            lngLat: pos,
            point: map.project(pos),
          } as MapMouseEvent);
        });
      } else {
        markerRef.current.setLngLat([lng, lat]);
      }

      setDroppedPin({
        lng,
        lat,
        title: mapLabel ?? "Dropped pin",
        subtitle: mapLabel ? "Street / place from map" : undefined,
        address: undefined,
        loading: true,
      });

      try {
        // Debounce rapid re-drops; clickSeq cancels superseded lookups.
        await new Promise((r) => setTimeout(r, 140));
        if (seq !== clickSeq.current) return;

        const api = getApiClient();
        const reverse = await api.reverseGeocode({ lng, lat });
        if (seq !== clickSeq.current) return;

        const geo = reverse.result;
        // Server only returns nearestPlace when within ~350m of the click
        // (guards the old "Hartford Hospital 22km away" title regression).
        const nearest = reverse.nearestPlace;
        const nearestDist = Number(nearest?.distanceMeters);
        const onPlace =
          nearest != null &&
          Number.isFinite(nearestDist) &&
          nearestDist <= 350;

        // Title: short street/place name. Address line: full reverse result.
        const title =
          geo?.label ||
          (onPlace ? nearest.label : undefined) ||
          mapLabel ||
          "Dropped pin";
        const address =
          geo?.address ||
          (onPlace ? nearest.address : undefined) ||
          undefined;
        const subtitle = onPlace
          ? nearest.category
            ? nearest.category.replace(/_/g, " ")
            : "Nearby place"
          : geo
            ? undefined
            : mapLabel
              ? "Street / place from map"
              : undefined;
        const detail = onPlace
          ? `${Math.round(nearestDist)} m from place`
          : undefined;

        setDroppedPin({
          lng,
          lat,
          title,
          subtitle,
          address,
          detail,
          loading: false,
        });

        // Always `user_submission` so Horizon's SelectedPlaceCard peek stays
        // hidden — DroppedPinCard owns this UI (geocoder/internal sources were
        // opening a second identical bottom card).
        setSelectedSearch({
          id: `drop-${lng.toFixed(5)}-${lat.toFixed(5)}`,
          label: title,
          kind: geo ? "geocode" : onPlace ? "place" : "geocode",
          category: onPlace ? nearest.category : undefined,
          coordinates: { lng, lat },
          address,
          distanceMeters: onPlace ? nearestDist : undefined,
          source: "user_submission",
          verified: Boolean(onPlace && nearest.verified),
        });
      } catch {
        if (seq !== clickSeq.current) return;
        setDroppedPin({
          lng,
          lat,
          title: mapLabel ?? "Dropped pin",
          subtitle: "Lookup unavailable",
          address: undefined,
          loading: false,
        });
        setSelectedSearch({
          id: `drop-${lng.toFixed(5)}-${lat.toFixed(5)}`,
          label: mapLabel ?? `Pin ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          kind: "geocode",
          coordinates: { lng, lat },
          source: "user_submission",
          verified: false,
        });
      }
    };

    map.on("click", (e) => {
      // Measure tool owns clicks while active (see MapMeasureRuler).
      if (
        (window as Window & { __mxMeasuring?: boolean }).__mxMeasuring
      ) {
        return;
      }
      // Prefer search-result / POI selection over dropping a new pin.
      const guardLayers = [
        "mx-search-results-circle",
        "mx-poi-symbol",
        "mx-poi-circle",
        "mx-basemap-poi",
        "mx-hotspots-circle",
      ].filter((id) => map.getLayer(id));
      if (guardLayers.length) {
        const hits = map.queryRenderedFeatures(e.point, {
          layers: guardLayers,
        });
        if (hits.length) return;
      }
      void placeDroppedPin(e);
    });

    let poiRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    const schedulePoiRefresh = () => {
      if (poiRefreshTimer) clearTimeout(poiRefreshTimer);
      poiRefreshTimer = setTimeout(() => {
        void refreshNearbyPois(map);
        void refreshHotspots(map);
      }, 280);
    };
    map.on("moveend", schedulePoiRefresh);

    map.on("load", async () => {
      const theme = useAppStore.getState().settings
        .chromaticTheme as ChromaticTheme;
      prepareBasemap(map, styleId, theme, currentPoiDensity());
      setBasemapNote(null);

      try {
        const api = getApiClient();
        const styles = await api.mapStyles();
        const match = styles.styles.find((s) => s.id === styleId && s.available);
        const nextUrl = basemapForStyleId(styleId, match?.styleUrl);
        if (nextUrl !== DEFAULT_STYLE && !isLowDetailDemoStyle(nextUrl)) {
          const center = map.getCenter();
          const zoom = map.getZoom();
          const bearing = map.getBearing();
          const pitch = map.getPitch();
          setBasemapStyle(map, nextUrl, () => {
            map.setCenter(center);
            map.setZoom(zoom);
            map.setBearing(bearing);
            map.setPitch(pitch);
            prepareBasemap(
              map,
              styleId,
              useAppStore.getState().settings.chromaticTheme as ChromaticTheme,
              currentPoiDensity(),
            );
            void refreshNearbyPois(map);
            void refreshHotspots(map);
          });
        } else if (match?.styleUrl && isLowDetailDemoStyle(match.styleUrl)) {
          setBasemapNote(
            "API returned a low-detail demo basemap; keeping OpenFreeMap roads.",
          );
        }
        await refreshNearbyPois(map);
        await refreshHotspots(map);
      } catch {
        // API may be down — map still works with basemap
      }

      try {
        const api = getApiClient();
        const { incidents } = await api.listIncidents();
        const source = map.getSource("mx-incidents") as GeoJSONSource | undefined;
        source?.setData({
          type: "FeatureCollection",
          features: incidents.map((i) => ({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [i.coordinates.lng, i.coordinates.lat],
            },
            properties: { id: i.id, category: i.category },
          })),
        });
      } catch {
        // optional
      }
    });

    map.on("geolocate", (e) => {
      const coords = (
        e as unknown as { coords?: { longitude: number; latitude: number } }
      ).coords;
      if (coords) {
        setUserLocation({ lng: coords.longitude, lat: coords.latitude });
      }
    });

    mapRef.current = map;
    registerMap(map);

    return () => {
      if (poiRefreshTimer) clearTimeout(poiRefreshTimer);
      map.off("moveend", schedulePoiRefresh);
      markerRef.current?.remove();
      markerRef.current = null;
      userLocMarkerRef.current?.remove();
      userLocMarkerRef.current = null;
      selectionMarkerRef.current?.remove();
      selectionMarkerRef.current = null;
      for (const m of waypointMarkersRef.current) m.remove();
      waypointMarkersRef.current = [];
      registerMap(null);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Search / place selection replaces a map drop — don't leave two bottom cards.
  useEffect(() => {
    if (!droppedPin) return;
    if (!selectedSearch && !selectedPlace) return;
    if (
      selectedSearch?.source === "user_submission" &&
      selectedSearch.id.startsWith("drop-")
    ) {
      return;
    }
    setDroppedPin(null);
    markerRef.current?.remove();
    markerRef.current = null;
  }, [selectedSearch, selectedPlace, droppedPin]);

  // Glowing current-location marker + accuracy halo
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!userLocation) {
      userLocMarkerRef.current?.remove();
      userLocMarkerRef.current = null;
      if (map.isStyleLoaded()) syncUserLocationAccuracy(map);
      return;
    }

    const lngLat: [number, number] = [userLocation.lng, userLocation.lat];
    if (!userLocMarkerRef.current) {
      userLocMarkerRef.current = new maplibregl.Marker({
        element: createUserLocationElement(),
        anchor: "center",
        pitchAlignment: "viewport",
        rotationAlignment: "viewport",
      })
        .setLngLat(lngLat)
        .addTo(map);
    } else {
      userLocMarkerRef.current.setLngLat(lngLat);
    }
    syncUserLocationHeading(userLocMarkerRef.current, userLocation.heading);
    if (map.isStyleLoaded()) syncUserLocationAccuracy(map);
  }, [userLocation]);

  // Sync Horizon chrome zoom / locate into the MapLibre camera
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (syncingFromMapRef.current) {
      syncingFromMapRef.current = false;
      return;
    }
    const center = map.getCenter();
    const zoom = map.getZoom();
    const bearing = map.getBearing();
    const pitch = map.getPitch();
    const centerDelta =
      Math.abs(center.lng - mapView.center.lng) +
      Math.abs(center.lat - mapView.center.lat);
    const zoomDelta = Math.abs(zoom - mapView.zoom);
    const bearingDelta = Math.abs(bearing - mapView.bearing);
    const pitchDelta = Math.abs(pitch - mapView.pitch);
    if (
      centerDelta < 1e-7 &&
      zoomDelta < 1e-3 &&
      bearingDelta < 1e-3 &&
      pitchDelta < 1e-3
    ) {
      return;
    }
    const token = ++applyingCameraTokenRef.current;
    applyingCameraRef.current = true;
    const clearApplying = () => {
      if (applyingCameraTokenRef.current === token) {
        applyingCameraRef.current = false;
      }
    };
    const needsAnim =
      zoomDelta > 0.01 ||
      centerDelta > 1e-5 ||
      bearingDelta > 0.5 ||
      pitchDelta > 0.5;
    map.easeTo({
      center: [mapView.center.lng, mapView.center.lat],
      zoom: mapView.zoom,
      bearing: mapView.bearing,
      pitch: mapView.pitch,
      duration: needsAnim ? 280 : 0,
      essential: true,
    });
    map.once("moveend", clearApplying);
    // stop()/style swaps can swallow moveend and leave sync permanently blocked
    window.setTimeout(clearApplying, needsAnim ? 700 : 80);
  }, [mapView]);

  // Plot search hits as map pins (Google Maps–style result markers)
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const source = map.getSource("mx-search-results") as
      | GeoJSONSource
      | undefined;
    if (!source) return;

    const selectedId = selectedSearch?.id;
    const features = searchResults
      .filter((r) => r.coordinates)
      .map((r) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [r.coordinates.lng, r.coordinates.lat] as [
            number,
            number,
          ],
        },
        properties: {
          id: r.id,
          label: r.label,
          selected: r.id === selectedId ? 1 : 0,
        },
      }));

    source.setData({ type: "FeatureCollection", features });

    if (features.length > 1 && !selectedPlace && !selectedSearch) {
      const bounds = features.reduce(
        (b, f) =>
          b.extend(f.geometry.coordinates as [number, number]),
        new maplibregl.LngLatBounds(
          features[0].geometry.coordinates as [number, number],
          features[0].geometry.coordinates as [number, number],
        ),
      );
      map.fitBounds(bounds, {
        padding: { top: 120, bottom: 220, left: 48, right: 48 },
        maxZoom: 14,
        duration: 650,
      });
    }
  }, [searchResults, selectedSearch, selectedPlace, styleId]);

  // Click a search-result or seeded POI circle → select that place
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const pickLayers = [
      "mx-search-results-circle",
      "mx-poi-symbol",
      "mx-poi-circle",
      "mx-basemap-poi",
    ].filter((id) => map.getLayer(id));
    // Native basemap poi_* / poi-* symbol layers (OpenFreeMap liberty).
    for (const layer of map.getStyle()?.layers ?? []) {
      if (
        layer.type === "symbol" &&
        /^poi[_-]/i.test(layer.id) &&
        map.getLayer(layer.id)
      ) {
        pickLayers.push(layer.id);
      }
    }

    const onClick = (e: MapMouseEvent) => {
      if (pickLayers.length === 0) return;
      const hits = map.queryRenderedFeatures(e.point, { layers: pickLayers });
      const props = hits[0]?.properties;
      if (!props) return;
      e.originalEvent.stopPropagation();

      const fromSearch =
        typeof props.id === "string"
          ? useAppStore.getState().searchResults.find((r) => r.id === props.id)
          : undefined;
      if (fromSearch) {
        setSelectedSearch(fromSearch);
        setSelectedPlace(null);
        clearDroppedPin();
        useAppStore.getState().setSheetCollapsed(true);
        return;
      }

      // Seeded / nearby GeoJSON POI or basemap tile POI
      const lng =
        hits[0]?.geometry?.type === "Point"
          ? (hits[0].geometry.coordinates as [number, number])[0]
          : null;
      const lat =
        hits[0]?.geometry?.type === "Point"
          ? (hits[0].geometry.coordinates as [number, number])[1]
          : null;
      if (lng == null || lat == null) return;
      const label =
        typeof props.name === "string" && props.name
          ? props.name
          : typeof props["name:en"] === "string" && props["name:en"]
            ? props["name:en"]
            : typeof props.category === "string"
              ? String(props.category).replace(/_/g, " ")
              : typeof props.class === "string"
                ? String(props.class).replace(/_/g, " ")
                : "Point of interest";
      setSelectedSearch({
        id: typeof props.id === "string" ? props.id : `poi-${lng}-${lat}`,
        label,
        kind: "place",
        coordinates: { lng, lat },
        address:
          typeof props.category === "string"
            ? String(props.category).replace(/_/g, " ")
            : typeof props.class === "string"
              ? String(props.class).replace(/_/g, " ")
              : undefined,
        source: "internal",
        verified: false,
      });
      setSelectedPlace(null);
      clearDroppedPin();
      useAppStore.getState().setSheetCollapsed(true);
    };

    const onEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    for (const layer of pickLayers) {
      map.on("click", layer, onClick);
      map.on("mouseenter", layer, onEnter);
      map.on("mouseleave", layer, onLeave);
    }
    return () => {
      for (const layer of pickLayers) {
        map.off("click", layer, onClick);
        map.off("mouseenter", layer, onEnter);
        map.off("mouseleave", layer, onLeave);
      }
    };
  }, [setSelectedSearch, setSelectedPlace, styleId, layers.poi]);

  // Click Mapillary coverage image → open street viewer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!layers.streetView || !mapillaryConfigured()) return;
    if (!map.getLayer(MAPILLARY_LAYER_IMAGES)) {
      ensureMapillaryCoverage(map);
    }
    if (!map.getLayer(MAPILLARY_LAYER_IMAGES)) return;

    const onClick = (e: MapMouseEvent) => {
      const hits = map.queryRenderedFeatures(e.point, {
        layers: [MAPILLARY_LAYER_IMAGES],
      });
      const id = hits[0]?.properties?.id;
      if (id == null) return;
      e.originalEvent.stopPropagation();
      useAppStore.getState().setStreetViewImageId(String(id));
    };
    const onEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = "";
    };
    map.on("click", MAPILLARY_LAYER_IMAGES, onClick);
    map.on("mouseenter", MAPILLARY_LAYER_IMAGES, onEnter);
    map.on("mouseleave", MAPILLARY_LAYER_IMAGES, onLeave);
    return () => {
      map.off("click", MAPILLARY_LAYER_IMAGES, onClick);
      map.off("mouseenter", MAPILLARY_LAYER_IMAGES, onEnter);
      map.off("mouseleave", MAPILLARY_LAYER_IMAGES, onLeave);
    };
  }, [layers.streetView, styleId]);

  // Fly to selection (search / place — not map-drop, which already has a marker)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const target = selectedPlace?.coordinates ?? selectedSearch?.coordinates;
    if (!target) {
      selectionMarkerRef.current?.remove();
      selectionMarkerRef.current = null;
      const source = map.getSource("mx-selection") as GeoJSONSource | undefined;
      source?.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    if (selectedSearch?.source === "user_submission" || droppedPin) {
      // Dropped pin already shows the coral DOM marker at the tap point
      selectionMarkerRef.current?.remove();
      selectionMarkerRef.current = null;
      return;
    }

    map.flyTo({
      center: [target.lng, target.lat],
      zoom: Math.max(map.getZoom(), 14),
      essential: true,
    });

    const source = map.getSource("mx-selection") as GeoJSONSource | undefined;
    source?.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [target.lng, target.lat],
          },
          properties: {},
        },
      ],
    });

    if (!selectionMarkerRef.current) {
      selectionMarkerRef.current = new maplibregl.Marker({
        element: createPinElement("mx-search-pin"),
        anchor: "bottom",
        pitchAlignment: "viewport",
        rotationAlignment: "viewport",
      }).addTo(map);
    }
    selectionMarkerRef.current.setLngLat([target.lng, target.lat]);
  }, [selectedPlace, selectedSearch, droppedPin, styleId]);

  // Directions waypoint markers (A = origin, …, last = destination)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    type WaypointPoint = {
      lng: number;
      lat: number;
      role: "origin" | "stop" | "destination";
    };
    const points: WaypointPoint[] = [];
    if (directions.origin?.coordinates) {
      points.push({
        lng: directions.origin.coordinates.lng,
        lat: directions.origin.coordinates.lat,
        role: "origin",
      });
    }
    for (const w of directions.waypoints) {
      if (!w.coordinates) continue;
      points.push({
        lng: w.coordinates.lng,
        lat: w.coordinates.lat,
        role: "stop",
      });
    }
    if (directions.destination?.coordinates) {
      points.push({
        lng: directions.destination.coordinates.lng,
        lat: directions.destination.coordinates.lat,
        role: "destination",
      });
    }

    // Tear down when directions are cleared (no endpoints).
    if (points.length === 0) {
      for (const m of waypointMarkersRef.current) m.remove();
      waypointMarkersRef.current = [];
      return;
    }

    const existing = waypointMarkersRef.current;
    // Rebuild when count or roles change so letter badges stay correct.
    if (existing.length !== points.length) {
      for (const m of existing) m.remove();
      waypointMarkersRef.current = points.map((p, i) =>
        new maplibregl.Marker({
          element: createWaypointElement(waypointLetter(i), p.role),
          anchor: "bottom",
          pitchAlignment: "viewport",
          rotationAlignment: "viewport",
        })
          .setLngLat([p.lng, p.lat])
          .addTo(map),
      );
      return;
    }

    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      const marker = existing[i]!;
      marker.setLngLat([p.lng, p.lat]);
      const el = marker.getElement();
      el.className = `mx-waypoint-marker mx-waypoint-marker--${p.role}`;
      const badge = el.querySelector(".mx-waypoint-marker__badge");
      if (badge) badge.textContent = waypointLetter(i);
    }
  }, [
    directions.origin,
    directions.destination,
    directions.waypoints,
    styleId,
  ]);

  // Route geometry
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const source = map.getSource("mx-route") as GeoJSONSource | undefined;
    const idx = Math.min(
      Math.max(0, directions.selectedRouteIndex),
      Math.max(0, directions.routes.length - 1),
    );
    const route = directions.routes[idx];
    if (!source) return;
    if (!route) {
      source.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    source.setData({
      type: "Feature",
      geometry: route.geometry,
      properties: {},
    });
    const coords = route.geometry.coordinates;
    if (coords.length > 1) {
      const bounds = coords.reduce(
        (b, c) => b.extend(c as [number, number]),
        new maplibregl.LngLatBounds(
          coords[0] as [number, number],
          coords[0] as [number, number],
        ),
      );
      // Google-like overview: leave room for Horizon sheet / FAB column.
      const sheetOpen = !useAppStore.getState().sheetCollapsed;
      const wide = typeof window !== "undefined" && window.innerWidth >= 768;
      map.fitBounds(bounds, {
        padding: wide
          ? {
              top: 96,
              bottom: 96,
              left: sheetOpen ? 380 : 72,
              right: 88,
            }
          : {
              top: 100,
              bottom: sheetOpen ? 320 : 180,
              left: 40,
              right: 56,
            },
        duration: 800,
        maxZoom: 16,
        essential: true,
      });
    }
  }, [directions.routes, directions.selectedRouteIndex, styleId]);

  // Layer visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const poiVis = layers.poi ? "visible" : "none";
    if (map.getLayer("mx-poi-circle")) {
      map.setLayoutProperty("mx-poi-circle", "visibility", poiVis);
    }
    if (map.getLayer("mx-poi-symbol")) {
      map.setLayoutProperty("mx-poi-symbol", "visibility", poiVis);
    }
    const hotspotVis = layers.hotspots ? "visible" : "none";
    for (const layerId of ["mx-hotspots-glow", "mx-hotspots-circle"]) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", hotspotVis);
    }
    if (map.getLayer("mx-incidents-circle")) {
      map.setLayoutProperty(
        "mx-incidents-circle",
        "visibility",
        layers.incidents ? "visible" : "none",
      );
    }
    const trafficVis = layers.traffic ? "visible" : "none";
    if (map.getLayer("mx-traffic-flow")) {
      map.setLayoutProperty("mx-traffic-flow", "visibility", trafficVis);
    }
    if (map.getLayer("mx-traffic-raster")) {
      map.setLayoutProperty("mx-traffic-raster", "visibility", trafficVis);
    }
    const streetVis = layers.streetView ? "visible" : "none";
    if (map.getLayer(MAPILLARY_LAYER_SEQUENCES)) {
      map.setLayoutProperty(MAPILLARY_LAYER_SEQUENCES, "visibility", streetVis);
    }
    if (map.getLayer(MAPILLARY_LAYER_IMAGES)) {
      map.setLayoutProperty(MAPILLARY_LAYER_IMAGES, "visibility", streetVis);
    }
    // (Re)attach coverage when toggled on after style load
    if (layers.streetView) {
      ensureMapillaryCoverage(map);
      try {
        promoteMapLabelLayers(map);
      } catch {
        // ignore
      }
    }
  }, [layers]);

  // Style switching — never apply demotiles
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    void (async () => {
      try {
        const api = getApiClient();
        const { styles } = await api.mapStyles();
        const match = styles.find((s) => s.id === styleId);
        const url = basemapForStyleId(
          styleId,
          match?.available ? match.styleUrl : undefined,
        );
        const center = map.getCenter();
        const zoom = map.getZoom();
        const bearing = map.getBearing();
        const buildings3dOn = Boolean(
          useAppStore.getState().settings.buildings3d,
        );
        // Keep Apple Maps–style tilt when 3D buildings stay on across styles.
        const nextPitch = buildings3dOn
          ? 60
          : styleId === "terrain"
            ? 48
            : styleId === "satellite"
              ? 35
              : 0;
        setBasemapStyle(map, url, () => {
          map.setCenter(center);
          map.setZoom(zoom);
          map.setBearing(bearing);
          map.setPitch(nextPitch);
          useAppStore.getState().setMapView({ pitch: nextPitch });
          prepareBasemap(
            map,
            styleId,
            useAppStore.getState().settings.chromaticTheme as ChromaticTheme,
            currentPoiDensity(),
          );
          void refreshNearbyPois(map);
          void refreshHotspots(map);
          setBasemapNote(
            match?.styleUrl && isLowDetailDemoStyle(match.styleUrl)
              ? "Rejected low-detail demo basemap from API; using OpenFreeMap."
              : null,
          );
          if (nextPitch > 0) {
            map.easeTo({ pitch: nextPitch, duration: 600 });
          }
        });
      } catch {
        const url =
          styleId === "standard"
            ? OPENFREEMAP_STYLES.liberty
            : OPENFREEMAP_STYLES.dark;
        setBasemapStyle(map, url, () => {
          const buildings3dOn = Boolean(
            useAppStore.getState().settings.buildings3d,
          );
          const flat = buildings3dOn
            ? 60
            : styleId === "terrain" || styleId === "satellite"
              ? 40
              : 0;
          map.setPitch(flat);
          useAppStore.getState().setMapView({ pitch: flat });
          prepareBasemap(
            map,
            styleId,
            useAppStore.getState().settings.chromaticTheme as ChromaticTheme,
            currentPoiDensity(),
          );
          void refreshNearbyPois(map);
          void refreshHotspots(map);
          setBasemapNote(null);
        });
      }
    })();
  }, [styleId]);

  // Chromatic paint refresh without full style reload (high-contrast / navigation)
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    prepareBasemap(map, styleId, chromaticTheme, currentPoiDensity());
  }, [chromaticTheme, styleId]);

  // POI density — basemap symbols + seeded nearby overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const density = settings.poiDensity as PoiDensityMode;
    applyBasemapPoiDensity(map, density);
    void refreshNearbyPois(map);
    void refreshHotspots(map);
  }, [settings.poiDensity, layers.poi]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    void refreshHotspots(map);
  }, [layers.hotspots]);

  // 3D buildings (Apple Maps–style extrusions) + footprints / labels prefs
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;

    applyBuildings3d(
      map,
      Boolean(settings.buildings3d),
      chromaticThemeFrom(styleId, chromaticTheme),
      settings.showBuildingFootprints,
    );

    // Tilt like Apple Maps when entering 3D; flatten when leaving.
    const targetPitch = settings.buildings3d ? 60 : 0;
    const currentPitch = map.getPitch();
    if (Math.abs(currentPitch - targetPitch) > 2) {
      map.easeTo({ pitch: targetPitch, duration: 520, essential: true });
      useAppStore.getState().setMapView({ pitch: targetPitch });
    }

    const layersList = map.getStyle()?.layers ?? [];
    for (const layer of layersList) {
      if (!layer?.id || layer.id.startsWith("mx-")) continue;
      if (!map.getLayer(layer.id)) continue;
      const id = layer.id.toLowerCase();
      try {
        // Flat footprints are owned by applyBuildings3d when 3D is on.
        if (
          /building/.test(id) &&
          layer.type === "fill" &&
          !settings.buildings3d
        ) {
          map.setLayoutProperty(
            layer.id,
            "visibility",
            settings.showBuildingFootprints ? "visible" : "none",
          );
        }
        if (
          (/highway[_-]name|road_name|transportation_name/.test(id) ||
            /street.?name/.test(id)) &&
          layer.type === "symbol" &&
          !/shield|road_shield|ref/.test(id)
        ) {
          map.setLayoutProperty(
            layer.id,
            "visibility",
            settings.showRoadNames ? "visible" : "none",
          );
        }
        if (
          /^(highway-shield|road_shield)/i.test(id) ||
          (/shield|highway_name_motorway|road_shield/.test(id) &&
            !id.startsWith("mx-"))
        ) {
          map.setLayoutProperty(
            layer.id,
            "visibility",
            settings.showHighwayShields ? "visible" : "none",
          );
        }
      } catch {
        // ignore
      }
    }
  }, [
    settings.buildings3d,
    settings.showBuildingFootprints,
    settings.showRoadNames,
    settings.showHighwayShields,
    styleId,
    chromaticTheme,
  ]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <MapMeasureRuler />
      <DroppedPinCard
        pin={droppedPin}
        onClose={clearDroppedPin}
        onDirections={() => {
          if (!droppedPin) return;
          const dest = {
            id: `drop-${droppedPin.lng.toFixed(5)}-${droppedPin.lat.toFixed(5)}`,
            label: droppedPin.title,
            kind: "geocode" as const,
            coordinates: { lng: droppedPin.lng, lat: droppedPin.lat },
            address: droppedPin.address ?? droppedPin.subtitle,
            source: "user_submission" as const,
            verified: false,
          };
          setSelectedSearch(dest);
          setDirections({ destination: dest, error: null });
          openPanel("directions");
        }}
      />
      {basemapNote ? (
        <div
          role="status"
          className="pointer-events-none absolute left-1/2 top-[5.5rem] z-30 max-w-md -translate-x-1/2 rounded-xl border border-[var(--mx-warning)]/40 bg-[var(--mx-surface-glass)] px-3 py-2 text-center text-xs text-[var(--mx-text)] backdrop-blur-xl"
        >
          {basemapNote}
        </div>
      ) : null}
      {userLocation ? (
        <span className="sr-only">GPS location active</span>
      ) : null}
    </div>
  );
}
