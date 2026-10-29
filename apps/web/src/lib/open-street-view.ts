import { useAppStore } from "@/lib/store";
import {
  findNearestMapillaryImage,
  mapillaryConfigured,
} from "@/lib/mapillary";
import {
  fetchGoogleProviderStatus,
  googleStreetViewMeta,
} from "@/lib/google-maps";

/**
 * Open street view at a map coordinate.
 * Prefers Mapillary interactive viewer; falls back to Google Street View Static
 * via the API proxy when Mapillary misses or is not configured.
 */
export async function openStreetViewAt(
  lng: number,
  lat: number,
): Promise<boolean> {
  const store = useAppStore.getState();
  store.setStreetViewError(null);

  if (mapillaryConfigured()) {
    try {
      const hit = await findNearestMapillaryImage(lng, lat, 50);
      if (hit) {
        store.setStreetViewImageId(hit.id);
        return true;
      }
    } catch (err) {
      // Fall through to Google when Mapillary errors.
      console.warn(
        "[street-view] Mapillary lookup failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  const google = await fetchGoogleProviderStatus();
  if (google.configured) {
    try {
      const meta = await googleStreetViewMeta(lng, lat);
      if (meta.available) {
        store.setStreetViewGoogle({ lng, lat });
        return true;
      }
    } catch {
      // fall through to error message
    }
  }

  let message: string;
  if (!mapillaryConfigured() && !google.configured) {
    message =
      "Add NEXT_PUBLIC_MAPILLARY_ACCESS_TOKEN and/or GOOGLE_MAPS_API_KEY (API server) for street view.";
  } else if (!mapillaryConfigured()) {
    message = "No Google Street View imagery within 50 m of this point.";
  } else if (!google.configured) {
    message =
      "No Mapillary imagery within 50 m. Set GOOGLE_MAPS_API_KEY on the API for Street View fallback.";
  } else {
    message =
      "No Mapillary or Google Street View imagery within 50 m of this point.";
  }

  store.closeStreetView();
  store.setStreetViewError(message);
  return false;
}
