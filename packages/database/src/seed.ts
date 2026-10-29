/**
 * Development seed — explicitly marked as development data.
 * Uses real Connecticut place names and approximate public coordinates.
 * These are NOT claimed as independently surveyed Magnexis verifications.
 */
import { createPool } from "./pool.js";

type SeedPlace = {
  name: string;
  category: string;
  address?: string;
  city: string;
  state: string;
  postalCode?: string;
  lng: number;
  lat: number;
  description?: string;
  properties?: Record<string, unknown>;
};

const CT_SEED_PLACES: SeedPlace[] = [
  {
    name: "Yale University",
    category: "school",
    address: "New Haven, CT",
    city: "New Haven",
    state: "CT",
    lng: -72.9223,
    lat: 41.3163,
    description: "Private research university in New Haven.",
    properties: {
      seedNote: "development_only",
      phone: "+1 203-432-4771",
      website: "https://www.yale.edu",
      opening_hours: "Campus open; visitor centers vary by building",
    },
  },
  {
    name: "New Haven Green",
    category: "park",
    address: "New Haven Green",
    city: "New Haven",
    state: "CT",
    postalCode: "06510",
    lng: -72.927,
    lat: 41.308,
    description: "Historic town green in downtown New Haven.",
    properties: {
      seedNote: "development_only",
      opening_hours: "Open 24 hours",
      website: "https://www.newhavenct.gov",
    },
  },
  {
    name: "Connecticut State Capitol",
    category: "public_facility",
    address: "210 Capitol Ave",
    city: "Hartford",
    state: "CT",
    postalCode: "06106",
    lng: -72.6823,
    lat: 41.7642,
    description: "Seat of Connecticut state government.",
    properties: {
      seedNote: "development_only",
      phone: "+1 860-240-0222",
      website: "https://www.cga.ct.gov",
      opening_hours: "Mo-Fr 09:00-15:00",
    },
  },
  {
    name: "Bradley International Airport",
    category: "airport",
    address: "Schoephoester Rd",
    city: "Windsor Locks",
    state: "CT",
    postalCode: "06096",
    lng: -72.6832,
    lat: 41.9389,
    description: "Primary commercial airport for Connecticut.",
    properties: {
      seedNote: "development_only",
      phone: "+1 860-292-2000",
      website: "https://bradleyairport.com",
      opening_hours: "Open 24 hours",
    },
  },
  {
    name: "Mystic Seaport Museum",
    category: "museum",
    address: "75 Greenmanville Ave",
    city: "Mystic",
    state: "CT",
    postalCode: "06355",
    lng: -71.9631,
    lat: 41.3615,
    description: "Maritime museum on the Mystic River.",
    properties: {
      seedNote: "development_only",
      phone: "+1 860-572-0711",
      website: "https://mysticseaport.org",
      opening_hours: "Mo-Su 10:00-17:00",
    },
  },
  {
    name: "East Rock Park",
    category: "park",
    city: "New Haven",
    state: "CT",
    lng: -72.908,
    lat: 41.333,
    description: "Large urban park with overlook of New Haven.",
  },
  {
    name: "Hartford Hospital",
    category: "hospital",
    address: "80 Seymour St",
    city: "Hartford",
    state: "CT",
    postalCode: "06102",
    lng: -72.672,
    lat: 41.754,
    description: "Major hospital in Hartford.",
  },
  {
    name: "Mohegan Sun",
    category: "entertainment",
    address: "1 Mohegan Sun Blvd",
    city: "Uncasville",
    state: "CT",
    postalCode: "06382",
    lng: -72.091,
    lat: 41.491,
    description: "Entertainment and hotel complex.",
  },
  {
    name: "Quinnipiac University",
    category: "school",
    city: "Hamden",
    state: "CT",
    lng: -72.901,
    lat: 41.42,
    description: "Private university in Hamden.",
  },
  {
    name: "Stamford Transportation Center",
    category: "transit",
    address: "30 Station Pl",
    city: "Stamford",
    state: "CT",
    postalCode: "06902",
    lng: -73.541,
    lat: 41.047,
    description: "Major Metro-North / Amtrak station.",
  },
  {
    name: "Coffee near New Haven Green (dev sample)",
    category: "cafe",
    address: "Near New Haven Green",
    city: "New Haven",
    state: "CT",
    lng: -72.9285,
    lat: 41.3075,
    description:
      "Development seed cafe placeholder near downtown New Haven — not a verified live listing.",
    properties: { seedNote: "development_only", tags: ["coffee", "cafe"] },
  },
  {
    name: "Gas station sample — East Haven (dev)",
    category: "fuel",
    city: "East Haven",
    state: "CT",
    lng: -72.868,
    lat: 41.276,
    description:
      "Development seed POI for nearby fuel search — labeled as seed data.",
    properties: { seedNote: "development_only", tags: ["fuel", "gas"] },
  },
  {
    name: "EV charger sample — New Haven (dev)",
    category: "ev_charging",
    city: "New Haven",
    state: "CT",
    lng: -72.921,
    lat: 41.31,
    description: "Development seed EV charging site.",
    properties: { seedNote: "development_only", tags: ["ev", "charging"] },
  },
  {
    name: "Parking garage sample — Hartford (dev)",
    category: "parking",
    city: "Hartford",
    state: "CT",
    lng: -72.674,
    lat: 41.765,
    description: "Development seed parking facility.",
    properties: { seedNote: "development_only" },
  },
  {
    name: "Pharmacy sample — West Hartford (dev)",
    category: "pharmacy",
    city: "West Hartford",
    state: "CT",
    lng: -72.742,
    lat: 41.762,
    description: "Development seed pharmacy.",
    properties: { seedNote: "development_only" },
  },
  {
    name: "Grocery sample — Hamden (dev)",
    category: "grocery",
    city: "Hamden",
    state: "CT",
    lng: -72.92,
    lat: 41.385,
    description: "Development seed grocery store.",
    properties: { seedNote: "development_only" },
  },
  {
    name: "Shopping sample — Trumbull (dev)",
    category: "shopping",
    city: "Trumbull",
    state: "CT",
    lng: -73.14,
    lat: 41.24,
    description: "Development seed shopping center.",
    properties: { seedNote: "development_only" },
  },
  {
    name: "Restaurant sample — New Haven (dev)",
    category: "restaurant",
    city: "New Haven",
    state: "CT",
    lng: -72.926,
    lat: 41.306,
    description: "Development seed restaurant near downtown.",
    properties: {
      seedNote: "development_only",
      phone: "+1 203-555-0142",
      website: "https://example.com/nh-restaurant",
      opening_hours: "Tu-Su 11:00-22:00",
    },
  },
  {
    name: "Hotel sample — Stamford (dev)",
    category: "hotel",
    city: "Stamford",
    state: "CT",
    lng: -73.538,
    lat: 41.053,
    description: "Development seed lodging.",
    properties: { seedNote: "development_only" },
  },
  {
    name: "Hartford Public Library",
    category: "library",
    address: "500 Main St",
    city: "Hartford",
    state: "CT",
    postalCode: "06103",
    lng: -72.6735,
    lat: 41.7632,
    description: "Main public library in Hartford.",
  },
  {
    name: "XL Center",
    category: "sports",
    address: "1 Civic Center Plaza",
    city: "Hartford",
    state: "CT",
    postalCode: "06103",
    lng: -72.6766,
    lat: 41.7684,
    description: "Arena for sports and events in Hartford.",
  },
  {
    name: "Dinosaur State Park",
    category: "attraction",
    city: "Rocky Hill",
    state: "CT",
    lng: -72.672,
    lat: 41.651,
    description: "State park with dinosaur track exhibits.",
  },
  {
    name: "Mark Twain House",
    category: "landmark",
    address: "351 Farmington Ave",
    city: "Hartford",
    state: "CT",
    postalCode: "06105",
    lng: -72.701,
    lat: 41.767,
    description: "Historic home of Mark Twain.",
  },
  {
    name: "Local shop sample — New Haven (dev)",
    category: "business",
    city: "New Haven",
    state: "CT",
    lng: -72.93,
    lat: 41.309,
    description: "Development seed general business.",
    properties: { seedNote: "development_only" },
  },
  {
    name: "123 Main Street (dev geocode fixture)",
    category: "address",
    address: "123 Main Street",
    city: "Hartford",
    state: "CT",
    postalCode: "06103",
    lng: -72.685,
    lat: 41.763,
    description:
      "Synthetic address fixture for development search tests. Not a surveyed parcel record.",
    properties: { seedNote: "development_only" },
  },
  {
    name: "City of New Haven",
    category: "city",
    city: "New Haven",
    state: "CT",
    lng: -72.9279,
    lat: 41.3083,
    description: "Municipal center reference point for New Haven.",
  },
  {
    name: "City of Hartford",
    category: "city",
    city: "Hartford",
    state: "CT",
    lng: -72.6851,
    lat: 41.7637,
    description: "Municipal center reference point for Hartford.",
  },
];

