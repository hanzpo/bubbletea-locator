#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/raw
curl -sf --http1.1 --retry 3 -G -A 'bubbletea-locator/0.1' --max-time 200 --data-urlencode data@scripts/overpass.q \
  https://overpass-api.de/api/interpreter -o data/raw/osm.json
curl -sf -A 'Mozilla/5.0' --max-time 30 \
  'https://usa.mollytea.com/wp-admin/admin-ajax.php?action=asl_load_stores&load_all=1&layout=1' -o data/raw/molly.json
duckdb -c ".read scripts/overture.sql"
