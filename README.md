# Magnexis Maps

**Beautiful maps. Intelligent navigation. Reliable geographic information.**

Magnexis Maps is a cross-platform geographic intelligence product from **Magnexis LLC**. It combines interactive vector mapping, place search, multi-stop directions, turn-by-turn voice guidance, optional live layers, and moderated community corrections—delivered through a shared Horizon interface on the web, Windows desktop, and iPhone.

The platform is built so that **maps and routes reflect real geographic data and licensed providers**. When a routing, geocoding, or enrichment service is unavailable, Magnexis Maps reports that clearly instead of fabricating geometry, traffic, or places.

<br />

<p align="center">
  <img src="./docs/demo/frames/e2e-standard.png" alt="Magnexis Maps — Standard map overview" width="860" />
</p>

<p align="center">
  <a href="https://magnexis-maps.netlify.app/"><strong>Live product</strong></a>
  ·
  <a href="https://magnexis-maps.netlify.app/privacy/">Privacy</a>
  ·
  <a href="https://magnexis-maps.netlify.app/support/">Support</a>
  ·
  <a href="https://magnexis-maps.netlify.app/api/v1/health">API status</a>
  ·
  <a href="https://github.com/Magnexis/magnexis-maps/releases">Releases</a>
</p>

<p align="center">
  <strong>Version</strong> 1.4.0 · Chromatic map system<br />
  Official mark: <a href="./assets/branding/magnexis-maps-logo.png">assets/branding/magnexis-maps-logo.png</a>
</p>

---

## Table of contents

