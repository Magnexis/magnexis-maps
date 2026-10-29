"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";
import {
  headingFromDeviceOrientation,
  isMobileMapClient,
  requestDeviceOrientationPermission,
  type DeviceOrientationLike,
} from "@/lib/device-heading";

/**
 * On mobile, listen for compass orientation and merge `heading` into
 * `userLocation` so the blue marker cone can point the way the user faces.
 * Requires an existing GPS fix; does nothing on desktop / without permission.
 */
export function useDeviceHeading(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const startedRef = useRef(false);
  const lastHeadingRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    if (!isMobileMapClient()) return;

    let cancelled = false;
    let listening = false;

    const onOrientation = (event: Event) => {
      const heading = headingFromDeviceOrientation(
        event as DeviceOrientationLike,
      );
      if (heading == null) return;
      // Skip tiny jitter to avoid thrashing React / marker rotation.
      const prev = lastHeadingRef.current;
      if (prev != null && Math.abs(((heading - prev + 540) % 360) - 180) < 2) {
        return;
      }
      lastHeadingRef.current = heading;
      const loc = useAppStore.getState().userLocation;
      if (!loc) return;
      if (loc.heading != null && Math.abs(loc.heading - heading) < 1.5) return;
      useAppStore.getState().setUserLocation({ ...loc, heading });
    };

    const start = async () => {
      if (cancelled || listening) return;
      const ok = await requestDeviceOrientationPermission();
      if (cancelled || !ok) return;
      // Prefer absolute compass when the browser exposes it.
      window.addEventListener("deviceorientationabsolute", onOrientation, true);
      window.addEventListener("deviceorientation", onOrientation, true);
      listening = true;
      startedRef.current = true;
    };

    // Start once we have a GPS fix (locate / watch). Re-try on first touch
    // so iOS can grant permission from a user gesture if needed.
    const unsub = useAppStore.subscribe((state, prev) => {
      if (state.userLocation && !prev.userLocation) {
        void start();
      }
    });
    if (useAppStore.getState().userLocation) {
      void start();
    }

    const onGesture = () => {
      if (!startedRef.current) void start();
    };
    window.addEventListener("touchend", onGesture, { once: true, passive: true });
    window.addEventListener("click", onGesture, { once: true });

    return () => {
      cancelled = true;
      unsub();
      window.removeEventListener("deviceorientationabsolute", onOrientation, true);
      window.removeEventListener("deviceorientation", onOrientation, true);
      window.removeEventListener("touchend", onGesture);
      window.removeEventListener("click", onGesture);
    };
  }, [enabled]);
}
