# Magnexis Maps vs Google Maps

People reach for Google Maps out of habit. Magnexis Maps is built for the same everyday jobs—search, place details, directions, navigation, layers, sharing—while drawing a sharper line around **honest geography**, **account control**, and **open development**.

This page is a product comparison, not a claim that Magnexis duplicates every Google service. Magnexis never invents routes, traffic, or places when providers are offline.

Live product: [magnexis-maps.netlify.app](https://magnexis-maps.netlify.app/)

---

## Why choose Magnexis

| You care about… | Magnexis Maps | Typical Google Maps experience |
| --- | --- | --- |
| **Trustworthy results** | Routes and places come from configured providers or stored data; clear errors when a provider is unavailable | Seamless UX that can obscure outages behind cached or estimated behavior |
| **One product everywhere** | Same Horizon interface on web, Windows desktop, and iPhone | Separate mobile/web experiences with different feature timing |
| **Account ownership** | Register, OAuth sign-in, saved places, and **transactional account deletion** | Account deletion and data controls live deep in Google Account flows |
| **Community corrections** | Moderated reports with apply/revert—people can improve the map without silent overwrites | Suggest-an-edit flows owned by Google’s pipeline |
| **Open stack** | Public repo, typed API client packages, documented providers and attribution | Closed client and proprietary tile/routing stack |
| **Privacy posture** | Foreground location on iPhone, server-side provider keys, published privacy/support pages | Broad Google account + ads ecosystem adjacency |

---

## Everyday workflow parity

| Workflow | Magnexis | Notes vs Google |
| --- | --- | --- |
| Map-first home + universal search | Horizon search pill, MapLibre canvas, bottom dock (Search / Go / Explore / Saved) | Familiar map-first pattern without Google branding |
| Place details | Cards with address, hours/phone when present, photos, share, save, directions | No fabricated ratings or reviews |
| Search history / saved places | Recents, favorites, Home/Work slots; optional account saves | Collection depth is intentionally focused |
| Directions | Drive / walk / bike, stops, reorder, swap, avoid options, alternatives | Transit and flights are not claimed |
| Route ETA | Real provider duration; traffic delay when the provider returns it | No claim of Google-equivalent traffic prediction |
| Navigation | Dedicated `/navigate`, GPS progress, VoiceNav | No CarPlay / lock-screen guidance yet |
| Layers | Standard / Night, 3D buildings, terrain / satellite when configured, traffic when keyed | Availability follows licensing and keys |
| Street imagery | Mapillary and optional Google Street View Static via server proxy | Device WebView validation still recommended |
| Sharing | Public web links + native share on iPhone | Universal Links need domain association for full deep-link polish |
| Offline | Bundled UI + local favorites/settings | Offline tiles / offline routing not claimed |

---

## What Magnexis deliberately does differently

1. **No fake geography** — If routing or geocoding is down, you get a structured failure—not a guessed polyline.
2. **Chromatic maps** — Magnexis Standard and Night paints on OpenFreeMap liberty, with real road shields from OSM refs.
3. **Provider isolation** — TomTom, Valhalla, MapTiler, Mapillary, and Google enrichment plug in behind one API.
4. **Desktop + packages** — Windows installers and `@magnexis/api-client` / `@magnexis/shared` for integrators.
5. **Community with moderation** — Edits are reports first, applied only after review.

---

## Side-by-side product checklist

Use this when evaluating a build (web, desktop, or iPhone):

1. Cold launch → map readable within a second of tiles loading  
2. Search a known place → select → peek card → **Go**  
3. Add a stop → swap ends → pick an alternative route  
4. Start navigation → hear / see the next maneuver  
5. Toggle Night / 3D / traffic (when configured)  
6. Save a place → sign in → delete the test account  
7. Share a place or route link and reopen it  

Record gaps as **missing implementation**, **provider not configured**, or **device validation pending**—never as “broken” solely because a commercial key is absent.

---

## Honest gaps (so expectations stay clean)

- Transit, flights, indoor maps, and Google-scale offline packs are **not** Magnexis claims today  
- Navigation does not yet offer automatic off-route reroute or CarPlay  
- Hotspots are **public-place-density** estimates—not live foot traffic  
- App Store / TestFlight distribution still follows Apple’s review and SDK rules  

Those gaps are product choices and roadmap items—not reasons to invent data.

---

## Related docs

- [ROADMAP.md](../ROADMAP.md) — feature status  
- [README.md](../README.md) — public product overview  
- [iphone-app-store.md](./iphone-app-store.md) — store submission checklist  
- [DATA_SOURCES.md](../DATA_SOURCES.md) — attribution and licenses  
