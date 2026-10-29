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

Build targets: Windows, macOS, Linux. Icon assets live under `src-tauri/icons/` (add platform icons before release builds).
