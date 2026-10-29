import type { Map } from "maplibre-gl";

let activeMap: Map | null = null;

type MapListener = (map: Map | null) => void;
const listeners = new Set<MapListener>();

declare global {
  interface Window {
    __mxMap?: Map | null;
  }
}

export function registerMap(map: Map | null) {
  activeMap = map;
  if (typeof window !== "undefined") {
    window.__mxMap = map;
  }
  listeners.forEach((listener) => listener(map));
}

export function getMap(): Map | null {
  return activeMap;
}

/** Subscribe to map instance register/unregister (Horizon chrome, etc.). */
export function subscribeMap(listener: MapListener): () => void {
  listeners.add(listener);
  listener(activeMap);
  return () => {
    listeners.delete(listener);
  };
}
