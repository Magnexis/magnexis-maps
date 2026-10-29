# Roadmap & feature status (1.2.0 Horizon)

| Area | Status | Notes |
|------|--------|-------|
| Horizon UI + official logo | Implemented | Glass chrome, tokens, compass-M mark |
| VoiceNav (web) | Implemented | TTS + scheduler; needs real route |
| User settings (local) | Implemented | Remote sync planned |
| Monorepo / Turborepo / pnpm | Implemented | |
| Docker Compose PostGIS + Redis | Implemented | |
| DB schema + migrations | Implemented | `infrastructure/migrations/001_init.sql` |
| Fastify API + OpenAPI | Implemented | `/docs` |
| Auth (email/password, roles) | Implemented | Email verification UI still planned |
| Web MapLibre map | Implemented | Demo tiles by default |
| Official logo branding | Implemented | PNG across web/admin/mobile/desktop assets |
| Light/dark themes | Implemented | |
| Layer availability states | Implemented | Satellite/terrain gated |
| CT seed places + search | Implemented | Labeled development seed |
| Nearby / place detail | Implemented | |
| Community reports + moderation | Implemented | Apply/revert versioned |
| Heuristic report checks | Implemented | `autoPublish: false` always |
| Routing adapter (Valhalla) | Implemented | `pnpm docker:routing` + `VALHALLA_URL` (CT tiles) |
| Geocoding adapter | Implemented | Blocked until licensed/self-hosted URL; Nominatim blocked |
| Admin dashboard | Partially implemented | Overview + queue |
| GeoSync scheduled ingestion | Partially implemented | Metadata CLI; no auto planet download |
| Business portal | Planned | Schema present |
| Magnexis Live traffic | Planned | Incidents overlay only — no fake speeds |
| Street view (Mapillary + Google fallback) | Implemented | Mapillary token and/or `GOOGLE_MAPS_API_KEY` (Street View Static proxy) |
| Google Places photos | Implemented | `GOOGLE_MAPS_API_KEY` + Places API (New); server proxy |
| Indoor maps | Planned | No provider integrated |
| GeoIntelligence ML | Planned | Deterministic duplicate scoring only |
| Desktop Tauri | Partially implemented | Scaffold; needs Rust toolchain |
| Mobile Expo Go | Implemented | API + GPS + branding; no native MapLibre in Expo Go |
| Mobile MapLibre native | Planned | Requires Expo development build |
| iPhone shared-web app (Capacitor) | Implemented, device validation pending | Same `apps/web` UI; native location/share/speech/network adapters; Xcode project prepared |
| iPhone App Store distribution | Release preparation | Account deletion implemented; GitHub macOS workflow added. Hosted verification, device testing, signing and review remain; see `docs/iphone-app-store.md` |
| Netlify web deploy config | Implemented | `netlify.toml`; site link + API URL required |
| GitLab CI | Implemented | `.gitlab-ci.yml` install/test/build |
| Offline packs | Planned | Lawful tile packages only |
| Playwright / E2E | Planned | |

## Phase checklist

1. Platform foundation — **done for local path**
2. Interactive map — **done**
3. Geographic data & search — **done (seed); full OSM/Overture import opt-in**
4. Community corrections — **done (core workflow)**
5. Routing — **adapter done; provider config required**
6. GeoSync — **scaffold**
7. Business portal — **schema / planned**
8. Desktop — **scaffold**
9. Mobile — **Expo Go scaffold done; MapLibre native pending**
10. Intelligence & refinement — **deterministic start**
11. Hosting — **Netlify + GitLab CI config present; live URL after site link**
