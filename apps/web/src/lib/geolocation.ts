import { Capacitor } from "@capacitor/core";
import {
  Geolocation as NativeGeolocation,
  type GeolocationPlugin,
  type Position,
} from "@capacitor/geolocation";

export function geolocationFailureMessage(code: number): string {
  if (code === 1)
    return "Location access was denied. Enable it in your device or browser settings, or enter a starting point manually.";
  if (code === 3)
    return "Finding your location took too long. Move to an open area and try again.";
  return "Your location is unavailable. Check Location Services or enter a starting point manually.";
}

function browserPosition(position: Position): GeolocationPosition {
  const values = {
    ...position.coords,
    altitudeAccuracy: position.coords.altitudeAccuracy ?? null,
  };
  const coords: GeolocationCoordinates = { ...values, toJSON: () => values };
  return {
    coords,
    timestamp: position.timestamp,
    toJSON: () => ({ coords: values, timestamp: position.timestamp }),
  };
}

function browserError(error: unknown): GeolocationPositionError {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  return {
    code:
      code === "OS-PLUG-GLOC-0003" ? 1 : code === "OS-PLUG-GLOC-0010" ? 3 : 2,
    message: geolocationFailureMessage(
      code === "OS-PLUG-GLOC-0003" ? 1 : code === "OS-PLUG-GLOC-0010" ? 3 : 2,
    ),
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  };
}

/** Keeps the browser callback contract, including cancellation before native watch creation resolves. */
export function createNativeGeolocation(
  plugin: GeolocationPlugin,
): Geolocation {
  let nextId = 0;
  const watches = new Map<number, { nativeId?: string; cancelled: boolean }>();
  return {
    getCurrentPosition(success, error, options) {
      void plugin
        .requestPermissions({ permissions: ["location"] })
        .then((permission) => {
          if (permission.location !== "granted")
            throw { code: "OS-PLUG-GLOC-0003" };
          return plugin.getCurrentPosition(options);
        })
        .then(
          (position) => success(browserPosition(position)),
          (failure: unknown) => error?.(browserError(failure)),
        );
    },
    watchPosition(success, error, options) {
      const id = ++nextId;
      const watch = {
        cancelled: false,
        nativeId: undefined as string | undefined,
      };
      watches.set(id, watch);
      // A passive map watch must not trigger a permission dialog. Locate/start
      // navigation asks explicitly; this watch can resume after permission grants.
      void plugin
        .checkPermissions()
        .then(async (permission) => {
          if (watch.cancelled) return;
          if (permission.location !== "granted")
            throw { code: "OS-PLUG-GLOC-0003" };
          watch.nativeId = await plugin.watchPosition(
            options ?? {},
            (position, failure) => {
              if (watch.cancelled) return;
              if (failure) error?.(browserError(failure));
              else if (position) success(browserPosition(position));
            },
          );
          if (watch.cancelled) await plugin.clearWatch({ id: watch.nativeId });
        })
        .catch((failure: unknown) => {
          watches.delete(id);
          if (!watch.cancelled) error?.(browserError(failure));
        });
      return id;
    },
    clearWatch(id) {
      const watch = watches.get(id);
      if (!watch) return;
      watch.cancelled = true;
      watches.delete(id);
      if (watch.nativeId)
        void plugin.clearWatch({ id: watch.nativeId }).catch(() => {
          // Keep the cancelled flag set so late native callbacks cannot update UI.
        });
    },
  };
}

let nativeProvider: Geolocation | undefined;
export function getGeolocation(): Geolocation | undefined {
  if (typeof navigator === "undefined") return undefined;
  if (!Capacitor.isNativePlatform()) return navigator.geolocation;
  nativeProvider ??= createNativeGeolocation(NativeGeolocation);
  return nativeProvider;
}
