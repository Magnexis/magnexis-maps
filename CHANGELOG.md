# Changelog

## 1.4.0 — Chromatic (in progress)

### Sign-in providers
- Google OAuth (GIS ID token), GitHub OAuth, and GitLab OAuth (authorization code) alongside email/password; OAuth-only accounts delete with `DELETE` confirmation alone.

### Account lifecycle, shared routes and hosted release
- Implemented password-confirmed, transactional account deletion with optional current-device cleanup and real PostgreSQL integration coverage; fixed authentication hooks not reaching sibling API routes.
- Shared multi-stop routes retain ordered stop coordinates; unresolved stops now prevent route calculation instead of being silently omitted, and reversing endpoints reverses the stops.
- Added a persistent API adapter for Netlify Functions, public privacy/support surfaces, and a GitHub-hosted macOS simulator/signing/TestFlight workflow.

### iPhone shared-platform preparation
- Added a Capacitor iPhone target that packages the existing web interface locally, preserving its product screens and provider gates rather than rebuilding a separate mobile UI.
- Native foreground location, sharing, voice guidance, app links, external link handling, and connectivity status; added privacy information to shared Settings.
- Prepared the native iOS project, official icon/launch branding, permission descriptions, privacy manifest, build/export checks, App Store checklist, and Google Maps comparison baseline.
- Fixed share links using the navigation page/native origin, invalid coordinate deep links, stale GPS overview state, and route loss caused by hard-navigation fallback.
- Store submission still requires verified production services, final privacy disclosures, physical iPhone validation, and a signed, validated archive. Account deletion is implemented; GitHub Actions supplies the macOS build path.

### Navigation progress follow-up
- Normalize TomTom route offsets and OSRM/Valhalla step lengths when selecting the next maneuver.
- Measure distance to turns along route geometry, scaled to the provider route total, instead of straight-line distance.
- Regression coverage for provider differences, curved routes, missing geometry, absent maneuvers, and arrival.

### Navigation and sharing reliability
- Declare the web config's direct `@next/env` dependency at the installed Next.js version, fixing web typechecking under pnpm's isolated dependency resolution.
- VoiceNav advances to the next maneuver when GPS reaches a turn even if its near cue was already spoken.
- Place, pin, and route sharing only report a copied link after a successful clipboard write. Cancelling native sharing leaves the clipboard untouched and clears the status; dropped-pin sharing now handles errors visibly.
- Optional speed-limit enrichment treats network failures, malformed responses, and invalid limits as unknown rather than producing unhandled GPS callback rejections.

### Font / blank-map fix
- OpenFreeMap glyph stacks restricted to **Noto Sans** (composite Open Sans stacks 404’d and held MapLibre tiles blank)
- Public README + `docs/demo/` product stills/video for open release

### Google Maps parity pass
- Google Maps Platform enrichment: server-only `GOOGLE_MAPS_API_KEY` (`pnpm secrets:google`), Places photos + Street View Static via API proxy (MapLibre stays basemap)
- Map-first launch (sheet closed until search / dock)
- Terrain (`outdoor-v4`) + Satellite (`satellite-v4`) via MapTiler; quick cycle control on map
- Terrain/satellite camera tilt; share deep links (`?q=&lng=&lat=`)
- Persistent recent searches; clear from Settings
- Directions: units-aware distance (mi/km), auto GPS origin
- `openPanel` ensures sheet actually opens when jumping from place cards / saved / share
- Compact map credits (MapLibre attrib box removed)
- City-zoom POI density (earlier minzooms, richer basemap classes, pan refresh)
- Valhalla local profile (`pnpm docker:routing` + CT tiles); traffic / Street View stay gated off
- Map-type cycle control restored; search clear (X); Arrive-by clock on routes
- Collapse-to-peek place card; click map POIs to select; Escape clears selection
- Mapillary street view (coverage overlay + MapillaryJS viewer; token-gated)
- TomTom: server-only `TOMTOM_API_KEY`, `pnpm secrets:tomtom`, routing/search adapters, traffic tile proxy
- Explore: expanded category tags (restaurants, fuel, EV, hospitals, …) via `EXPLORE_CATEGORIES`
- Search → Directions: Go on results / Enter in search bar opens TomTom routing via `startDirectionsTo`

### Step 1 — Road hierarchy colors
- Magnexis Chromatic tokens (Standard / Night / Navigation / High Contrast)
- **Standard (light):** cool pastel land `#EDEEF0`, muted **slate** highways `#7A8FA8` (Google-like) — not gold
- **Night / navigation:** interstates stay Magnexis **gold** `#F6C45A` for dark-map readability
- Active navigation route stays bright Magnexis blue (`#1A73E8` / `#4D91FF`) above the road hierarchy
- Logo chrome: removed glass Panel bubble around Magnexis mark

### Steps 2–4 — Engine, RouteShield, GeoSymbols
- Centralized Chromatic paint engine (`applyChromaticPaints`) for Standard and Night
- Magnexis RouteShield: parse real `ref` / `network` (no invented route numbers)
- Magnexis GeoSymbols: category colors, zoom/density filtering, Map Appearance panel

## 1.3.0 — Atlas (in progress)

### Phase A — Missing roads (fixed)
- Root cause: API/`provider-adapters` dist still served MapLibre demotiles; client swapped OpenFreeMap → demotiles on load
- Secondary: OpenFreeMap dark painted roads `#000`/`#181818` on near-black (tiles present, invisible)
- Repair: OpenFreeMap liberty/dark defaults, demotiles hard-reject, Magnexis **RoadAtlas** contrast paints, zoom controls drive MapLibre directly
- Verified: New Haven street grid + names at z15 (York, Elm, Broadway, Church, …)

### Next (B–G)
- Full RoadAtlas casings/ramps/bridges, shields, traffic-control PostGIS overlay, routing alignment, cross-platform, release polish

## 1.2.0 — Horizon (in progress)

### Implemented
- Magnexis Horizon UI design tokens and polished glass chrome for web
- Official Magnexis logo across web, admin, mobile, and branding assets
- Immersive full-window map shell with floating search (⌘K), collapsible panel, mobile dock
- Settings panel with persistent local preferences schema (`UserSettings`)
- Magnexis VoiceNav package (`@magnexis/navigation`) — browser TTS + instruction scheduler
- Navigation overlay (start / mute / repeat / end) on web when a real route exists
- GitLab CI (`.gitlab-ci.yml`) and Netlify config (`netlify.toml`)
- Expo Go mobile path with branded tabs (Explore / Go / Saved / You)

### Partial / blocked
- Valhalla routing still requires `VALHALLA_URL`
- Satellite / hybrid styles only when licensed style URLs configured
- Native MapLibre React Native requires Expo development builds (not Expo Go)
- Settings sync to backend and OAuth providers planned
- Full iOS/Android MapLibre navigation shells planned

### Preserved
- PostGIS places, search, community reports, moderation, admin overview
