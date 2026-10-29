# iPhone development: shared web product

## Objective and architectural decision

The iPhone app must use the current web platform's screens, controls, and behavior. Rebuilding those separately in the Expo prototype would create a second, incomplete implementation. A hosted-only WebView would make launching dependent on a website being reachable. The selected approach packages a static export of `apps/web` locally using Capacitor, matching the existing desktop strategy while adding native device adapters. `apps/mobile` remains the experimental Expo client; `apps/iphone` is the iPhone distribution target.

The standard Next.js web build stays supported. A separate export profile generates the iPhone bundle. Device code is capability-gated and keeps standard browser behavior on web. The app uses foreground location only, native sharing, native text-to-speech, connectivity feedback, and validated app links. It does not enable background tracking or invent unavailable geographic data.

## Acceptance and verification

- Package the actual search, directions, saved, explore, settings, reporting, layers, imagery, and navigation surfaces from `apps/web`.
- Keep provider-dependent features gated identically to the web product.
- Generate a native iOS project with purpose strings, icons, privacy manifest, and a repeatable release checklist.
- Test native adapter boundaries, sharing and incoming URL validation, export packaging, and release configuration checks.
- Typecheck web and native packaging; export the frontend and sync the iOS project.
- Native compilation, signing, TestFlight, device GPS/WebGL/voice/imagery/keyboard tests, and final App Store submission require a Mac or explicitly authorized hosted build and the owner's Apple account.

## Release boundaries

Production API, share, privacy and support URLs must be verified before distribution. Account deletion is implemented in the shared Account panel and API; see `account-deletion.md`. GitHub Actions provides the authorized hosted macOS build path; see `iphone-github-actions.md`. Apple privacy disclosures must reflect the actual hosted API's retention and third-party provider contracts.
