/** Magnexis Maps brand & product constants */

export const PRODUCT_NAME = "Magnexis Maps";
export const ORGANIZATION = "Magnexis LLC";
export const PRODUCT_VERSION = "1.4.0";

export const BRAND_COLORS = {
  deepNavy: "#08111F",
  primaryBlue: "#247BFF",
  cyan: "#37D9FF",
  slate: "#111C2D",
  lightBackground: "#F5F8FC",
  white: "#FFFFFF",
} as const;

/** Connecticut — initial high-detail development region */
export const CT_BBOX = {
  west: -73.7278,
  south: 40.9509,
  east: -71.7872,
  north: 42.0506,
} as const;

export const CT_CENTER = {
  lng: -72.6851,
  lat: 41.599998,
} as const;

export const USER_ROLES = [
  "guest",
  "user",
  "verified_business_owner",
  "moderator",
  "administrator",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const REPORT_STATUSES = [
  "submitted",
  "under_review",
  "more_info_needed",
  "approved",
  "rejected",
  "applied",
  "reverted",
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const ISSUE_CATEGORIES = [
  "incorrect_address",
  "incorrect_business_name",
  "incorrect_business_hours",
  "permanently_closed",
  "missing_business",
  "incorrect_road_name",
  "road_closure",
  "missing_road",
  "incorrect_one_way",
  "missing_building",
  "incorrect_marker",
  "missing_landmark",
  "incorrect_boundary",
  "accessibility",
  "other",
] as const;

export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export const TRAVEL_MODES = ["driving", "walking", "cycling"] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];

/**
 * Canonical place categories for the Magnexis index + Explore filters.
 * Aligns with common TomTom / OSM POI types used in a mapping & navigation app.
 */
export const PLACE_CATEGORIES = [
  "country",
  "state",
  "county",
  "city",
  "neighborhood",
  "road",
  "intersection",
  "address",
  "building",
  "business",
  "park",
  "landmark",
  "transit",
  "parking",
  "public_facility",
  "water",
  "poi",
  // Explore / lifestyle POIs
  "restaurant",
  "cafe",
  "hotel",
  "fuel",
  "ev_charging",
  "hospital",
  "pharmacy",
  "school",
  "shopping",
  "grocery",
  "museum",
  "library",
  "airport",
  "attraction",
  "sports",
  "entertainment",
] as const;

export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

/**
 * Explore panel chips — subset of PLACE_CATEGORIES with user-facing labels.
 * Keep in sync with seed categories so nearby filters return results locally.
 */
export const EXPLORE_CATEGORIES = [
  { label: "Parks", category: "park" },
  { label: "Transit", category: "transit" },
  { label: "Landmarks", category: "landmark" },
  { label: "Businesses", category: "business" },
  { label: "Public facilities", category: "public_facility" },
  { label: "Restaurants", category: "restaurant" },
  { label: "Coffee", category: "cafe" },
  { label: "Hotels", category: "hotel" },
  { label: "Gas", category: "fuel" },
  { label: "EV charging", category: "ev_charging" },
  { label: "Parking", category: "parking" },
  { label: "Hospitals", category: "hospital" },
  { label: "Pharmacies", category: "pharmacy" },
  { label: "Schools", category: "school" },
  { label: "Shopping", category: "shopping" },
  { label: "Grocery", category: "grocery" },
  { label: "Museums", category: "museum" },
  { label: "Libraries", category: "library" },
  { label: "Airports", category: "airport" },
  { label: "Attractions", category: "attraction" },
  { label: "Sports", category: "sports" },
  { label: "Entertainment", category: "entertainment" },
] as const satisfies ReadonlyArray<{
  label: string;
  category: PlaceCategory;
}>;
