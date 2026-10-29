# Navigation and sharing reliability

## Fixed behavior

- VoiceNav previously suppressed both speech and maneuver advancement after speaking a near-turn cue. A subsequent GPS fix at the turn now advances the maneuver index without repeating the cue, allowing guidance to continue and arrival to be announced once.
- Sharing previously returned `copied` even without clipboard support, and copied links after the user cancelled native sharing. Sharing now distinguishes `shared`, `copied`, and `cancelled`. All four consumers handle cancellation without a success message, and the dropped-pin card also shows a useful failure message.
- Speed-limit lookup previously rejected on network errors, invalid JSON, or a null body. The navigation GPS callback did not handle those rejections. Lookup now returns an unknown limit on those paths and validates positive numeric limits and string addresses.

## Checks

Run from each package directory:

```powershell
# apps/web and packages/navigation
.\node_modules\.bin\vitest.cmd run
.\node_modules\.bin\tsc.cmd -p tsconfig.json --noEmit
```

Tests exercise scheduler movement and arrival, native sharing and clipboard boundaries, cancellation, denied clipboard writes, offline speed-limit lookup, invalid responses, and valid provider values. The unresolved `@next/env` import in `apps/web/next.config.ts` was subsequently fixed by declaring the web package's direct dependency at version `15.5.28`, matching the installed Next.js version. The lockfile records the same dependency; environment loading behavior is unchanged.

Real device GPS, speech output, and operating-system share dialogs still need manual validation. Unit tests simulate those browser boundaries.
