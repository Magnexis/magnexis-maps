import { describe, expect, it } from "vitest";
import {
  CHROMATIC_NIGHT,
  CHROMATIC_STANDARD,
  applyChromaticPaints,
  paletteFor,
} from "./chromatic.js";
import {
  ensureRouteShieldLayers,
  promoteMapLabelLayers,
  promoteRouteShieldLayers,
  parseRouteRef,
  routeShieldSvg,
  shieldFromFeatureProps,
  styleHasHighwayShields,
} from "./route-shield.js";
import {
  applyBoundaryContrast,
  ensureAdminBoundaryLayers,
  ensureBasemapDetails,
} from "./basemap-details.js";
import { resolveGeoSymbol, shouldShowGeoSymbol } from "./geo-symbols.js";

describe("Magnexis Chromatic palettes", () => {
  it("uses slate highways on light; gold only at night", () => {
    // Standard mirrors Google light: muted slate majors, not gold
    expect(CHROMATIC_STANDARD.interstate.toUpperCase()).toBe("#7A8FA8");
    expect(CHROMATIC_NIGHT.interstate.toUpperCase()).toBe("#F4B95D");
    expect(CHROMATIC_STANDARD.interstate.toLowerCase()).not.toMatch(
      /#2563eb|#3188ff|#247bff|#1a73e8|#f5b942/,
    );
    expect(CHROMATIC_STANDARD.activeRoute.toUpperCase()).toBe("#1A73E8");
    expect(CHROMATIC_NIGHT.activeRoute.toUpperCase()).toBe("#65A6FF");
  });

  it("keeps night local roads brighter than the dark background", () => {
    // OFM dark uses #000 / #181818 roads — our night locals must not collapse into #101821
    expect(CHROMATIC_NIGHT.residential.toLowerCase()).not.toBe("#101821");
    expect(CHROMATIC_NIGHT.residential.toLowerCase()).not.toBe("#000000");
    expect(CHROMATIC_NIGHT.residential.toLowerCase()).not.toBe("#4a5965");
  });

  it("keeps active route visually distinct from interstate fill", () => {
    expect(CHROMATIC_STANDARD.activeRoute).not.toBe(CHROMATIC_STANDARD.interstate);
    expect(CHROMATIC_NIGHT.activeRoute).not.toBe(CHROMATIC_NIGHT.interstate);
  });

  it("resolves navigation and high-contrast themes", () => {
    expect(paletteFor("navigation").activeRoute).toBeTruthy();
    expect(paletteFor("high-contrast").labelMajor).toBe("#000000");
    expect(paletteFor("standard").background).toBe("#EDEEF0");
    expect(paletteFor("night").background).toBe("#14111A");
  });

  it("overrides OpenFreeMap dark black motorways with gold", () => {
    const paints: Record<string, Record<string, unknown>> = {};
    const map = {
      getStyle: () => ({
        layers: [
          { id: "highway_motorway_inner", type: "line" },
          { id: "highway_minor", type: "line" },
          { id: "mx-route-line", type: "line" },
        ],
      }),
      getLayer: (id: string) => (id.startsWith("mx-") ? null : {}),
      setPaintProperty: (id: string, name: string, value: unknown) => {
        paints[id] ??= {};
        paints[id][name] = value;
      },
    };
    const { adjusted, palette } = applyChromaticPaints(map, "night");
    expect(palette.interstate).toBe("#F4B95D");
    expect(adjusted).toContain("highway_motorway_inner");
    expect(paints["highway_motorway_inner"]?.["line-color"]).toBe("#F4B95D");
    expect(paints["highway_motorway_inner"]?.["line-opacity"]).toBe(1);
    expect(paints["highway_minor"]?.["line-color"]).toBe(CHROMATIC_NIGHT.residential);
    expect(adjusted).not.toContain("mx-route-line");
  });

  it("applies chromatic paints for standard theme (not a no-op)", () => {
    const paints: Record<string, Record<string, unknown>> = {};
    const map = {
      getStyle: () => ({
        layers: [{ id: "road_motorway", type: "line" }],
      }),
      getLayer: () => ({}),
      setPaintProperty: (id: string, name: string, value: unknown) => {
        paints[id] ??= {};
        paints[id][name] = value;
      },
    };
    applyChromaticPaints(map, "standard");
    expect(paints["road_motorway"]?.["line-color"]).toBe("#7A8FA8");
  });

  it("mutes night park/wood outlines so vegetation is not landmark-like", () => {
    const paints: Record<string, Record<string, unknown>> = {};
    const map = {
      getStyle: () => ({
        layers: [
          { id: "park", type: "fill" },
          { id: "park_outline", type: "line" },
          { id: "landcover_wood", type: "fill" },
          { id: "landcover_grass", type: "fill" },
          { id: "parking", type: "fill" },
        ],
      }),
      getLayer: () => ({}),
      setPaintProperty: (id: string, name: string, value: unknown) => {
        paints[id] ??= {};
        paints[id][name] = value;
      },
    };
    const { adjusted } = applyChromaticPaints(map, "night");

    expect(adjusted).toContain("park");
    expect(adjusted).toContain("landcover_wood");
    expect(adjusted).toContain("park_outline");
    expect(adjusted).not.toContain("parking");

    // Liberty neon outline must not survive night Chromatic
    expect(paints.park?.["fill-color"]).toBe(CHROMATIC_NIGHT.park);
    expect(paints.park?.["fill-outline-color"]).toBe(CHROMATIC_NIGHT.park);
    expect(paints.park?.["fill-opacity"]).toBe(0.45);

    expect(paints.landcover_wood?.["fill-color"]).toBe(CHROMATIC_NIGHT.forest);
    expect(paints.landcover_wood?.["fill-outline-color"]).toBe(
      CHROMATIC_NIGHT.forest,
    );
    expect(paints.landcover_grass?.["fill-opacity"]).toBe(0.25);

    expect(paints.park_outline?.["line-color"]).toBe(CHROMATIC_NIGHT.park);
    expect(paints.park_outline?.["line-opacity"]).toBe(0.15);
  });

  it("keeps night vegetation quieter than POI park green", () => {
    // GeoSymbol park accent is #188038 — landcover must stay darker/flatter
    expect(CHROMATIC_NIGHT.park.toLowerCase()).not.toBe("#188038");
    expect(CHROMATIC_NIGHT.forest.toLowerCase()).not.toBe("#188038");
  });
});

