import { describe, expect, it } from "vitest";
import {
  BUILDING_3D_LAYER_ID,
  applyBuildings3d,
  ensureBuildingExtrusionLayer,
  listBuildingExtrusionLayerIds,
} from "./buildings-3d.js";

function mockMap(opts: {
  layers: Array<{
    id: string;
    type: string;
    source?: string;
    "source-layer"?: string;
  }>;
  sources?: Record<string, unknown>;
}) {
  const layers = [...opts.layers];
  const sources = { ...(opts.sources ?? { openmaptiles: { type: "vector" } }) };
  const layout: Record<string, Record<string, unknown>> = {};
  const paint: Record<string, Record<string, unknown>> = {};
  const added: unknown[] = [];

  return {
    getStyle: () => ({ layers, sources }),
    getLayer: (id: string) => layers.find((l) => l.id === id) ?? null,
    getSource: (id: string) => sources[id] ?? null,
    addLayer: (layer: { id: string; type: string }, beforeId?: string) => {
      added.push({ layer, beforeId });
      const idx = beforeId
        ? layers.findIndex((l) => l.id === beforeId)
        : -1;
      if (idx >= 0) layers.splice(idx, 0, layer as (typeof layers)[0]);
      else layers.push(layer as (typeof layers)[0]);
    },
    setLayoutProperty: (id: string, name: string, value: unknown) => {
      layout[id] ??= {};
      layout[id][name] = value;
    },
    setPaintProperty: (id: string, name: string, value: unknown) => {
      paint[id] ??= {};
      paint[id][name] = value;
    },
    _layout: layout,
    _paint: paint,
    _added: added,
    _layers: layers,
  };
}

describe("buildings-3d", () => {
  it("lists native OFM building-3d extrusion", () => {
    const map = mockMap({
      layers: [
        {
          id: "building",
          type: "fill",
          source: "openmaptiles",
          "source-layer": "building",
        },
        {
          id: "building-3d",
          type: "fill-extrusion",
          source: "openmaptiles",
          "source-layer": "building",
        },
      ],
    });
    expect(listBuildingExtrusionLayerIds(map)).toEqual(["building-3d"]);
  });

  it("does not stack mx-building-3d over native OFM extrusion", () => {
    const map = mockMap({
      layers: [
        {
          id: "building-3d",
          type: "fill-extrusion",
          source: "openmaptiles",
          "source-layer": "building",
        },
        { id: "highway-name-major", type: "symbol", source: "openmaptiles" },
      ],
    });
    expect(ensureBuildingExtrusionLayer(map, "night")).toBe(true);
    expect(map._added).toHaveLength(0);
    expect(map._paint["building-3d"]?.["fill-extrusion-color"]).toBe("#5B6F86");
  });

  it("hides mx duplicate when enabling 3D with native layer present", () => {
    const map = mockMap({
      layers: [
        {
          id: "building-3d",
          type: "fill-extrusion",
          source: "openmaptiles",
          "source-layer": "building",
        },
        {
          id: BUILDING_3D_LAYER_ID,
          type: "fill-extrusion",
          source: "openmaptiles",
          "source-layer": "building",
        },
        {
          id: "building",
          type: "fill",
          source: "openmaptiles",
          "source-layer": "building",
        },
      ],
    });
    applyBuildings3d(map, true, "night", true);
    expect(map._layout[BUILDING_3D_LAYER_ID]?.visibility).toBe("none");
    expect(map._layout["building-3d"]?.visibility).toBe("visible");
    expect(map._layout.building?.visibility).toBe("none");
  });

  it("injects mx-building-3d when style has no extrusion", () => {
    const map = mockMap({
      layers: [
        { id: "highway-name-major", type: "symbol", source: "openmaptiles" },
      ],
    });
    expect(ensureBuildingExtrusionLayer(map, "standard")).toBe(true);
    expect(map._added).toHaveLength(1);
    expect(map.getLayer(BUILDING_3D_LAYER_ID)).toBeTruthy();
    applyBuildings3d(map, true, "standard", true);
    expect(map._layout[BUILDING_3D_LAYER_ID]?.visibility).toBe("visible");
  });
});
