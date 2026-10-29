# iPhone builds with GitHub Actions

The `iPhone build and TestFlight` workflow in `.github/workflows/iphone.yml` runs on a GitHub-hosted `macos-26` runner. A local Mac is not required.

## What each path produces

| Dispatch / trigger | Job | Output |
| --- | --- | --- |
| Push to `main` (iPhone/web paths) or **simulator** | `simulator` | Real native compile for the iOS Simulator (`App.app`), launch evidence screenshot, and production web bundle artifact — not a stub |
| Manual **testflight** | `simulator` then `testflight` | Same validation, then a **signed App Store IPA** (`iphoneos` Release archive + export) validated and uploaded to App Store Connect |

Pushes never receive signing secrets. Only a manual **testflight** dispatch using the protected `app-store` environment installs certificates and uploads. Check current GitHub-hosted runner allowances before using private repositories or enabling paid overages. The workflow does not select a paid larger runner.

## Protected signing environment

Create a GitHub Actions environment named `app-store`. Configure required reviewers and restrict deployment branches to `main` in the repository settings before using distribution. Keep secrets out of issue comments, chat, commits, workflow inputs, and artifacts.

Set environment **variable** `IOS_TEAM_ID` to the Apple Developer team identifier. Add these **environment secrets**:

| Secret | Value |
| --- | --- |
| `IOS_CERTIFICATE_P12` | Base64 of the Apple Distribution certificate **and its private key** exported as a password-protected P12 |
| `IOS_CERTIFICATE_PASSWORD` | P12 password |
| `IOS_PROVISIONING_PROFILE` | Base64 of the App Store distribution provisioning profile for `com.magnexis.maps`, matching that certificate/team |
| `ASC_API_KEY_ID` | App Store Connect API key ID |
| `ASC_API_ISSUER_ID` | API issuer ID |
| `ASC_API_KEY_P8` | Complete P8 API key contents; use a role that permits build upload (App Manager or Admin) |

Encode files for the secrets (run locally; do not paste outputs into chat):

```bash
base64 -i Certificates.p12 | pbcopy          # → IOS_CERTIFICATE_P12
base64 -i Magnexis_Maps_AppStore.mobileprovision | pbcopy  # → IOS_PROVISIONING_PROFILE
```

Having an active App Store Connect app does not supply a distribution private key or API key. An Apple account owner must authorize access to these assets. A certificate downloaded from Apple without its private key cannot sign a build. Do not revoke existing certificates just to configure CI.

The signing script (`apps/iphone/scripts/ci-signing.sh`) validates bundle/team, expiry and App Store profile type, installs the certificate into a temporary keychain, writes export options (`method: app-store-connect`, manual Apple Distribution), verifies an Apple Distribution identity is present, installs the ASC API key for `altool`, and removes temporary credentials in an `always()` cleanup step. Pull requests never receive signing material. No signing secrets or IPA are uploaded as workflow artifacts.

## TestFlight and App Review

After simulator validation passes and signing settings are configured:

1. Actions → **iPhone build and TestFlight** → **Run workflow** → choose **testflight** (branch `main`).
2. Approve the `app-store` environment if reviewers are required.
3. The job archives with `CURRENT_PROJECT_VERSION` set to the workflow **run number**, exports a signed IPA (refuses upload if the IPA is under ~1 MB), validates with `xcrun altool --validate-app`, then uploads with `xcrun altool --upload-app`.

Ensure the run number exceeds any previously uploaded build number, or bump marketing/build numbering before dispatch.

An uploaded build must finish Apple processing before TestFlight or App Review can use it. Upload is separate from App Review submission. Complete the real-device checklist, final privacy disclosures, screenshots, age rating, content rights, production service checks and review metadata in `iphone-app-store.md` before selecting and submitting the build. App Review approval is never implied by a successful workflow.

References: [GitHub macOS runner images](https://github.com/actions/runner-images), [Apple certificates in GitHub Actions](https://docs.github.com/en/actions/how-tos/security-for-github-actions/security-guides/installing-an-apple-certificate-on-macos-runners-for-xcode-development).