describe("Magnexis RouteShield", () => {
  it("parses interstate and US highway refs", () => {
    expect(parseRouteRef("I-95")?.label).toBe("I-95");
    expect(parseRouteRef("I 91")?.network).toBe("us-interstate");
    expect(parseRouteRef("US 1")?.label).toBe("US 1");
    expect(parseRouteRef("CT 15")?.label).toBe("CT 15");
    expect(parseRouteRef("County 16")?.network).toBe("us-county");
  });

  it("generates vector shield families without baking route numbers", () => {
    expect(routeShieldSvg("us-interstate")).toContain("INTERSTATE");
    expect(routeShieldSvg("us-highway")).toContain("viewBox=\"0 0 72 84\"");
    expect(routeShieldSvg("us-state")).toContain("<path");
    expect(routeShieldSvg("us-county")).toContain("COUNTY");
    expect(routeShieldSvg("us-interstate")).not.toContain("I-95");
  });

  it("never invents a shield without a ref", () => {
    expect(parseRouteRef(null)).toBeNull();
    expect(parseRouteRef("")).toBeNull();
    expect(parseRouteRef("Main Street")).toBeNull();
    expect(shieldFromFeatureProps({ name: "Broadway" })).toBeNull();
  });

  it("reads provider-agnostic property keys", () => {
    expect(
      shieldFromFeatureProps({
        route_1_ref: "I-84",
        route_1_network: "US:I",
      })?.label,
    ).toBe("I-84");
  });

  it("injects shield layers when the style omitted them (OFM dark)", () => {
    const layers: Array<{ id: string; type: string; source?: string }> = [
      { id: "highway_motorway_inner", type: "line", source: "openmaptiles" },
      { id: "highway_name_motorway", type: "symbol", source: "openmaptiles" },
    ];
    const added: string[] = [];
    const map = {
      getStyle: () => ({
        layers,
        sources: { openmaptiles: { type: "vector" } },
      }),
      getLayer: (id: string) => layers.find((l) => l.id === id) ?? null,
      getSource: (id: string) => (id === "openmaptiles" ? {} : null),
      addLayer: (layer: Record<string, unknown>) => {
        layers.push({
          id: layer.id as string,
          type: layer.type as string,
          source: layer.source as string,
        });
        added.push(layer.id as string);
      },
      setPaintProperty: () => {},
    };
    expect(styleHasHighwayShields(map)).toBe(false);
    const injected = ensureRouteShieldLayers(map);
    expect(injected).toEqual(
      expect.arrayContaining([
        "highway-shield-us-interstate",
        "road_shield_us",
        "highway-shield-non-us",
      ]),
    );
    expect(styleHasHighwayShields(map)).toBe(true);
    expect(ensureRouteShieldLayers(map)).toEqual([]);
  });

  it("promotes shields above roads; place labels above pins/route (Google-like)", () => {
    const layers: Array<{ id: string; type: string }> = [
      { id: "highway_motorway_inner", type: "line" },
      { id: "highway-shield-us-interstate", type: "symbol" },
      { id: "road_shield_us", type: "symbol" },
      { id: "label_town", type: "symbol" },
      { id: "label_city", type: "symbol" },
      { id: "mx-route-line", type: "line" },
      { id: "mx-search-results-circle", type: "circle" },
      { id: "mx-poi-circle", type: "circle" },
      { id: "mx-selection-circle", type: "circle" },
    ];
    const map = {
      getStyle: () => ({ layers }),
      getLayer: (id: string) => layers.find((l) => l.id === id) ?? null,
      moveLayer: (id: string, beforeId?: string) => {
        const idx = layers.findIndex((l) => l.id === id);
        if (idx < 0) return;
        const [layer] = layers.splice(idx, 1);
        if (beforeId) {
          const beforeIdx = layers.findIndex((l) => l.id === beforeId);
          layers.splice(beforeIdx < 0 ? layers.length : beforeIdx, 0, layer);
        } else {
          layers.push(layer);
        }
      },
      setPaintProperty: () => {},
    };
    const result = promoteMapLabelLayers(map);
    expect(result).toEqual(
      expect.arrayContaining([
        "label_city",
        "label_town",
        "highway-shield-us-interstate",
        "mx-search-results-circle",
        "mx-route-line",
      ]),
    );
    const idx = (id: string) => layers.findIndex((l) => l.id === id);
    // Selection chrome stays on top; place labels above search/route/POI.
    expect(idx("mx-selection-circle")).toBeGreaterThan(idx("label_city"));
    expect(idx("label_city")).toBeGreaterThan(idx("mx-search-results-circle"));
    expect(idx("label_town")).toBeGreaterThan(idx("mx-route-line"));
    expect(idx("label_city")).toBeGreaterThan(idx("mx-poi-circle"));
    expect(idx("highway-shield-us-interstate")).toBeGreaterThan(
      idx("highway_motorway_inner"),
    );
    expect(idx("highway-shield-us-interstate")).toBeLessThan(idx("label_city"));
    // Alias still works
    expect(promoteRouteShieldLayers(map).length).toBeGreaterThan(0);
  });
});

