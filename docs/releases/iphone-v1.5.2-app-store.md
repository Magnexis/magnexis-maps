# Magnexis Maps 1.5.2 — App Store submission packet

This packet is the source of truth for the first App Store submission of the Capacitor iPhone target. It intentionally separates repository-verified facts from information that only the Apple account owner can truthfully provide in App Store Connect.

## Release identity

| Field | Value |
| --- | --- |
| Product name | Magnexis Maps |
| Bundle identifier | `com.magnexis.maps` |
| Marketing version | `1.5.2` |
| Platform | iPhone only |
| Minimum iOS version | 15.0 |
| Primary category | Navigation |
| Suggested secondary category | Travel |
| Encryption declaration | Uses only exempt encryption for ordinary HTTPS transport (`ITSAppUsesNonExemptEncryption = NO`) |

The upload build number must be greater than every build already accepted by App Store Connect. The TestFlight workflow supplies the GitHub Actions run number as the build number; do not override it with a lower value.

## App Store listing copy

### Name

Magnexis Maps

### Subtitle

Places, routes & discovery

### Promotional text

Search places, compare routes, and explore the map with a focused, privacy-conscious navigation experience.

### Description

Magnexis Maps helps you explore places, search destinations, compare driving, walking, and cycling routes, and keep local favorites. Inspect a place, review route alternatives, and use optional foreground location when you choose to locate yourself or begin guidance.

Map imagery, traffic, search, and routing depend on connected providers and regional coverage. Street imagery may be unavailable in some areas. Offline map downloads and background navigation are not included. Activity hotspots reflect nearby public-place density and are not live foot-traffic data.

### Keywords

maps,navigation,places,directions,travel,walking,cycling

### Support URL

`https://magnexis-maps.netlify.app/support/`

### Privacy policy URL

`https://magnexis-maps.netlify.app/privacy/`

## App Review notes

Magnexis Maps is a map search and routing app. Browsing, search, route planning, and local favorites do not require an account. Foreground location is optional: reviewers can decline it and enter both route endpoints manually.

For a deterministic routing check, set the origin to **New Haven, CT** and the destination to **Hartford, CT**, then select **Get route**. The app returns available route alternatives from its connected routing provider. Provider coverage and street imagery vary by region; an unavailable-image message is an expected coverage state rather than a broken control.

If the final build enables an account-only feature, provide a stable reviewer account and credentials in App Store Connect. Do not submit time-limited credentials.

## Privacy answers to reconcile before submission

The bundled privacy manifest declares precise location, email address, name, user ID, search history, and user-provided report content for app functionality, with no tracking. The App Store Connect privacy answers must match the deployed API and every integrated provider. The owner must confirm each of the following before selecting an answer:

- Whether anonymous search queries or route coordinates are retained server-side, and for how long.
- Whether an account profile, favorites, or reports are linked to an identity on the deployed service.
- Which providers receive search, routing, imagery, or traffic requests in the release environment.
- That neither the app nor a provider uses collected data for tracking or advertising.
- That the published policy describes collection, sharing, retention, and deletion accurately.

Do not select “Data Not Collected” unless this reconciliation demonstrates it is true for the released app and its connected services.

## Assets to capture from the signed build

Use the actual TestFlight or signed release build, not browser mocks or edited simulator composites. Apple currently requires at least one screenshot for an iPhone Dynamic Island medium display; provide the current required resolution shown in App Store Connect at upload time.

1. Map-first Explore surface.
2. Search result with real place details.
3. Directions with real route alternatives.
4. Active route / navigation screen.
5. Saved local favorite.

Keep screenshots free of personal addresses, developer diagnostics, unfinished provider labels, and unsupported claims. Capture compact and large iPhone layouts during device QA even if one required high-resolution size is ultimately uploaded.

## Owner-managed release gates

- [ ] `app-store` GitHub environment contains the distribution certificate, matching App Store profile, team ID, and App Store Connect API key.
- [ ] App Store Connect record exists for `com.magnexis.maps`; agreements, tax, banking, availability, age rating, and export-compliance responses are completed by the owner.
- [ ] Production API, privacy policy, support form, account deletion, search, routing, traffic, and imagery have been tested from the release service.
- [ ] Physical iPhone testing covers launch, denied/granted/revoked location, search, routes, account deletion, sharing, deep links, offline/reconnect, VoiceOver, large text, reduced motion, and rotation.
- [ ] A signed archive is validated and uploaded through **iPhone TestFlight**; Apple processing completes without an ITMS validation error.
- [ ] TestFlight testing is complete and reviewer credentials/notes are current.
- [ ] Listing metadata, privacy answers, screenshots, content rights, and App Review information are entered in App Store Connect.

## Repository release gates

Run these in a macOS-capable CI context before any upload:

```bash
pnpm --filter @magnexis/iphone test
pnpm --filter @magnexis/iphone typecheck
pnpm --filter @magnexis/iphone build
pnpm --filter @magnexis/iphone sync
pnpm --filter @magnexis/iphone release:check
```

The GitHub Actions **iPhone simulator** workflow compiles and launches the native app. The manual **iPhone TestFlight** workflow archives a device build and uploads it only after all protected `app-store` signing settings are available.

## Submission boundary

Uploading a build to TestFlight and submitting an app to App Review are separate irreversible external actions. Keep the repository ready for both, but obtain explicit owner authorization immediately before each action.
