#!/bin/bash
# Gets the VPEX content studio ready in a fresh session:
#   1. unpacks the app footage (ig3/clips/*.mp4) into the frame folders the Reel builder reads
#   2. serves the live app (the repo's index.html) at http://localhost:8793/ for new screenshots and recordings
# usage: bash studio/tools/setup.sh   (from the repo root)
set -e
STUDIO="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$STUDIO/.." && pwd)"
pip install -q --break-system-packages playwright numpy pillow >/dev/null 2>&1 || true
cd "$STUDIO/ig3/clips"
for v in *.mp4; do
  n="${v%.mp4}"
  if [ ! -f "$n/meta.json" ]; then
    rm -rf "$n"; mkdir -p "$n"
    ffmpeg -loglevel error -y -i "$v" -q:v 2 -start_number 0 "$n/f%04d.jpg"
    cp "$n.json" "$n/meta.json"
    echo "footage: $n ($(ls "$n" | grep -c '^f') frames)"
  fi
done
SITE=/tmp/vpex-site
rm -rf "$SITE"; mkdir -p "$SITE"
for f in "$REPO"/*.html "$REPO"/*.png "$REPO"/*.jpg "$REPO"/*.webmanifest "$REPO"/*.js; do [ -e "$f" ] && ln -sf "$f" "$SITE/"; done
ln -sf "$STUDIO/deck/fonts" "$SITE/__fonts"
if ! curl -s -o /dev/null http://localhost:8793/; then (cd "$SITE" && nohup python3 -m http.server 8793 >/dev/null 2>&1 &); sleep 1; fi
echo "app served at http://localhost:8793/ ($(curl -s -o /dev/null -w '%{http_code}' http://localhost:8793/))"
