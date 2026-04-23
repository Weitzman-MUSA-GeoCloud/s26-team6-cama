#!/usr/bin/env bash
set -euo pipefail

TEMP_BUCKET="musa5090s26-team6-temp_data"
PUBLIC_BUCKET="musa5090s26-team6-public"
GEOJSON_PATH="/tmp/property_tile_info.geojson"
TILES_DIR="/tmp/tiles"

echo "Step 1: Downloading property_tile_info.geojson from GCS..."
gcloud storage cp "gs://${TEMP_BUCKET}/property_tile_info.geojson" "${GEOJSON_PATH}"

echo "Step 2: Converting to Mapbox Vector Tiles (zoom 12-18)..."
rm -rf "${TILES_DIR}"
ogr2ogr \
  -f MVT "${TILES_DIR}" \
  "${GEOJSON_PATH}" \
  -dsco MINZOOM=12 \
  -dsco MAXZOOM=18 \
  -dsco COMPRESS=NO

echo "Step 3: Uploading tiles to public GCS bucket..."
gcloud storage cp -r "${TILES_DIR}/*" "gs://${PUBLIC_BUCKET}/tiles/"

echo "Done. Tiles uploaded to gs://${PUBLIC_BUCKET}/tiles/"