async function seed() {
  const pool = createPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const source = await client.query<{ id: string }>(
      `SELECT id FROM data_sources WHERE name = 'OpenStreetMap' LIMIT 1`,
    );
    const dataSourceId = source.rows[0]?.id ?? null;

    // Remove previous development seed places for idempotent re-runs
    await client.query(
      `DELETE FROM places WHERE properties->>'seedNote' = 'development_only'
       OR (source_name = 'magnexis-dev-seed' AND source_id LIKE 'ct-seed-%')`,
    );

    let inserted = 0;
    for (let i = 0; i < CT_SEED_PLACES.length; i++) {
      const p = CT_SEED_PLACES[i]!;
      const isDevOnly =
        p.properties?.seedNote === "development_only" ||
        p.name.includes("(dev");

      await client.query(
        `INSERT INTO places (
          name, category, description, address, city, state, postal_code, country,
          geom, source_name, source_id, source_dataset_version, data_source_id,
          imported_at, last_verified_at, confidence, status, properties
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, 'US',
          ST_SetSRID(ST_MakePoint($8, $9), 4326),
          'magnexis-dev-seed', $10, '0.1.0-dev', $11,
          NOW(), NULL, NULL, 'active', $12::jsonb
        )`,
        [
          p.name,
          p.category,
          p.description ?? null,
          p.address ?? null,
          p.city,
          p.state,
          p.postalCode ?? null,
          p.lng,
          p.lat,
          `ct-seed-${i + 1}`,
          dataSourceId,
          JSON.stringify({
            ...(p.properties ?? {}),
            ...(isDevOnly ? { seedNote: "development_only" } : {}),
            region: "Connecticut",
            seed: true,
          }),
        ],
      );
      inserted += 1;
    }

    await client.query("COMMIT");
    console.log(
      `Seeded ${inserted} Connecticut development places (magnexis-dev-seed).`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
