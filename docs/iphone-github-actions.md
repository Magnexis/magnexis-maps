# iPhone builds with GitHub Actions

Two workflows:

| Workflow | File | When it runs | Output |
| --- | --- | --- | --- |
| **iPhone simulator** | `.github/workflows/iphone.yml` | Push to `main` (iPhone/web paths) or manual dispatch | Simulator build, launch screenshot |
| **iPhone TestFlight** | `.github/workflows/iphone-testflight.yml` | **Manual dispatch only** | Signed App Store IPA → App Store Connect |

TestFlight is a separate workflow on purpose: every push used to show a skipped `testflight` job, which looked like a failure to upload. Use **Actions → iPhone TestFlight → Run workflow** on `main` when you want an upload.

Simulator uses `macos-15`. TestFlight uses `macos-26` (App Store Connect requires the iOS 26 SDK / Xcode 26). A local Mac is not required.

## Protected signing environment

Create a GitHub Actions environment named `app-store`. Restrict deployment branches to `main`. Keep secrets out of issue comments, chat, commits, workflow inputs, and artifacts.

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

The signing script (`apps/iphone/scripts/ci-signing.sh`) validates bundle/team, installs the certificate into a temporary keychain, writes export options, installs the ASC API key for `altool`, and cleans up in an `always()` step. Pull requests never receive signing material.

## Upload to TestFlight

1. Actions → **iPhone TestFlight** → **Run workflow** (branch `main`).
2. Approve the `app-store` environment if reviewers are required.
3. The job builds the production web bundle, archives with `CURRENT_PROJECT_VERSION` = workflow **run number**, exports a signed IPA, validates with `xcrun altool --validate-app`, then uploads with `xcrun altool --upload-app`.

Ensure the run number exceeds any previously uploaded build number.

An uploaded build must finish Apple processing before TestFlight testers can install it. Complete the App Store listing checklist in `iphone-app-store.md` before App Review.

References: [GitHub macOS runner images](https://github.com/actions/runner-images), [Apple certificates in GitHub Actions](https://docs.github.com/en/actions/how-tos/security-for-github-actions/security-guides/installing-an-apple-certificate-on-macos-runners-for-xcode-development).
