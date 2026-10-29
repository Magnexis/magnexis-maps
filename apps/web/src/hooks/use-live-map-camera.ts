"use client";

import { useEffect, useState } from "react";
import { getMap, subscribeMap } from "@/lib/map-registry";
import { useAppStore } from "@/lib/store";

/**
 * Live bearing/pitch from the MapLibre instance (not just the Zustand mirror).
 * Keeps the compass FAB accurate even if store sync briefly lags.
 */
export function useLiveMapCamera() {
  const storeBearing = useAppStore((s) => s.mapView.bearing);
  const storePitch = useAppStore((s) => s.mapView.pitch);
  const [camera, setCamera] = useState({
    bearing: storeBearing,
    pitch: storePitch,
  });

  useEffect(() => {
    let map: ReturnType<typeof getMap> = null;

    const read = () => {
      if (!map) {
        setCamera({ bearing: storeBearing, pitch: storePitch });
        return;
      }
      setCamera({
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      });
    };

    const bind = (next: ReturnType<typeof getMap>) => {
      if (map) {
        map.off("rotate", read);
        map.off("pitch", read);
        map.off("moveend", read);
      }
      map = next;
      if (map) {
        map.on("rotate", read);
        map.on("pitch", read);
        map.on("moveend", read);
      }
      read();
    };

    const unsub = subscribeMap(bind);
    return () => {
      unsub();
      if (map) {
        map.off("rotate", read);
        map.off("pitch", read);
        map.off("moveend", read);
      }
    };
  }, [storeBearing, storePitch]);

  return camera;
}
