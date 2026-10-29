# Deployment

## Environments

| Layer | Development | Staging / Production |
|-------|-------------|----------------------|
| Web | `localhost:3000` | **Netlify** (`apps/web`, see `netlify.toml`) |
| Admin | `localhost:3001` | Separate protected host |
| API | `localhost:4000` | Container / VM (not Netlify) |
| DB | Docker PostGIS | Managed Postgres + PostGIS |
| Redis | Docker | Managed Redis |
| Tiles | OpenFreeMap (OSM vector) | Licensed / self-hosted vector tiles |
| Routing | Unconfigured / local Valhalla | Self-hosted Valhalla |
| Mobile | Expo Go + LAN API | Store builds / EAS later |

## Rules

- Never embed private provider keys in frontend bundles.
- Do not claim a public URL exists until it is actually deployed.
- Do not enable paid cloud resources without explicit authorization.
- Keep `.env` out of git; use platform secret stores.
- Add `.netlify/` to ignore lists (already in root `.gitignore`).

## GitLab

1. Create a GitLab project and push this repo (see README remote setup).
2. CI runs from [`.gitlab-ci.yml`](../../.gitlab-ci.yml): install, unit tests, DB migrate/seed (service), typecheck, web + API builds.
3. Optional: keep `.github/workflows/ci.yml` as a mirror; prefer GitLab for this workspace.

## Netlify (website)

Config lives at the monorepo root: [`netlify.toml`](../../netlify.toml).

### Link & deploy (Git-based)

1. In Netlify: **Add new site → Import an existing project** → connect GitLab → select this repo.
2. Confirm build settings match `netlify.toml` (root command builds `@magnexis/web`).
3. Set site environment variables (Site configuration → Environment variables):

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | Browser-reachable API origin (required) |
| `NEXT_PUBLIC_MAP_STYLE_URL` | MapLibre style JSON |
| `NEXT_PUBLIC_DEFAULT_CENTER_LNG` / `_LAT` / `_ZOOM` | Default map view |
| `NEXT_PUBLIC_MAP_ATTRIBUTION` | Attribution string |

4. Deploy. Netlify’s Next.js runtime handles SSR. The API and Postgres remain separate hosts — point `NEXT_PUBLIC_API_URL` at them and allow the Netlify origin in API `CORS_ORIGIN`.

### Manual CLI deploy

```bash
# From repo root (requires netlify-cli login + linked site)
pnpm install
pnpm --filter @magnexis/shared --filter @magnexis/api-client --filter @magnexis/map-styles build
pnpm --filter @magnexis/web build
npx netlify deploy          # draft
npx netlify deploy --prod   # production (only when ready)
```

Do not invent or hardcode a production URL in docs or code until the site exists.

## Mobile (Expo Go)

```bash
pnpm --filter @magnexis/mobile start
```

- Install **Expo Go** on a device or emulator.
- Set `EXPO_PUBLIC_API_URL` to a host the device can reach (LAN IP in local network).
- Scan the Metro QR code. Health + search + GPS work without a custom native build.
- MapLibre native maps require an Expo **development build** later — not part of the Expo Go path.

## Suggested API containers

Build the API image from `services/api` with Node 20. Run migrations as a release job before traffic shift.
