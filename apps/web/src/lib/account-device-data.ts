const PERSONAL_DEVICE_KEYS = [
  "magnexis_favorite_places",
  "magnexis_recent_searches",
  "magnexis_recent_places",
  "magnexis_home_work",
] as const;

/** Called only after the API confirms deletion; never clears unrelated origin storage. */
export function clearDeletedAccountDeviceData(
  storage: Pick<Storage, "removeItem">,
  clearLocalPlaces: boolean,
): string[] {
  const failures: string[] = [];
  for (const key of [
    "magnexis_token",
    ...(clearLocalPlaces ? PERSONAL_DEVICE_KEYS : []),
  ]) {
    try {
      storage.removeItem(key);
    } catch {
      failures.push(key);
    }
  }
  return failures;
}
