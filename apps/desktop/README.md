# Magnexis Maps Desktop (Tauri 2)

Desktop shell reuses the Next.js web UI at `apps/web` (Horizon). Phone, tablet, and desktop share the same screens and flows; only layout proportions change via responsive breakpoints — not separate designs.

## Requirements

- Node.js 20+
- pnpm 9+
- Rust toolchain ([rustup](https://rustup.rs/))
- Platform webview dependencies (WebView2 on Windows)

## Commands

```bash
# Terminal 1 — API + web
pnpm docker:up
pnpm db:migrate && pnpm db:seed
pnpm --filter @magnexis/api dev
pnpm --filter @magnexis/web dev

# Terminal 2 — Tauri (after Rust is installed)
pnpm --filter @magnexis/desktop dev
```

## Version 1.0.0 release build

The desktop build packages a static export of the shared Horizon interface; it does
not download the web product at launch. Release CI bakes in
`https://magnexis-maps.netlify.app` as the API / share / privacy / support origin.

On Windows, create installer artifacts with:

```powershell
pnpm --filter @magnexis/desktop build:windows
```

The unsigned NSIS and MSI artifacts appear under
`apps/desktop/src-tauri/target/release/bundle/`. GitHub Actions
(`.github/workflows/desktop-release.yml`) builds those installers on
`windows-latest` and uploads them to the `desktop-v*` GitHub Release with the notes
in `RELEASE_NOTES_v1.0.0.md`.

Run and scan each installer before redistributing it. Windows
SmartScreen/reputation and code-signing are separate release concerns; this project
does not claim either is configured.
