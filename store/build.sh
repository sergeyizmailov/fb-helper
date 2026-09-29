#!/usr/bin/env bash
# Chrome Web Store build. The repo stays "FB Helper" with the original logo; the store package is
# "Ads Helper" with the neutral logo (Meta's brand rules and the store's impersonation policy forbid
# "FB"/"Facebook" in the name and the Facebook "f" in the icon).
# Output: release/chrome-web-store/ (the exact ZIP contents) and release/ads-helper-<version>.zip
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="Ads Helper"
VERSION=$(python3 -c 'import json;print(json.load(open("manifest.json"))["version"])')
OUT=release/chrome-web-store
ZIP="release/ads-helper-$VERSION.zip"

rm -rf "$OUT" "$ZIP"
mkdir -p "$OUT"
cp -R manifest.json popup.html css js fonts images LICENSE "$OUT/"
find "$OUT" -name '.DS_Store' -delete

# store icons and header logo
cp store/icons/icon_128.png store/icons/icon_48.png store/icons/toolbar_32.png store/icons/toolbar_16.png store/icons/logo.webp "$OUT/images/"

# name: manifest (name, toolbar tooltip), popup title and header, comment in popup.js
perl -pi -e 's/"name": "FB Helper"/"name": "'"$NAME"'"/; s/"default_title": "FB Helper"/"default_title": "'"$NAME"'"/' "$OUT/manifest.json"
perl -pi -e 's/<title>FB Helper<\/title>/<title>'"$NAME"'<\/title>/; s/>FB Helper<\/div>/>'"$NAME"'<\/div>/' "$OUT/popup.html"
perl -pi -e 's/^\/\/ FB Helper/\/\/ '"$NAME"'/ if $. == 1' "$OUT/js/popup.js"

if grep -rIn -i 'fb helper' "$OUT"; then echo "old name left in the package" >&2; exit 1; fi

( cd "$OUT" && zip -qrX "../../$ZIP" . -x '*.DS_Store' )
echo "built $ZIP ($(unzip -l "$ZIP" | tail -1 | awk '{print $2}') files)"
