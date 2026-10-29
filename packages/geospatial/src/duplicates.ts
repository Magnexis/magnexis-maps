import { haversineMeters, type Coordinates } from "@magnexis/shared";

export function scoreDuplicateCandidate(
  a: { name: string; coordinates: Coordinates },
  b: { name: string; coordinates: Coordinates },
): number {
  const distance = haversineMeters(a.coordinates, b.coordinates);
  const nameA = a.name.trim().toLowerCase();
  const nameB = b.name.trim().toLowerCase();
  const nameScore = nameA === nameB ? 1 : nameA.includes(nameB) || nameB.includes(nameA) ? 0.7 : 0.2;
  const distanceScore =
    distance <= 25 ? 1 : distance <= 100 ? 0.7 : distance <= 250 ? 0.4 : 0;
  return Number((nameScore * 0.6 + distanceScore * 0.4).toFixed(3));
}
