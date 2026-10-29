# Magnexis Maps for iPhone

The iPhone distribution target bundles the **same Next.js interface as `apps/web`** using Capacitor 8. Search, map paints, panels, saved places, directions, layers, imagery, reporting, settings, and `/navigate` remain one implementation. This is not the separate Expo prototype in `apps/mobile` and does not load the product from a remote website at startup.

Native integrations: foreground GPS, the iOS share sheet, device text-to-speech, connectivity feedback, external browser links, and validated `magnexis-maps://place` / `magnexis-maps://route` links. Tile, imagery, search, and routing services still require connectivity. There are no downloaded offline map packs or background navigation capabilities.

## Local development

Requires Node 22+, Corepack/pnpm 9.15, and the existing workspace dependencies. Xcode on macOS is required to compile, install, or archive iOS. Local frontend exports and Capacitor sync can run on Windows.

```powershell
# Repository root
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @magnexis/shared --filter @magnexis/api-client build

# Optional: choose an API reachable from your phone; keep keys on that API
$env:IPHONE_API_URL = 'http://YOUR_LAN_IP:4000'
corepack pnpm --filter @magnexis/iphone build -- --development
corepack pnpm --filter @magnexis/iphone sync
```

The local fallback is `http://localhost:4000`; it is intended for a simulator on the API host, not a physical phone. iOS transport security may block plain HTTP development endpoints; use an HTTPS development endpoint or a narrowly scoped local debug exception. Production configuration never adds arbitrary-load exceptions.

The frontend export uses Next.js's build cache. Stop `next dev` before exporting, then restart it afterward. Do not run a web build and an iPhone export concurrently.

On a Mac:

```bash
corepack pnpm --filter @magnexis/iphone open
```

Select your own Apple development team in Xcode and choose an iPhone simulator or device. No team ID, certificate, provisioning profile, or Apple credential is stored in this repository.

## Production bundle preparation

Provide `IPHONE_API_URL`, `IPHONE_SHARE_URL`, `IPHONE_PRIVACY_URL`, and `IPHONE_SUPPORT_URL` in the build environment. These are public URLs, not secrets. All must use public HTTPS hosts; a syntactically valid URL is not evidence that its service is deployed.

```bash
corepack pnpm --filter @magnexis/iphone build
corepack pnpm --filter @magnexis/iphone sync
corepack pnpm --filter @magnexis/iphone release:check
```

The build rejects missing/loopback/private/placeholder production endpoints. Release checks intentionally reject a development bundle. API/provider credentials stay server-side. Only frontend assets are copied into `www` and the Xcode resource bundle; `.env` files are not copied. Rebuilding the shared web product is how an iPhone release receives web UI changes; this is not an over-the-air code-update system.

## Checks

```bash
corepack pnpm --filter @magnexis/iphone test
corepack pnpm --filter @magnexis/iphone typecheck
corepack pnpm --filter @magnexis/web test
corepack pnpm --filter @magnexis/web typecheck
corepack pnpm --filter @magnexis/navigation test
```

The checked-in `ios` project includes purpose strings, URL scheme, official opaque 1024-pixel icon, branded launch screen, version metadata, a privacy manifest resource, and Swift Package Manager plugin references. `cap sync ios` regenerates plugin references after install. Build output and native copies of the frontend are ignored by Git.

## Distribution status

**Release preparation; verify workflow results before distribution.** Account deletion is implemented. [GitHub Actions](../../docs/iphone-github-actions.md) compiles the real native app on macOS (simulator evidence on push; signed App Store IPA + ASC upload on manual **testflight** when `app-store` secrets are configured). See [App Store preparation](../../docs/iphone-app-store.md) for policy, provider, real-device and review gates, and [the Google Maps comparison](../../docs/google-maps-parity.md) for known product gaps.
