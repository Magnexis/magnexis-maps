# Data Sources

Magnexis Maps must not scrape Apple Maps, Google Maps, or other restricted geographic UIs.

| Provider | Dataset | License | Attribution | Refresh | Permitted uses | Operational restrictions | Production-ready |
|----------|---------|---------|-------------|---------|----------------|--------------------------|------------------|
| OpenStreetMap | Vector features / POIs | ODbL 1.0 | © OpenStreetMap contributors | Periodic regional extracts | Share-alike DB use with attribution | Do not use public OSM tile servers as unlimited production infra; do not abuse Nominatim | No (configure self-hosted / licensed tiles + extracts) |
| Overture Maps | Places / buildings / transport themes | Mixed (CDLA-Permissive + ODbL upstream) | Overture + upstream | Release-based | Per-theme compliance | Preserve provenance & share-alike obligations | No until licensed pipeline configured |
| OpenFreeMap | OSM vector basemap (roads, labels) | Free / OSM ODbL upstream | © OpenStreetMap · © OpenFreeMap | Public CDN | Default local/dev basemap (`NEXT_PUBLIC_MAP_STYLE_URL`) | Fair-use CDN; prefer self-hosted or licensed tiles for heavy production | Dev-ready; production TBD |
| MapLibre Demo Tiles | Demo basemap style | Demo | MapLibre demotiles | n/a | Last-resort fallback only | Low detail (no roads/labels); not for UI review | No |
| Valhalla (optional) | Routing graph | Engine-dependent; data usually OSM ODbL | Provider + OSM | Operator-managed | Navigation when self-hosted | Requires tileset build; no fake routes when down | No until `VALHALLA_URL` set |
| Licensed vector tiles (optional) | Production basemap | Per contract | Per provider | Per contract | Production rendering | Keep API keys server-side / public tokens restricted | When configured |
| Licensed imagery (optional) | Satellite / terrain | Per contract | Per provider | Per contract | Style layers only when licensed | Enable via `MAP_STYLE_SATELLITE` / `MAP_STYLE_TERRAIN`, or `MAPTILER_KEY` (auto MapTiler outdoor + satellite) | When configured |
| MapTiler (optional) | Outdoor v4 / Satellite Plain v4 MapLibre styles | MapTiler ToS + OSM where applicable | © MapTiler © OSM | Cloud | Dev/prod when keyed | Free plan = 1 shared key (web/mobile/desktop); upgrade for per-app keys | When `MAPTILER_KEY` set |
| Mapillary (optional) | Street-level imagery + coverage tiles | CC BY-SA (community) + Mapillary ToS | © Mapillary contributors | Cloud | Street view overlay / viewer when keyed | Client token via `NEXT_PUBLIC_MAPILLARY_ACCESS_TOKEN`; register at mapillary.com/dashboard/developers | When token set |
| Google Maps Platform (optional) | Places photos, Street View Static, optional Geocoding | Google Maps Platform ToS / commercial | © Google | Cloud | Enrichment only — MapLibre remains the basemap | Server-only `GOOGLE_MAPS_API_KEY` via `pnpm secrets:google`; Places/Street View via API proxy; enable Places API (New) + Street View Static (+ Geocoding if used); restrict key by IP | When `GOOGLE_MAPS_API_KEY` set |
| TomTom (optional) | Routing, search, reverse geocode, traffic flow tiles | TomTom ToS / commercial | © TomTom | Cloud | Prefer `TOMTOM_API_KEY` server-only; traffic via API proxy | Run `pnpm secrets:tomtom`; `next.config` / `apps/web/.env.local` set `NEXT_PUBLIC_TOMTOM_TRAFFIC_PROXY=1` (never the key) | When `TOMTOM_API_KEY` set |

## Development seed

`pnpm db:seed` inserts explicitly labeled Connecticut development places (`source_name = magnexis-dev-seed`).  
`last_verified_at` is left `NULL` by design — import time is not verification time.

## User-visible attribution

The web map attribution control and `NEXT_PUBLIC_MAP_ATTRIBUTION` must remain visible.
