# Magnexis Maps Desktop 1.0.0

First Windows desktop release of Magnexis Maps. The Tauri 2 shell packages a static export of the shared Horizon web UI (MapLibre maps, search, directions, account flows). It talks to the live HTTPS API — it does not ship a local backend.

## Downloads

Attach the unsigned Windows installers from this release:

| Artifact | Use |
| --- | --- |
| `Magnexis Maps_1.0.0_x64-setup.exe` | NSIS installer (recommended for most users) |
| `Magnexis Maps_1.0.0_x64_en-US.msi` | MSI for enterprise / scripted install |

Filenames may vary slightly by Tauri bundler output; prefer the `.exe` / `.msi` assets attached to this GitHub Release.

## What's included

- Interactive MapLibre basemap (Magnexis Chromatic Standard + Night)
- Place search against the production PostGIS / provider stack
- Multi-stop directions when routing providers are configured on the API
- Account register / sign-in, Google sign-in when configured, saved places, and account deletion
- Same Horizon UI used by the web and iPhone packages (responsive desktop layout)

## Requirements

- Windows 10/11 x64 with WebView2 (usually preinstalled on current Windows)
- Network access to `https://magnexis-maps.netlify.app` (API + map traffic)

## API & data

Desktop builds are compiled with:

- `NEXT_PUBLIC_API_URL=https://magnexis-maps.netlify.app`
- Matching share / privacy / support origins on that site

Search, routing, places, traffic tiles, and auth all require that API. Provider-backed features return clear errors when credentials are unavailable server-side — the client never invents routes or places.

Typed consumers of the same HTTP surface can install from GitHub Packages:

```bash
npm install @magnexis/api-client@1.1.0 @magnexis/shared@1.1.0
```

## Security & signing

- Installers in this release are **unsigned**. Windows SmartScreen may warn on first run.
- Code signing and reputation are separate release concerns and are not claimed for 1.0.0.
- Scan installers with your preferred AV before distributing internally.

## Verify after install

1. Launch Magnexis Maps.
2. Confirm the map loads and pan/zoom works.
3. Run a place search that returns live results.
4. Optional: request directions between two known places.
5. Optional: register or Google sign-in, then delete the test account.

## Build from source

```powershell
pnpm install
pnpm --filter @magnexis/desktop build:windows
```

Artifacts land under `apps/desktop/src-tauri/target/release/bundle/` (`nsis/` and `msi/`).

## Related links

- Web product: https://magnexis-maps.netlify.app/
- API health: https://magnexis-maps.netlify.app/api/v1/health
- Privacy: https://magnexis-maps.netlify.app/privacy/
- Support: https://magnexis-maps.netlify.app/support/