describe("Magnexis basemap details", () => {
  it("brightens near-invisible OFM dark boundaries for night", () => {
    const paints: Record<string, Record<string, unknown>> = {};
    const map = {
      getStyle: () => ({
        layers: [
          { id: "boundary_state", type: "line" },
          { id: "boundary_country_z5-", type: "line" },
        ],
        sources: { openmaptiles: { type: "vector" } },
      }),
      getLayer: () => ({}),
      setPaintProperty: (id: string, name: string, value: unknown) => {
        paints[id] ??= {};
        paints[id][name] = value;
      },
    };
    applyBoundaryContrast(map, "night");
    expect(paints["boundary_state"]?.["line-color"]).toBe("#9AA5B5");
    expect(paints["boundary_country_z5-"]?.["line-color"]).toBe("#C5CDD8");
  });

  it("adds mid-admin boundaries when style lacks boundary_3 (OFM dark)", () => {
    const layers: Array<{ id: string; type: string; source?: string }> = [
      { id: "highway_minor", type: "line", source: "openmaptiles" },
      // OFM dark has state-only strokes — not a substitute for admin 3–8
      { id: "boundary_state", type: "line", source: "openmaptiles" },
      { id: "boundary_country_z5-", type: "line", source: "openmaptiles" },
    ];
    const map = {
      getStyle: () => ({
        layers,
        sources: { openmaptiles: { type: "vector" } },
      }),
      getLayer: (id: string) => layers.find((l) => l.id === id) ?? null,
      getSource: (id: string) => (id === "openmaptiles" ? {} : null),
      addLayer: (layer: Record<string, unknown>) => {
        layers.push({
          id: layer.id as string,
          type: layer.type as string,
          source: layer.source as string,
        });
      },
      setPaintProperty: () => {},
    };
    const added = ensureAdminBoundaryLayers(map);
    expect(added).toContain("mx-boundary-admin");
    expect(added).not.toContain("mx-boundary-country");
  });

  it("ensureBasemapDetails is a no-op for shields when liberty already has them", () => {
    const layers = [
      {
        id: "highway-shield-us-interstate",
        type: "symbol",
        source: "openmaptiles",
      },
      { id: "road_shield_us", type: "symbol", source: "openmaptiles" },
      { id: "highway-shield-non-us", type: "symbol", source: "openmaptiles" },
      { id: "highway-name-major", type: "symbol", source: "openmaptiles" },
      { id: "highway-name-minor", type: "symbol", source: "openmaptiles" },
      { id: "highway-name-path", type: "symbol", source: "openmaptiles" },
      { id: "label_city", type: "symbol", source: "openmaptiles" },
      { id: "boundary_2", type: "line", source: "openmaptiles" },
      { id: "poi_r20", type: "symbol", source: "openmaptiles" },
    ];
    const map = {
      getStyle: () => ({
        layers,
        sources: { openmaptiles: { type: "vector" } },
      }),
      getLayer: (id: string) => layers.find((l) => l.id === id) ?? null,
      getSource: (id: string) =>
        id === "openmaptiles" ? { type: "vector" } : null,
      addSource: () => {
        throw new Error("should not add source");
      },
      addLayer: () => {
        throw new Error("should not add");
      },
      setPaintProperty: () => {},
      setLayoutProperty: () => {},
    };
    const result = ensureBasemapDetails(map, "night");
    expect(result.shields).toEqual([]);
    expect(result.pois).toEqual([]);
    expect(result.labels.added).toEqual([]);
  });

  it("styleHasHighwayShields ignores MapTiler-named shield layers", () => {
    const layers = [
      { id: "Highway shield", type: "symbol", source: "maptiler_planet" },
      { id: "Highway shield (US)", type: "symbol", source: "maptiler_planet" },
    ];
    const map = {
      getStyle: () => ({ layers, sources: {} }),
      getLayer: (id: string) => layers.find((l) => l.id === id) ?? null,
    };
    expect(styleHasHighwayShields(map)).toBe(false);
  });
});

