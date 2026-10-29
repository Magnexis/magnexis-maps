# iPhone App Store preparation

## Current status

Native Xcode project and repeatable local frontend packaging are prepared in `apps/iphone`. The UI comes directly from the current web platform. Native compilation/signing and physical-device validation have not been performed on Windows. Do not submit the development bundle or describe this work as App Store approval.

## Submission blockers

1. **Account lifecycle verification:** in-app deletion and transactional API deletion are implemented, with isolated PostgreSQL integration coverage. Apply migration `002_account_deletion.sql` and verify the hosted lifecycle before submission. See [deletion scope](account-deletion.md).
2. **Production services:** provide and verify public HTTPS API, public sharing origin, published privacy policy, and support URLs. Check routing/search/imagery licensing for distribution. Configure rate limits, operational retention and account support on the deployed API.
3. **Apple owner setup:** confirm ownership/availability of `com.magnexis.maps`, choose the signing team in Xcode, create the App Store Connect record, and manage signing in the owner's account. No credentials have been accessed or created here.
4. **Native validation:** `.github/workflows/iphone.yml` uses a GitHub-hosted macOS runner to compile and launch the simulator app, and has a protected signing/TestFlight path. Configure the signing environment described in [GitHub iPhone builds](iphone-github-actions.md). Physical iPhone validation and App Review remain separate requirements. Do not infer success from a static web build or `cap sync`.

Apple's [current SDK upload requirement](https://developer.apple.com/news/upcoming-requirements/?id=02032026a) requires Xcode 26 or later. Re-check the requirement at archive time. Review [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) sections 2.1 (completeness), 4.2 (minimum functionality), and 5.1 (privacy/account deletion). Native device functions and a local frontend bundle do not guarantee approval.

## Prepared assets and configuration

- Bundle identifier `com.magnexis.maps`, marketing version `1.4.0`, initial build `1`; increase build number per upload.
- iPhone target only; portrait and landscape retained. iPad support is not claimed.
- Scene-based native application lifecycle from the Capacitor 8 template.
- Official opaque 1024×1024 Magnexis icon and branded launch artwork.
- Foreground location descriptions, with no background location entitlement or background mode.
- `magnexis-maps://place?...` and `magnexis-maps://route?...` URL handling; no unverified Associated Domains entitlement.
- Privacy manifest is included in Xcode resources. It conservatively lists location, identity, search and report content used by connected features as app functionality, with no tracking. The owner must reconcile this with actual server retention and third-party practices before submission. Do not select “Data Not Collected” without reviewing API/provider processing.
- No analytics/advertising SDK was added. Transport uses HTTPS in release configuration; no arbitrary-load transport exception is added.

## Listing draft (review before use)

- Name: **Magnexis Maps**
- Subtitle: **Places, routes & discovery**
- Primary category: Navigation
- Secondary category: Travel (optional)
- Keywords: maps,navigation,places,directions,travel,walking,cycling
- Description: “Explore places, discover nearby activity hotspots, keep local favorites, and plan driving, walking, or cycling routes with Magnexis Maps. Browse an interactive map, inspect place details, compare available routes, and follow foreground guidance with spoken instructions. Hotspots estimate activity from nearby public place density; they are not live foot-traffic data. Search, routing, traffic, and imagery availability depend on connected providers and regional coverage. Offline map downloads and background navigation are not included.”
- Review notes draft: “Browsing and local favorites work without an account. Location is optional and requested by Locate/navigation. Use a stable public test origin and destination to verify routing. Account-specific review credentials must be provided by the owner if required. All provider features advertised in the final listing must be enabled on the review service.”

## Screenshot capture plan

Capture the actual signed build, with no fabricated data or overlays: map/search, real place details, a real route with options, local favorites, and the navigation screen. Use supported iPhone screenshot dimensions from App Store Connect at submission time. Test both compact and large iPhone layouts. No simulator screenshots or marketing screenshots have been fabricated in this repository.

## Release procedure

1. Resolve the blockers and review data disclosures, age-rating questionnaire, content rights, export-compliance answers, and published contact information.
2. Build the shared frontend with the four production URL variables, sync Capacitor, and run `release:check` (see `apps/iphone/README.md`).
3. On macOS, open `apps/iphone/ios/App/App.xcodeproj`; resolve Swift packages, select the signing team and real device, verify version/build, and archive with the Release configuration.
4. Validate the archive, inspect its privacy report and package contents, then have the owner authorize upload/TestFlight. Distribution and submission are separate actions requiring explicit authorization.
5. Record device model, iOS version, build number, endpoint environment, test results and reviewer notes. Do not publish until the real-device checklist below passes.

## Device acceptance checklist

- Cold launch and offline cold launch; map tiles/glyphs load when connected; no blank WebGL canvas.
- Search keyboard, close/clear controls, select/deselect place and Escape with hardware keyboard.
- Real place details and imagery, provider-unavailable states, save/remove local favorite, relaunch persistence.
- Route modes, route alternatives, stops, swapping endpoints, avoidance options, provider failures, start/exit navigation.
- Foreground permission granted, denied, approximate, revoked, and Location Services disabled; browsing remains usable.
- GPS sensor fields, route overview stays still while GPS updates, resume following, speech mute/repeat/rate, interruption and app background behavior.
- Native share completion/cancellation, public link recipient behavior, incoming custom URLs and malformed URL rejection, external links.
- Settings, units, themes, VoiceOver labels/focus, large text, safe areas, portrait/landscape, reduced motion, offline/reconnect.
- Account lifecycle, deletion, data removal/retention, no development credentials or diagnostics in product surfaces.
