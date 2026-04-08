import json
import os
import functions_framework
from google.cloud import bigquery, storage


@functions_framework.http
def export_property_tile_info(request):
    """
    HTTP-triggered Cloud Function: builds derived.property_tile_info in BigQuery,
    then streams the result as a GeoJSON FeatureCollection to GCS temp bucket.
    """
    bq = bigquery.Client()
    gcs = storage.Client()
    dir_path = os.path.dirname(os.path.realpath(__file__))

    # Step 1: Build derived.property_tile_info in BigQuery
    sql_path = os.path.join(dir_path, 'derived_property_tile_info.sql')
    with open(sql_path) as f:
        sql = f.read()
    print("Creating derived.property_tile_info...")
    bq.query(sql).result()
    print("derived.property_tile_info created.")

    # Step 2: Export to GeoJSON and stream to GCS
    export_sql = """
        SELECT
            property_id,
            address,
            ST_ASGEOJSON(geog) AS geom,
            current_assessed_value,
            tax_year_assessed_value
        FROM `derived.property_tile_info`
    """
    bucket = gcs.bucket("musa5090s26-team6-temp_data")
    blob = bucket.blob("property_tile_info.geojson")

    print("Exporting GeoJSON to GCS...")
    rows = bq.query(export_sql).result()
    with blob.open("w") as f:
        f.write('{"type":"FeatureCollection","features":[\n')
        first = True
        for row in rows:
            feature = {
                "type": "Feature",
                "geometry": json.loads(row.geom),
                "properties": {
                    "property_id": row.property_id,
                    "address": row.address,
                    "current_assessed_value": row.current_assessed_value,
                    "tax_year_assessed_value": row.tax_year_assessed_value,
                },
            }
            if not first:
                f.write(",\n")
            f.write(json.dumps(feature))
            first = False
        f.write("\n]}")

    print("Done. GeoJSON uploaded to gs://musa5090s26-team6-temp_data/property_tile_info.geojson")
    return "Success", 200
