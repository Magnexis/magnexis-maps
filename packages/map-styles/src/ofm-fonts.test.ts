import { describe, expect, it } from "vitest";
import {
  OFM_FONT_BOLD,
  OFM_FONT_ITALIC,
  OFM_FONT_REGULAR,
} from "./ofm-fonts.js";
import { applyRouteShieldLabelContrast } from "./route-shield.js";

describe("OFM fonts", () => {
  it("uses single Noto stacks (no Open Sans composites that 404)", () => {
    for (const stack of [OFM_FONT_REGULAR, OFM_FONT_BOLD, OFM_FONT_ITALIC]) {
      expect(stack).toHaveLength(1);
      expect(stack[0]).toMatch(/^Noto Sans /);
      expect(stack.join(",")).not.toMatch(/Open Sans/i);
    }
  });

  it("applyRouteShieldLabelContrast sets OFM-safe bold font", () => {
    const layout: Record<string, unknown> = {};
    const map = {
      getStyle: () => ({
        layers: [{ id: "highway-shield-us-interstate", type: "symbol" }],
      }),
      getLayer: (id: string) => (id === "highway-shield-us-interstate" ? {} : null),
      setPaintProperty: () => undefined,
      setLayoutProperty: (id: string, name: string, value: unknown) => {
        layout[`${id}:${name}`] = value;
      },
    };
    applyRouteShieldLabelContrast(map, false);
    expect(layout["highway-shield-us-interstate:text-font"]).toEqual([
      "Noto Sans Bold",
    ]);
  });
});
