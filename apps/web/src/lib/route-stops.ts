import { CoordinatesSchema, type SearchResult } from "@magnexis/shared";
import { MAX_ROUTE_STOPS } from "./share-links";

export class RouteStopError extends Error {
  readonly code = "UNRESOLVED_ROUTE_STOP";
  constructor(message: string) {
    super(message);
    this.name = "RouteStopError";
  }
}

/** Never silently omit a nonempty stop or re-geocode a known shared coordinate. */
export async function resolveRouteStops(
  drafts: string[],
  known: SearchResult[],
  resolve: (query: string) => Promise<SearchResult | null>,
): Promise<SearchResult[]> {
  const labels = drafts.map((label) => label.trim()).filter(Boolean);
  if (labels.length > MAX_ROUTE_STOPS)
    throw new RouteStopError(
      `Use at most ${MAX_ROUTE_STOPS} intermediate stops.`,
    );
  const result: SearchResult[] = [];
  for (const [index, label] of labels.entries()) {
    const sameLabel = known.filter((stop) => stop.label === label);
    const existing =
      known[index]?.label === label
        ? known[index]
        : sameLabel.length === 1
          ? sameLabel[0]
          : undefined;
    const stop =
      existing && CoordinatesSchema.safeParse(existing.coordinates).success
        ? existing
        : await resolve(label);
    if (!stop || !CoordinatesSchema.safeParse(stop.coordinates).success) {
      throw new RouteStopError(
        `Stop ${index + 1} (${label}) could not be found. Enter a more specific place or address and try again.`,
      );
    }
    result.push(stop);
  }
  return result;
}
