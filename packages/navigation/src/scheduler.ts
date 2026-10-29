import type { Route } from "@magnexis/shared";
import { haversineMeters } from "@magnexis/shared";

export type SchedulerState = {
  maneuverIndex: number;
  lastSpokenKey: string | null;
  arrived: boolean;
};

export type InstructionScheduler = {
  reset(): void;
  /** Returns spoken text when guidance should fire; null otherwise. */
  tick(input: {
    position: { lng: number; lat: number };
    route: Route;
    verbosity?: "brief" | "normal" | "detailed";
  }): string | null;
  getState(): SchedulerState;
};

export function formatDistanceForSpeech(meters: number): string {
  if (meters < 30) return "now";
  if (meters < 300) {
    const feet = Math.round((meters * 3.28084) / 50) * 50;
    return `in ${feet} feet`;
  }
  const miles = meters / 1609.344;
  if (miles < 10) return `in ${miles.toFixed(1)} miles`;
  return `in ${Math.round(miles)} miles`;
}

/**
 * Speaks advance + near-maneuver guidance from real route maneuvers.
 * Does not invent road names — uses instruction text from the routing provider.
 */
export function createInstructionScheduler(): InstructionScheduler {
  let state: SchedulerState = {
    maneuverIndex: 0,
    lastSpokenKey: null,
    arrived: false,
  };

  return {
    reset() {
      state = { maneuverIndex: 0, lastSpokenKey: null, arrived: false };
    },
    getState() {
      return { ...state };
    },
    tick({ position, route, verbosity = "normal" }) {
      if (state.arrived || route.maneuvers.length === 0) return null;

      const idx = Math.min(state.maneuverIndex, route.maneuvers.length - 1);
      const maneuver = route.maneuvers[idx]!;
      const coords =
        maneuver.coordinates ??
        route.geometry.coordinates[
          Math.min(
            route.geometry.coordinates.length - 1,
            Math.floor(
              (idx / Math.max(1, route.maneuvers.length - 1)) *
                (route.geometry.coordinates.length - 1),
            ),
          )
        ];

      let distance = maneuver.distanceMeters;
      if (coords) {
        const [lng, lat] = Array.isArray(coords)
          ? (coords as [number, number])
          : [coords.lng, coords.lat];
        distance = haversineMeters(position, { lng, lat });
      }

      // Arrival: last maneuver + close
      if (idx >= route.maneuvers.length - 1 && distance < 40) {
        const key = "arrived";
        if (state.lastSpokenKey === key) return null;
        state.arrived = true;
        state.lastSpokenKey = key;
        return "You have arrived at your destination.";
      }

      const advance =
        verbosity === "brief" ? 400 : verbosity === "detailed" ? 1200 : 800;
      const near = verbosity === "brief" ? 80 : 120;

      let phase: "advance" | "near" | null = null;
      if (distance <= near) phase = "near";
      else if (distance <= advance) phase = "advance";

      if (!phase) return null;

      const key = `${idx}:${phase}`;
      if (phase === "near" && distance < 45) {
        // Progress must advance even if an earlier GPS fix already spoke the
        // near cue. Suppressing duplicate speech must not suppress movement.
        state.maneuverIndex = Math.min(idx + 1, route.maneuvers.length - 1);
      }

      if (state.lastSpokenKey === key) return null;
      state.lastSpokenKey = key;

      const prefix =
        phase === "near" ? "" : `${formatDistanceForSpeech(distance)}, `;
      return `${prefix}${maneuver.instruction}`.trim();
    },
  };
}
