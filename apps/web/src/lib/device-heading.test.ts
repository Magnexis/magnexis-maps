import { describe, expect, it } from "vitest";
import { headingFromDeviceOrientation } from "./device-heading";

describe("headingFromDeviceOrientation", () => {
  it("preserves absolute alpha as clockwise-from-north marker rotation", () => {
    expect(
      headingFromDeviceOrientation({ absolute: true, alpha: 90 }),
    ).toBe(90);
    expect(
      headingFromDeviceOrientation({ absolute: true, alpha: 270 }),
    ).toBe(270);
  });

  it("continues to prefer the iOS compass heading", () => {
    expect(
      headingFromDeviceOrientation({
        absolute: true,
        alpha: 270,
        webkitCompassHeading: 90,
      }),
    ).toBe(90);
  });
});