1. [Why Magnexis Maps](#why-magnexis-maps)
2. [Product overview](#product-overview)
3. [Platforms](#platforms)
4. [Screenshots & demo](#screenshots--demo)
5. [For developers](#for-developers)
6. [HTTP API](#http-api)
7. [Typed client packages](#typed-client-packages)
8. [Architecture](#architecture)
9. [Map styles & Chromatic](#map-styles--chromatic)
10. [Data providers & attribution](#data-providers--attribution)
11. [Security & privacy](#security--privacy)
12. [Contributing](#contributing)
13. [Roadmap & changelog](#roadmap--changelog)
14. [Support](#support)
15. [License](#license)

---

## Why Magnexis Maps

Most mapping experiences hide a hard truth: search, routing, and imagery depend on providers, licenses, and operational health. Magnexis Maps is designed around that reality.

| Principle | What it means in practice |
| --- | --- |
| **Honest geography** | Routes, places, and traffic come from configured providers or stored geographic data—not invented client-side geometry. |
| **One product, many shells** | Web, desktop, and iPhone share the same Horizon interface and API contracts. |
| **Provider isolation** | Basemap tiles, routing, geocoding, and enrichment are adapted behind a stable API so clients stay simple. |
| **Account control** | Users can register, sign in (email/password and optional OAuth), save places, and delete their accounts. |
| **Community with moderation** | Map corrections are submitted as reports and reviewed before place data changes. |
| **Open development** | Source, documentation, releases, and typed packages are published for transparency and integration. |

### Compared with Google Maps

Magnexis covers the familiar map → search → place → directions → navigate loop with a polished Horizon surface, then differentiates on trust, ownership, and openness: no fabricated geography, moderated community edits, transactional account deletion, a public API client, and the same UI on web, desktop, and iPhone.

Full side-by-side: [docs/google-maps-parity.md](./docs/google-maps-parity.md).

---

## Product overview

### Mapping

- Interactive **MapLibre** vector basemap powered by OpenFreeMap (OpenStreetMap-derived tiles)
- Magnexis **Chromatic** appearance: **Standard** (light) and **Night** (dark), with road hierarchy and route shields from real OSM `ref` / network data
- Optional **terrain** and **satellite** styles when MapTiler is configured
- Explore categories for parks, transit, restaurants, fuel, EV charging, hospitals, and more

### Search & places

- Place search against a PostGIS index, with optional provider-backed geocoding
- Nearby search, place detail, and saved places for signed-in users
- Optional Google Places photos and Street View Static imagery via a server-side proxy (keys never exposed to the browser)

### Directions & navigation

- Multi-stop directions when a routing provider is configured (for example TomTom or self-hosted Valhalla)
- Units-aware distances, route alternatives when the provider supplies them
- **Magnexis VoiceNav** — spoken turn guidance when a real route and maneuvers exist
- Shareable place and route links for the web and native shells

### Community intelligence

- Issue and correction reports from guests (rate-limited) and authenticated users
- Moderator workflows to review, apply, and revert changes with versioned place updates
- Admin overview of live system state

### Accounts

- Email and password registration / sign-in
- Optional **Sign in with Google**, **GitHub**, and **GitLab** when configured
- Saved places and account deletion with explicit confirmation

---

## Platforms

### Web

The primary product experience runs in the browser.

- **Production:** [https://magnexis-maps.netlify.app/](https://magnexis-maps.netlify.app/)
- Responsive Horizon UI for phone, tablet, and desktop viewports
- Privacy and support pages ship with the same site

### Windows desktop

Magnexis Maps Desktop packages the Horizon interface in a **Tauri 2** shell and talks to the production HTTPS API.

| Item | Link |
| --- | --- |
| Latest release | [Desktop 1.0.0](https://github.com/Magnexis/magnexis-maps/releases/tag/desktop-v1.0.0) |
| Installers | NSIS (`.exe`) and MSI attached to the release |
| Notes | Unsigned installers; Windows SmartScreen may prompt on first launch |

### iPhone

The iPhone app packages the **same** web product with Capacitor, adding native foreground location, sharing, speech, connectivity, and app links. Distribution targets App Store Connect / TestFlight through the project’s documented release path.

### Other clients

- **Admin** — moderation dashboard for operators
- **Expo** — experimental mobile scaffold for API-oriented prototyping

---

## Screenshots & demo

| Standard | Night |
| --- | --- |
| ![Standard map](./docs/demo/frames/e2e-standard.png) | ![Night map](./docs/demo/frames/e2e-cold-reload-night.png) |

- **Product demo video:** [`docs/demo/magnexis-maps-demo.mp4`](./docs/demo/magnexis-maps-demo.mp4)
- **Still frames:** [`docs/demo/frames/`](./docs/demo/frames/)

Try the live site first if you want to evaluate the product without installing a development environment.

---

## For developers

This repository is a **pnpm + Turborepo monorepo** containing the web app, API, shared packages, desktop and iPhone shells, and infrastructure definitions.

### Repository layout

```
apps/web          Next.js + MapLibre product UI (Horizon)
apps/admin        Moderation dashboard
apps/iphone       Capacitor iPhone packaging of the shared UI
apps/desktop      Tauri Windows / desktop shell
apps/mobile       Experimental Expo client
services/api      Fastify REST API
packages/*        shared schemas, api-client, map-styles, navigation, database, …
infrastructure/   Docker Compose, SQL migrations
docs/             Architecture, API, deployment, and product documentation
assets/branding/  Official logo and icons
```

### Prerequisites

- **Node.js** 20 or newer
- **pnpm** 9+ (version pinned via `packageManager` in the root `package.json`)
- **Docker Desktop** for PostgreSQL/PostGIS and Redis
- Optional: Rust toolchain (desktop), Xcode (iPhone), provider API keys

### Quick start (local)

```bash
pnpm install
cp .env.example .env
pnpm docker:up
pnpm --filter @magnexis/shared --filter @magnexis/database --filter @magnexis/provider-adapters --filter @magnexis/api-client build
pnpm db:migrate
pnpm db:seed

# Terminal A — API
pnpm --filter @magnexis/api dev

# Terminal B — web
pnpm --filter @magnexis/web dev
```

| Service | Default URL |
| --- | --- |
| Web | http://localhost:3000 |
| API | http://localhost:4000 |
| OpenAPI | http://localhost:4000/docs |
| Admin | http://localhost:3001 (`pnpm --filter @magnexis/admin dev`) |

Postgres is published on host port **5433** by default to avoid conflicts with a local PostgreSQL on 5432.

Configuration is documented in [`.env.example`](./.env.example). **Never commit real secrets or a populated `.env` file.**

Deeper guides:

- [Architecture](./docs/architecture/ARCHITECTURE.md)
- [Deployment](./docs/deployment/DEPLOYMENT.md)
- [Netlify hosting notes](./docs/netlify-deployment.md)
- [iPhone packaging](./apps/iphone/README.md)
- [Desktop shell](./apps/desktop/README.md)

### Tests

```bash
pnpm --filter @magnexis/shared test
pnpm --filter @magnexis/api test
pnpm --filter @magnexis/api-client test
pnpm --filter @magnexis/web test
pnpm --filter @magnexis/map-styles test
```

---

## HTTP API

The Magnexis Maps API is a versioned HTTPS JSON API (`/api/v1`) with OpenAPI documentation.

| Environment | Base origin | Health |
| --- | --- | --- |
| Production | `https://magnexis-maps.netlify.app` | [/api/v1/health](https://magnexis-maps.netlify.app/api/v1/health) |
| Local | `http://localhost:4000` | `/api/v1/health` · `/docs` |

### Capability areas

| Area | Examples |
| --- | --- |
| **System** | Health and dependency status |
| **Places & search** | List, nearby, detail, full-text search |
| **Geocoding** | Forward / reverse when a provider is configured |
| **Routing** | Multi-stop routes with provider alternatives |
| **Reports & incidents** | Community reports and public incident listings |
| **Auth & account** | Register, login, Google / GitHub / GitLab OAuth, profile, account deletion |
| **Saved places** | Authenticated favorites |
| **Map styles** | Style catalog and availability |
| **Admin** | Moderation queue and overview (authorized roles) |

Full reference: [docs/api/API.md](./docs/api/API.md)  
Account deletion contract: [docs/account-deletion.md](./docs/account-deletion.md)

When a required provider is not configured, endpoints respond with structured errors such as `503 PROVIDER_UNAVAILABLE` rather than synthetic results.

---

## Typed client packages

Integrators can consume the same contracts used by the Magnexis clients via **GitHub Packages**:

| Package | Purpose |
| --- | --- |
| [`@magnexis/shared`](https://github.com/Magnexis/magnexis-maps/pkgs/npm/shared) | Zod schemas and shared TypeScript types |
| [`@magnexis/api-client`](https://github.com/Magnexis/magnexis-maps/pkgs/npm/api-client) | Typed HTTP client for `/api/v1` |

```bash
# .npmrc
@magnexis:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN

npm install @magnexis/shared@1.1.0 @magnexis/api-client@1.1.0
```

Current published line includes search, routing, Google, GitHub, and GitLab sign-in helpers, saved places, and account deletion.

---

## Architecture

```
  Web · Desktop · iPhone
            │
            ▼
     Magnexis Maps API
            │
   ┌────────┼────────────────┐
   ▼        ▼                ▼
PostGIS   Redis        Provider adapters
(places)  (cache)      (tiles, routing,
                        geocoding, imagery)
```

1. **Clients** render maps and UX; they call a single API origin.
2. **PostGIS** stores places and moderated geographic state with provenance.
3. **Provider adapters** isolate third-party routing, geocoding, and enrichment.
4. **Chromatic** restyles the OpenFreeMap liberty basemap for Standard and Night without inventing road geometry.

See [docs/architecture/ARCHITECTURE.md](./docs/architecture/ARCHITECTURE.md) for component boundaries and deployment topology.

---

## Map styles & Chromatic

| Layer | Description |
| --- | --- |
| **Basemap** | OpenFreeMap [liberty](https://tiles.openfreemap.org/styles/liberty) (OpenMapTiles schema)—roads, labels, shields, POIs |
| **Fonts** | Noto Sans glyph stacks for reliable label rendering |
| **Chromatic Standard** | Cool pastel land and slate highway hierarchy |
| **Chromatic Night** | Dark land with high-visibility highway treatment |
| **Terrain / satellite** | MapTiler outdoor and satellite styles when keyed |

Implementation lives in `@magnexis/map-styles` (paint engine, RouteShield, GeoSymbols).

---

## Data providers & attribution

| Provider | Role |
| --- | --- |
| **OpenFreeMap / OpenStreetMap** | Default vector basemap and community geographic foundation |
| **TomTom** | Optional routing, search, and traffic tile proxy |
| **Valhalla / OSRM** | Optional self-hosted or demo routing |
| **MapTiler** | Optional terrain, satellite, and geocoding |
| **Mapillary** | Optional street-level imagery coverage |
| **Google Maps Platform** | Optional Places photos and Street View Static (server proxy) |
| **Google / GitHub / GitLab OAuth** | Optional account sign-in |

Production deployments must retain required attribution. License and source notes: [DATA_SOURCES.md](./DATA_SOURCES.md).

Commercial API keys belong on the **server**. Prefer server-side proxies over shipping provider secrets in public client bundles.

---

## Security & privacy

- Session authentication uses signed tokens; treat `JWT_SECRET` as a production secret.
- Account deletion is an authenticated, confirmed operation; see [account deletion](./docs/account-deletion.md).
- Privacy policy: [https://magnexis-maps.netlify.app/privacy/](https://magnexis-maps.netlify.app/privacy/)
- Report security issues privately to Magnexis LLC. Do not open public issues that include secrets, certificates, or personal data.
- Rotate any credential that appears in chat logs, screenshots, or version control history.

---

## Contributing

We welcome focused contributions that improve reliability, documentation, accessibility, and roadmap-aligned features.

1. Branch from `main` (or fork the repository).
2. Prefer conventional commits: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.
3. Do not commit secrets, certificates, `.env` files, or provider keys.
4. Run typecheck and tests for packages you touch.
5. Update [CHANGELOG.md](./CHANGELOG.md) and [ROADMAP.md](./ROADMAP.md) when user-visible behavior changes.
6. Open a pull request with a clear summary and test notes.

---

## Roadmap & changelog

- **Feature status:** [ROADMAP.md](./ROADMAP.md)
- **Release history:** [CHANGELOG.md](./CHANGELOG.md)
- **GitHub Releases:** [github.com/Magnexis/magnexis-maps/releases](https://github.com/Magnexis/magnexis-maps/releases)

Planned areas include broader offline packs, deeper mobile native mapping, business portal experiences, and continued navigation polish. Treat the roadmap as intent—not a guarantee of ship dates.

---

## Support

| Channel | Link |
| --- | --- |
| Product support page | [https://magnexis-maps.netlify.app/support/](https://magnexis-maps.netlify.app/support/) |
| Privacy | [https://magnexis-maps.netlify.app/privacy/](https://magnexis-maps.netlify.app/privacy/) |
| API health | [https://magnexis-maps.netlify.app/api/v1/health](https://magnexis-maps.netlify.app/api/v1/health) |
| Issues | GitHub Issues on this repository |

For partnership or licensing questions, contact Magnexis LLC through the support page.

---

## License

**Proprietary — Magnexis LLC.** See [LICENSE](./LICENSE).

Third-party map data, fonts, and provider content remain under their respective licenses. See [DATA_SOURCES.md](./DATA_SOURCES.md).

---

<p align="center">
  <img src="./assets/branding/magnexis-maps-logo.png" alt="Magnexis Maps" width="120" /><br />
  <sub>Magnexis Maps · Magnexis LLC</sub>
</p>
