/**
 * Magnexis GeoSync ingestion worker entrypoint.
 * Large planet downloads are opt-in and never part of ordinary `pnpm dev`.
 */
console.log(
  "[ingestion] Magnexis GeoSync worker scaffold ready. Run `pnpm --filter @magnexis/ingestion ingest:ct-meta` for Connecticut extract metadata (no bulk download).",
);