describe("shared map labels", () => {
  it("injects liberty road labels onto a blank satellite-like style", async () => {
    const { ensureSharedMapLabels, SHARED_ROAD_LABEL_IDS } = await import(
      "./shared-labels.js"
    );
    const layers: Array<{
      id: string;
      type: string;
      source?: string;
      "source-layer"?: string;
    }> = [
      { id: "Satellite", type: "raster", source: "satellite" },
      {
        id: "Road labels",
        type: "symbol",
        source: "maptiler_planet",
        "source-layer": "road_label",
      },
    ];
    const sources: Record<string, unknown> = {
      satellite: { type: "raster" },
      maptiler_planet: { type: "vector" },
    };
    const visibility: Record<string, string> = { "Road labels": "none" };
    const map = {
      getStyle: () => ({ layers, sources }),
      getLayer: (id: string) => layers.find((l) => l.id === id) ?? null,
      getSource: (id: string) => sources[id] ?? null,
      addSource: (id: string, source: unknown) => {
        sources[id] = source;
      },
      addLayer: (layer: Record<string, unknown>) => {
        layers.push({
          id: layer.id as string,
          type: layer.type as string,
          source: layer.source as string,
          "source-layer": layer["source-layer"] as string | undefined,
        });
      },
      setPaintProperty: () => {},
      setLayoutProperty: (id: string, name: string, value: unknown) => {
        if (name === "visibility") visibility[id] = value as string;
      },
    };
    const result = ensureSharedMapLabels(map, {
      surface: "imagery",
      theme: "night",
    });
    expect(result.sourceId).toBe("mx-openmaptiles");
    for (const id of SHARED_ROAD_LABEL_IDS) {
      expect(map.getLayer(id)).toBeTruthy();
    }
    expect(result.suppressed).toContain("Road labels");
    expect(visibility["Road labels"]).toBe("none");
    expect(visibility["highway-name-major"]).toBe("visible");
  });
});

