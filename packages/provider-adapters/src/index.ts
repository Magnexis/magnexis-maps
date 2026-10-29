export type { GeocodingProvider, GeocodeHit } from "./geocoding/types.js";
export { createGeocodingProvider } from "./geocoding/factory.js";
export { MapTilerGeocodingProvider } from "./geocoding/maptiler.js";
export { TomTomGeocodingProvider } from "./geocoding/tomtom.js";
export { GoogleGeocodingProvider } from "./geocoding/google.js";
export type { RoutingProvider } from "./routing/types.js";
export { createRoutingProvider } from "./routing/factory.js";
export { OsrmRoutingProvider } from "./routing/osrm.js";
export { TomTomRoutingProvider } from "./routing/tomtom.js";
export { readTomTomApiKey, tomtomKeyConfigured } from "./tomtom-key.js";
export {
  findNearbyTomTomPlace,
  fetchTomTomPoiDetails,
  fetchTomTomPoiPhotoMedia,
  tomtomCategorySearch,
  tomtomSearchAlongRoute,
  tomtomReverseWithSpeedLimit,
} from "./tomtom/places.js";
export type {
  TomTomPlacePhotoHit,
  TomTomPlaceDetails,
} from "./tomtom/places.js";
export {
  readGoogleMapsApiKey,
  googleMapsKeyConfigured,
  googlePlacePhotoPriority,
} from "./google-key.js";
export {
  findNearbyGooglePlacePhoto,
  fetchGooglePlacePhotoMedia,
  googleStreetViewAvailable,
  fetchGoogleStreetViewImage,
} from "./google/places.js";
export type { GooglePlacePhotoHit } from "./google/places.js";
export type { MapStyleConfig } from "./map-tiles/types.js";
export {
  resolveMapStyles,
  maptilerStyleUrl,
  isLowDetailDemoStyle,
  OPENFREEMAP_LIBERTY,
  OPENFREEMAP_DARK,
  OPENFREEMAP_DARK_MINIMAL,
  MAPLIBRE_DEMO_STYLE,
} from "./map-tiles/styles.js";
