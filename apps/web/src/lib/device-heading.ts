/**
 * Device compass / GPS heading helpers for the blue location marker cone.
 * Degrees clockwise from true/magnetic north (MapLibre Marker.setRotation).
 */

export type DeviceOrientationLike = {
  absolute?: boolean;
  alpha?: number | null;
  beta?: number | null;
  gamma?: number | null;
  webkitCompassHeading?: number | null;
};

/** Coarse / touch-first devices where a facing cone is useful. */
export function isMobileMapClient(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia("(pointer: coarse)").matches) return true;
  } catch {
    // ignore
  }
  return (
    (navigator.maxTouchPoints ?? 0) > 0 ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  );
}

export function normalizeHeadingDegrees(deg: number): number {
  const n = deg % 360;
  return n < 0 ? n + 360 : n;
}

/** Prefer GPS heading when the device is moving; otherwise null. */
export function headingFromGeolocationCoords(
  coords: GeolocationCoordinates,
): number | undefined {
  const h = coords.heading;
  if (h == null || !Number.isFinite(h) || h < 0) return undefined;
  return normalizeHeadingDegrees(h);
}

/**
 * Compass heading from DeviceOrientationEvent.
 * iOS: webkitCompassHeading. Absolute alpha elsewhere (converted to north-based).
 */
export function headingFromDeviceOrientation(
  event: DeviceOrientationLike,
): number | undefined {
  const webkit = event.webkitCompassHeading;
  if (typeof webkit === "number" && Number.isFinite(webkit) && webkit >= 0) {
    return normalizeHeadingDegrees(webkit);
  }
  if (
    event.absolute &&
    typeof event.alpha === "number" &&
    Number.isFinite(event.alpha)
  ) {
    // alpha is clockwise from north in absolute mode on most browsers —
    // invert so 0° = north for our upward-facing cone.
    return normalizeHeadingDegrees(360 - event.alpha);
  }
  return undefined;
}

type OrientationPermission = {
  requestPermission?: () => Promise<"granted" | "denied" | "default">;
};

/** iOS 13+ requires a user gesture to unlock compass events. */
export async function requestDeviceOrientationPermission(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const DOE = DeviceOrientationEvent as unknown as OrientationPermission;
  if (typeof DOE.requestPermission !== "function") return true;
  try {
    const result = await DOE.requestPermission();
    return result === "granted";
  } catch {
    return false;
  }
}
