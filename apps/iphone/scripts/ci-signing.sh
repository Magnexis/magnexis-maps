#!/usr/bin/env bash
set -euo pipefail
# Credentials are read only from the protected GitHub environment; never echo them.
KEYCHAIN="$RUNNER_TEMP/maps-signing.keychain-db"
PROFILE="$RUNNER_TEMP/maps.mobileprovision"
CERTIFICATE="$RUNNER_TEMP/maps-signing.p12"
API_FOLDER="$HOME/.appstoreconnect/private_keys"
if [ "${1:-}" = cleanup ]; then
  security delete-keychain "$KEYCHAIN" >/dev/null 2>&1 || true
  rm -f "$PROFILE" "$CERTIFICATE" "$RUNNER_TEMP/maps-profile.plist" "$RUNNER_TEMP/ExportOptions.plist"
  if [ -n "${MAPS_PROFILE_UUID:-}" ]; then rm -f "$HOME/Library/MobileDevice/Provisioning Profiles/$MAPS_PROFILE_UUID.mobileprovision"; fi
  if [ -n "${ASC_API_KEY_ID:-}" ]; then rm -f "$API_FOLDER/AuthKey_$ASC_API_KEY_ID.p8"; fi
  exit 0
fi
test "${1:-}" = install
umask 077
printf '%s' "$IOS_CERTIFICATE_P12" | base64 --decode > "$CERTIFICATE"
printf '%s' "$IOS_PROVISIONING_PROFILE" | base64 --decode > "$PROFILE"
security cms -D -i "$PROFILE" > "$RUNNER_TEMP/maps-profile.plist"
python3 - <<'PY'
import os, plistlib, datetime
from pathlib import Path
root = Path(os.environ['RUNNER_TEMP'])
with (root/'maps-profile.plist').open('rb') as f: p = plistlib.load(f)
team = os.environ['IOS_TEAM_ID']
if p['Entitlements'].get('application-identifier') != team + '.com.magnexis.maps': raise SystemExit('Profile must match com.magnexis.maps and IOS_TEAM_ID')
if p['ExpirationDate'] <= datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None): raise SystemExit('Signing profile expired')
if p.get('ProvisionedDevices') or p.get('ProvisionsAllDevices'): raise SystemExit('Use an App Store distribution profile')
if p['Entitlements'].get('get-task-allow'): raise SystemExit('Development profiles cannot be uploaded')
for value in [p['UUID'],p['Name']]:
    if '\n' in value or '\r' in value: raise SystemExit('Invalid profile metadata')
with open(os.environ['GITHUB_ENV'],'a') as f:
    f.write('MAPS_PROFILE_UUID='+p['UUID']+'\nMAPS_PROFILE_NAME='+p['Name']+'\n')
dest = Path.home()/'Library/MobileDevice/Provisioning Profiles'
dest.mkdir(parents=True, exist_ok=True)
(dest/(p['UUID']+'.mobileprovision')).write_bytes((root/'maps.mobileprovision').read_bytes())
with (root/'ExportOptions.plist').open('wb') as f:
    plistlib.dump({'method':'app-store-connect','teamID':team,'signingStyle':'manual','provisioningProfiles':{'com.magnexis.maps':p['Name']},'uploadSymbols':True},f)
PY
PASSWORD=$(openssl rand -hex 32)
security create-keychain -p "$PASSWORD" "$KEYCHAIN"
security set-keychain-settings -lut 21600 "$KEYCHAIN"
security unlock-keychain -p "$PASSWORD" "$KEYCHAIN"
security import "$CERTIFICATE" -P "$IOS_CERTIFICATE_PASSWORD" -A -t cert -f pkcs12 -k "$KEYCHAIN" >/dev/null
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$PASSWORD" "$KEYCHAIN" >/dev/null
security list-keychains -d user -s "$KEYCHAIN" "$HOME/Library/Keychains/login.keychain-db"
mkdir -p "$API_FOLDER"
printf '%s' "$ASC_API_KEY_P8" > "$API_FOLDER/AuthKey_$ASC_API_KEY_ID.p8"
