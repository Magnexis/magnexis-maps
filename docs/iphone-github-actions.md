# iPhone builds with GitHub Actions

The `iPhone build and TestFlight` workflow in `.github/workflows/iphone.yml` runs on a GitHub-hosted `macos-26` runner. A local Mac is not required. It installs the pinned pnpm dependencies, builds the shared web interface against the production URLs, syncs Capacitor, compiles the actual native Xcode project, launches it in an iPhone simulator, and uploads the simulator app and launch screenshot as artifacts. A screenshot is launch evidence, not proof of complete navigation or real-device behavior.

Pushes to `main` affecting the iPhone/web sources run simulator validation. Actions → **iPhone build and TestFlight** → **Run workflow** → **simulator** also runs it. Check current GitHub-hosted runner allowances before using private repositories or enabling paid overages. The workflow does not select a paid larger runner.

## Protected signing environment

Create a GitHub Actions environment named `app-store`. Configure required reviewers and restrict deployment branches to `main` in the repository settings before using distribution. Keep secrets out of issue comments, chat, commits, workflow inputs, and artifacts.

Set environment variable `IOS_TEAM_ID` to the Apple Developer team identifier. Add these **environment secrets**:

| Secret | Value |
| --- | --- |
| `IOS_CERTIFICATE_P12` | Base64 of the Apple Distribution certificate **and its private key** exported as a password-protected P12 |
| `IOS_CERTIFICATE_PASSWORD` | P12 password |
| `IOS_PROVISIONING_PROFILE` | Base64 of the App Store distribution provisioning profile for `com.magnexis.maps`, matching that certificate/team |
| `ASC_API_KEY_ID` | App Store Connect API key ID |
| `ASC_API_ISSUER_ID` | API issuer ID |
| `ASC_API_KEY_P8` | Complete P8 API key contents; use a role that permits build upload |

Having an active App Store Connect app does not supply a distribution private key or API key. An Apple account owner must authorize access to these assets. A certificate downloaded from Apple without its private key cannot sign a build. Do not revoke existing certificates just to configure CI.

The signing script validates bundle/team, expiry and App Store profile type, installs the certificate into a temporary keychain, creates export options, and removes temporary credentials in an `always()` cleanup step. The signing job receives secrets only for a manual `testflight` dispatch using the protected environment. Pull requests never receive them. No signing material is uploaded as a workflow artifact.

## TestFlight and App Review

After simulator validation passes and signing settings are configured, dispatch the workflow with **testflight**. It builds a Release archive, exports a signed IPA, validates it with Apple's tooling and uploads it to App Store Connect. Each upload uses the workflow run number as its build number; ensure that number exceeds any previously uploaded build number, or increase the project/upload numbering before dispatch.

An uploaded build must finish Apple processing before TestFlight or App Review can use it. Upload is separate from App Review submission. Complete the real-device checklist, final privacy disclosures, screenshots, age rating, content rights, production service checks and review metadata in `iphone-app-store.md` before selecting and submitting the build. App Review approval is never implied by a successful workflow.

References: [GitHub macOS runner images](https://github.com/actions/runner-images), [Apple certificates in GitHub Actions](https://docs.github.com/en/actions/how-tos/security-for-github-actions/security-guides/installing-an-apple-certificate-on-macos-runners-for-xcode-development).
