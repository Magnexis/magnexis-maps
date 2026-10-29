"use client";

import { getGeolocation } from "@/lib/geolocation";

import { useCallback, useEffect, useRef } from "react";
import { headingFromGeolocationCoords } from "@/lib/device-heading";
import { useAppStore, type UserLocation } from "@/lib/store";

export type GeolocationStatus =
  "idle" | "watching" | "denied" | "unavailable" | "error";

const WATCH_OPTS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 4000,
  timeout: 15000,
};

const ONCE_OPTS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 2000,
  timeout: 12000,
};

function coordsToLocation(
  coords: GeolocationCoordinates,
  previous?: UserLocation | null,
): UserLocation {
  const gpsHeading = headingFromGeolocationCoords(coords);
  const speed =
    typeof coords.speed === "number" && Number.isFinite(coords.speed)
      ? coords.speed
      : null;
  return {
    lng: coords.longitude,
    lat: coords.latitude,
    accuracy: Number.isFinite(coords.accuracy) ? coords.accuracy : undefined,
    // Keep last compass heading when GPS omits heading (stationary).
    heading: gpsHeading ?? previous?.heading,
    speedMps: speed,
  };
}

/**
 * Continuous device location while the map (or caller) is mounted.
 * Updates `userLocation` in the app store; fails closed if permission is denied.
 */
export function useGeolocation(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const hasLocation = useAppStore((s) => s.userLocation !== null);
  const setUserLocation = useAppStore((s) => s.setUserLocation);
  const watchIdRef = useRef<number | null>(null);
  const statusRef = useRef<GeolocationStatus>("idle");

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !getGeolocation()) {
      statusRef.current = "unavailable";
      return;
    }

    watchIdRef.current = getGeolocation()!.watchPosition(
      (pos) => {
        statusRef.current = "watching";
        setUserLocation(
          coordsToLocation(pos.coords, useAppStore.getState().userLocation),
        );
      },
      (err) => {
        statusRef.current =
          err.code === err.PERMISSION_DENIED ? "denied" : "error";
      },
      WATCH_OPTS,
    );

    return () => {
      if (watchIdRef.current != null) {
        getGeolocation()?.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, hasLocation, setUserLocation]);

  const locateOnce = useCallback(
    (onSuccess?: (loc: UserLocation) => void, onError?: () => void) => {
      if (typeof navigator === "undefined" || !getGeolocation()) {
        onError?.();
        return;
      }
      getGeolocation()?.getCurrentPosition(
        (pos) => {
          const loc = coordsToLocation(
            pos.coords,
            useAppStore.getState().userLocation,
          );
          setUserLocation(loc);
          onSuccess?.(loc);
        },
        () => {
          statusRef.current = "denied";
          onError?.();
        },
        ONCE_OPTS,
      );
    },
    [setUserLocation],
  );

  return { locateOnce, statusRef };
}
