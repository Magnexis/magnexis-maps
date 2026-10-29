# Navigation progress follow-up

The existing `/navigate` page uses `apps/web/src/lib/route-progress.ts` to show remaining distance and the next maneuver from GPS positions. This follow-up continues that implementation.

The routing adapters supply different distance meanings: TomTom returns offsets from the route start, while OSRM and Valhalla return individual step lengths. Progress now projects real maneuver coordinates onto route geometry when available. Without coordinates, it uses TomTom offsets or accumulated step lengths. All comparisons use geometry meters; displayed distances use the same scale as the provider's route total.

Distance to the next maneuver follows the route rather than a straight line across bends. Empty geometry retains the route totals; routes without maneuvers show remaining distance and generic guidance.

## Verification

From `apps/web`, run the installed tools without changing dependencies:

```powershell
.\node_modules\.bin\vitest.cmd run
.\node_modules\.bin\tsc.cmd -p tsconfig.json --noEmit
```

At the start of this follow-up, web typechecking reported `TS2307` in `next.config.ts` because `@next/env` could not be resolved. A subsequent dependency fix declared `@next/env` directly in the web package and lockfile, matching the installed Next.js version. Environment loading behavior is unchanged.

## Limits

This calculation uses nearest-segment projection. Route crossings and overlapping geometry can require travel history to disambiguate. ETA still scales the provider duration by distance remaining. This change does not implement rerouting, change voice scheduling, or verify live GPS guidance on a device.
