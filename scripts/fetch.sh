#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/raw
curl -sf --http1.1 --retry 3 -G -A 'bubbletea-locator/0.1' --max-time 200 --data-urlencode data@scripts/overpass.q \
  https://overpass-api.de/api/interpreter -o data/raw/osm.json
curl -sf -A 'Mozilla/5.0' --max-time 30 \
  'https://usa.mollytea.com/wp-admin/admin-ajax.php?action=asl_load_stores&load_all=1&layout=1' -o data/raw/molly.json
RELEASE=2026-10-21.0
BUCKET=https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com
PREFIX=release/$RELEASE/theme=places/type=place/
mkdir -p data/raw/overture
curl -sf "$BUCKET/?list-type=2&prefix=$PREFIX" | grep -oE '<Key>[^<]+</Key>' | sed 's/<[^>]*>//g' |
  xargs -P 6 -I{} sh -c 'f=data/raw/overture/$(basename "$1"); curl -sf --retry 5 -o "$f" "$0/$1"' "$BUCKET" {}
duckdb -c ".read scripts/overture.sql"