describe("Magnexis GeoSymbols", () => {
  it("maps place categories to symbols without fabricating places", () => {
    expect(resolveGeoSymbol("hospital").category).toBe("hospital");
    expect(resolveGeoSymbol("park").color).toBe("#188038");
    expect(resolveGeoSymbol("parking").iconId).toBe("mx-poi-parking");
  });

  it("respects zoom and density modes", () => {
    const restaurant = resolveGeoSymbol("restaurant");
    expect(shouldShowGeoSymbol(restaurant, 10, "all")).toBe(false);
    expect(shouldShowGeoSymbol(restaurant, 11, "all")).toBe(true);
    expect(shouldShowGeoSymbol(restaurant, 11, "essential")).toBe(false);
    expect(shouldShowGeoSymbol(restaurant, 12, "hidden")).toBe(false);
    const airport = resolveGeoSymbol("airport");
    expect(shouldShowGeoSymbol(airport, 8, "essential")).toBe(true);
  });
});

describe("imagery hybrid road overlays", () => {
  it("injects transportation lines onto a satellite-like style", async () => {
    const { ensureImageryRoadOverlays, IMAGERY_HYBRID_ROAD_IDS } = await import(
      "./imagery-roads.js"
    );
    const layers: Array<{ id: string; type: string; source?: string }> = [
      { id: "Satellite", type: "raster", source: "satellite" },
    ];
    const sources: Record<string, unknown> = {
      satellite: { type: "raster" },
    };
    const map = {
      getStyle: () => ({ layers, sources }),
      getLayer: (id: string) => layers.find((l) => l.id === id) ?? null,
      getSource: (id: string) => sources[id] ?? null,
      addSource: (id: string, source: unknown) => {
        sources[id] = source;
      },
      addLayer: (layer: Record<string, unknown>, _before?: string) => {
        layers.push({
          id: layer.id as string,
          type: layer.type as string,
          source: layer.source as string,
        });
      },
      setPaintProperty: () => {},
      setLayoutProperty: () => {},
      moveLayer: () => {},
    };
    const added = ensureImageryRoadOverlays(map, "night", true);
    expect(sources["mx-openmaptiles"]).toBeTruthy();
    expect(added.length).toBeGreaterThan(0);
    expect(map.getLayer("mx-hybrid-motorway")).toBeTruthy();
    expect(IMAGERY_HYBRID_ROAD_IDS).toContain("mx-hybrid-motorway");
  });
});
