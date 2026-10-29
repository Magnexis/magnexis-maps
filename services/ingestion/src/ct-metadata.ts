/**
 * Prints Connecticut regional extract metadata for OSM-compatible mirrors.
 * Does NOT download PBF files. Large imports remain opt-in.
 */

const CT_EXTRACT = {
  region: "Connecticut, USA",
  bbox: {
    west: -73.7278,
    south: 40.9509,
    east: -71.7872,
    north: 42.0506,
  },
  suggestedSources: [
    {
      provider: "Geofabrik",
      pathHint: "north-america/us/connecticut-latest.osm.pbf",
      license: "ODbL 1.0 (OpenStreetMap)",
      note: "Download only when explicitly authorized for local import.",
    },
    {
      provider: "Overture Maps",
      pathHint: "theme releases filtered to CT bbox",
      license: "Mixed — preserve upstream attribution",
      note: "Use release manifests; do not scrape restricted UIs.",
    },
  ],
  localSeedAlternative:
    "pnpm db:seed — loads explicitly labeled Connecticut development places without downloading extracts.",
};

console.log(JSON.stringify(CT_EXTRACT, null, 2));
console.log(
  "\nNo files downloaded. To import a regional extract later, place the authorized PBF under infrastructure/data/downloads/ and run a dedicated import job.",
);
