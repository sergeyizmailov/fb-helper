#!/usr/bin/env bash
# Chrome Web Store build. The repo's extension (fb-helper/) stays "FB Helper" with the original logo; the store
# package is "Ads Helper" with the neutral logo (Meta's brand rules and the store's impersonation policy forbid
# "FB"/"Facebook" in the name and the Facebook "f" in the icon).
# Output (git-ignored): chrome-web-store/release/unpacked/ (the exact ZIP contents) and
# chrome-web-store/release/ads-helper-<version>.zip
set -euo pipefail
cd "$(dirname "$0")/.."

SRC=fb-helper
NAME="Ads Helper"
VERSION=$(python3 -c 'import json;print(json.load(open("fb-helper/manifest.json"))["version"])')
OUT=chrome-web-store/release/unpacked
ZIP="$PWD/chrome-web-store/release/ads-helper-$VERSION.zip"

rm -rf chrome-web-store/release
mkdir -p "$OUT"
cp -R "$SRC"/manifest.json "$SRC"/popup.html "$SRC"/css "$SRC"/js "$SRC"/fonts "$SRC"/images LICENSE "$OUT/"
find "$OUT" -name '.DS_Store' -delete

# store icons and header logo
I=chrome-web-store/icons
cp "$I"/icon_128.png "$I"/icon_48.png "$I"/toolbar_32.png "$I"/toolbar_16.png "$I"/logo.webp "$OUT/images/"

# name: manifest (name, toolbar tooltip), popup title and header, comment in popup.js
perl -pi -e 's/"name": "FB Helper"/"name": "'"$NAME"'"/; s/"default_title": "FB Helper"/"default_title": "'"$NAME"'"/' "$OUT/manifest.json"
perl -pi -e 's/<title>FB Helper<\/title>/<title>'"$NAME"'<\/title>/; s/>FB Helper<\/div>/>'"$NAME"'<\/div>/' "$OUT/popup.html"
perl -pi -e 's/^\/\/ FB Helper/\/\/ '"$NAME"'/ if $. == 1' "$OUT/js/popup.js"

if grep -rIn -i 'fb helper' "$OUT"; then echo "old name left in the package" >&2; exit 1; fi

( cd "$OUT" && zip -qrX "$ZIP" . -x '*.DS_Store' )
echo "built $ZIP ($(unzip -l "$ZIP" | tail -1 | awk '{print $2}') files)"
