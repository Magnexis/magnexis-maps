import { useAppStore } from "@/lib/store";
import {
  findNearestMapillaryImage,
  mapillaryConfigured,
} from "@/lib/mapillary";

/**
 * Open street view at a map coordinate.
 * Opens Mapillary interactive imagery when coverage exists.
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
      console.warn(
        "[street-view] Mapillary lookup failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  store.closeStreetView();
  store.setStreetViewError(
    mapillaryConfigured()
      ? "No Mapillary imagery within 50 m of this point."
      : "Street imagery is unavailable until Mapillary is configured.",
  );
  return false;
}
