# Architecture

## Monorepo layout

- `apps/web` — Next.js MapLibre client
- `apps/admin` — moderation / ops dashboard
- `apps/desktop` — Tauri 2 shell
- `apps/mobile` — Expo / React Native scaffold
- `services/api` — Fastify REST API
- `services/ingestion` — GeoSync ingestion worker scaffold
- `services/routing`, `geocoding`, `moderation`, `intelligence` — service boundaries
- `packages/*` — shared schemas, DB, adapters, UI, map tokens, API client

## Runtime (local)

```
Browser / Tauri / Mobile
        │
        ▼
   Fastify API (:4000)
        │
   ┌────┼────┐
   ▼    ▼    ▼
PostGIS Redis Providers (tiles / Valhalla / geocoder)
```

## Boundaries

1. **Geographic data** lives in PostGIS with provenance columns.
2. **Provider adapters** isolate Valhalla, geocoders, and tile style URLs.
3. **UI** never invents route geometry or live traffic.
4. **Community corrections** write to `correction_reports` and require moderation before place mutation.
5. **Intelligence** produces reviewable proposals (`autoApply: false`).

## CRS

Storage and API coordinates use EPSG:4326 (WGS84). Distance uses geography (`ST_DWithin` / `ST_Distance` on `::geography`).
