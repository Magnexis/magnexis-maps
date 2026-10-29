/** Format distance using user unit preference (Google Maps–style). */
export function formatDistanceMeters(
  meters: number,
  units: "imperial" | "metric" = "imperial",
): string {
  if (!Number.isFinite(meters) || meters < 0) return "—";
  if (units === "metric") {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
  }
  const miles = meters / 1609.344;
  if (miles < 0.1) {
    const feet = meters * 3.28084;
    return `${Math.round(feet)} ft`;
  }
  return `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
}

/** Format duration in compact spoken/UI form. */
export function formatDurationSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const totalMin = Math.round(seconds / 60);
  if (totalMin < 60) return `${Math.max(1, totalMin)} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}

export function formatRouteSummary(
  distanceMeters: number,
  durationSeconds: number,
  units: "imperial" | "metric" = "imperial",
): string {
  return `${formatDistanceMeters(distanceMeters, units)} · ${formatDurationSeconds(durationSeconds)}`;
}

/** Google Maps–style arrival clock from a duration (local timezone). */
export function formatArrivalTime(
  durationSeconds: number,
  now: Date = new Date(),
): string {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) return "—";
  const arrive = new Date(now.getTime() + durationSeconds * 1000);
  return arrive.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Congestion delay label when TomTom (or similar) reports trafficDelaySeconds. */
export function formatTrafficDelay(delaySeconds?: number | null): string | null {
  if (delaySeconds == null || !Number.isFinite(delaySeconds) || delaySeconds < 45) {
    return null;
  }
  const mins = Math.round(delaySeconds / 60);
  if (mins < 1) return null;
  return `+${mins} min traffic`;
}
