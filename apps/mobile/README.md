# Magnexis Maps Mobile (Expo Go)

**Experimental companion.** The iPhone App Store preparation target is now [`apps/iphone`](../iphone/README.md), which packages the current web platform directly to maintain complete screen/feature parity. This Expo prototype remains available for separate native experiments.

React Native / Expo client sharing `@magnexis/api-client` and `@magnexis/shared`. Designed to run in **Expo Go** without a custom native build.

## Status

| Capability | Status |
|---|---|
| Official logo icon + splash | Implemented (`assets/icon.png`) |
| API health + search | Implemented in `App.tsx` |
| Foreground GPS permission | Implemented via `expo-location` |
| Expo Go launch | Supported (`expo start` / QR) |
| Native MapLibre map | Planned — Expo development build + MapLibre RN module |

## Toolchain

- Node 20+
- Expo CLI (via package scripts)
- Expo Go app on iOS/Android
- Android Studio / Xcode only for later native / store builds

## Run with Expo Go

```bash
# From monorepo root — API must be running and reachable
# Physical device: use LAN IP, e.g. EXPO_PUBLIC_API_URL=http://192.168.1.20:4000
pnpm --filter @magnexis/mobile start
```

1. Start `@magnexis/api` locally (or staging).
2. Ensure `CORS_ORIGIN` / network allows the device.
3. Open the terminal QR in **Expo Go**.

Equivalent: `pnpm --filter @magnexis/mobile dev`.

## Environment

| Variable | Default | Notes |
|----------|---------|-------|
| `EXPO_PUBLIC_API_URL` | `http://localhost:4000` | Use LAN IP on devices; `localhost` is emulator/host only |

## Branding

Icon and splash use the official Magnexis Maps PNG (blue M, bronze ring, charcoal). Source of truth: `assets/branding/magnexis-maps-logo.png` at the repo root.
