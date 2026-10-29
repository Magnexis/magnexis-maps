# Google Maps comparison and shared-platform parity

Baseline: 2026-10-28. Compare workflow quality and capabilities; do not copy Google branding, assets, text, or source. The iPhone UI is built from `apps/web`; that prevents separate native screens drifting away from the current web product. This is shared-code parity, not a claim that Magnexis equals all Google Maps services.

Reference inspection used the public Google Maps interface (search, Directions, transport selectors, reverse endpoints, Saved, Recents, Layers, Street View and map controls) and Google's [directions documentation](https://support.google.com/maps/answer/144339?hl=en). Personal account content is not part of this comparison.

| Workflow | Magnexis implementation reused on iPhone | Remaining difference / validation |
| --- | --- | --- |
| Map-first home, universal search, map controls | Horizon shell and MapLibre canvas, identical sources | Physical WKWebView WebGL, keyboard, safe-area and gesture testing required |
| Place details | Search/place cards, contacts, opening hours, imagery, share, save, directions | Provider coverage varies; no fabricated ratings or reviews |
| Search history / saved places | Local favorites, recents, home/work; optional account saves | Account collection management and sync depth remain limited |
| Directions | Driving/walking/cycling, stops, reorder, swap, avoid options, alternatives | Transit, flights and other unintegrated modes are absent |
| Route selection / ETA | Real provider geometry and duration; traffic awareness where returned | No claim of Google-equivalent prediction quality |
| Navigation | Dedicated `/navigate`, real instructions, GPS progress, speed display, native voice adapter | No automatic off-route rerouting, background/lock-screen guidance or CarPlay |
| Layers | Standard/Night, 3D, terrain/satellite where configured, traffic and imagery gates | Licensing and configured providers determine availability |
| Hotspots | Optional red activity circles clustered from nearby public-place density | Not live foot-traffic telemetry; a future licensed mobility provider would need a separate, disclosed adapter |
| Street imagery | Existing Mapillary/Google adapters and credits | Native WebView compatibility and provider terms need device verification |
| Offline use | Bundled interface, local favorites/settings, explicit offline status | Offline tile downloads, offline search and offline routing absent |
| Sharing | Public web-root links, native iOS share sheet, validated custom app links | Universal Links require a verified domain and association file; not configured |
| Privacy / permissions | Native foreground permission, shared policy/support pages, transactional account deletion | Hosted retention and App Store disclosures need operational review |

## Expo companion status

The Expo Go companion is not the iPhone distribution target; `apps/iphone` bundles
the shared web product. Its workflow now covers reachable-API health, foreground
location, search with location bias, destination selection, driving/walking/cycling
route requests, and selecting real route alternatives. It deliberately does not
claim native MapLibre rendering, turn-by-turn instructions, background guidance,
offline routes, or saved-place sync in Expo Go. Those require a development build
or the shared iPhone target.

## Hotspots

Hotspots are available in the shared Horizon map (web, desktop shell, and Capacitor
iPhone build) and in the Expo companion after the person explicitly enables
foreground location. A hotspot is a cluster of three or more active public places;
the API returns a relative local activity score, and the map renders it as a red
circle. The score is deliberately labeled as a **public-place-density estimate**.
It is not live foot-traffic, device-location, or occupancy data, and it must not be
described as such in App Store metadata or marketing until a lawful, documented
mobility-data source is integrated.

## Compare on each meaningful change

1. Run the same task on Google Maps, the desktop web UI, the web UI at iPhone width, and the actual iPhone build when available.
2. Check search → select place → save → directions → alternate route → navigation → exit, plus permission denial, slow/offline network, empty results and cold launch.
3. Confirm every iPhone product control uses the shared web implementation; put platform-specific behavior behind adapters.
4. Record observed failures with the route, device/runtime, expected behavior, actual result, and regression evidence. Do not mark a provider-gated feature as unavailable merely because a key is absent; distinguish configuration from missing implementation.
5. Validate dark/light, portrait/landscape, large text, VoiceOver, notch/home indicator, keyboard appearance, and reduced motion. Simulator browser resizing does not replace device evidence.

This is a development checklist, not a scheduled monitoring service. Future comparison passes should update this document with evidence rather than treating this baseline as permanent.

## Evidence from this pass

- Built the shared interface as a static iPhone bundle and synced the native project with six plugins.
- Inspected the bundle through a loopback-only browser preview at 393×852: the MapLibre road map and labels rendered; the Directions panel exposed Drive/Walk/Bike, endpoints, swap, stops and avoidance options; Saved exposed Home/Work and its guest state.
- Observed the corresponding Google Maps directions transport selectors and endpoint/reverse controls. Unimplemented Google service modes remain recorded as gaps above.
- Browser observations do not validate WKWebView, native plugins, live routing services, physical GPS, speech output, OS share sheets, or an Xcode archive. Those require the device/release checklist.
