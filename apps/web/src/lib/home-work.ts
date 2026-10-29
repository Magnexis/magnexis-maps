import type { SearchResult } from "@magnexis/shared";

const HOME_WORK_KEY = "magnexis_home_work";

export type SavedSlot = {
  label: string;
  coordinates: { lng: number; lat: number };
  address?: string;
  updatedAt: string;
};

export type HomeWorkSlots = {
  home: SavedSlot | null;
  work: SavedSlot | null;
};

export function loadHomeWork(): HomeWorkSlots {
  if (typeof window === "undefined") return { home: null, work: null };
  try {
    const raw = window.localStorage.getItem(HOME_WORK_KEY);
    if (!raw) return { home: null, work: null };
    const parsed = JSON.parse(raw) as Partial<HomeWorkSlots>;
    return {
      home: isSlot(parsed.home) ? parsed.home : null,
      work: isSlot(parsed.work) ? parsed.work : null,
    };
  } catch {
    return { home: null, work: null };
  }
}

function isSlot(v: unknown): v is SavedSlot {
  return (
    Boolean(v) &&
    typeof v === "object" &&
    typeof (v as SavedSlot).label === "string" &&
    typeof (v as SavedSlot).coordinates?.lng === "number" &&
    typeof (v as SavedSlot).coordinates?.lat === "number"
  );
}

export function persistHomeWork(slots: HomeWorkSlots) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HOME_WORK_KEY, JSON.stringify(slots));
  } catch {
    // quota / private mode
  }
}

export function setHomeWorkSlot(
  kind: "home" | "work",
  slot: SavedSlot | null,
): HomeWorkSlots {
  const next = { ...loadHomeWork(), [kind]: slot };
  persistHomeWork(next);
  return next;
}

export function slotFromSearch(
  result: SearchResult,
  defaultLabel: string,
): SavedSlot | null {
  if (!result.coordinates) return null;
  return {
    label: result.label || defaultLabel,
    coordinates: result.coordinates,
    address: result.address,
    updatedAt: new Date().toISOString(),
  };
}

export function searchFromSlot(
  kind: "home" | "work",
  slot: SavedSlot,
): SearchResult {
  return {
    id: `slot-${kind}`,
    label: kind === "home" ? `Home · ${slot.label}` : `Work · ${slot.label}`,
    kind: "place",
    coordinates: slot.coordinates,
    address: slot.address,
    source: "internal",
    verified: false,
  };
}
