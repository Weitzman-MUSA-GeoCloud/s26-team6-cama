import json
import os
import decimal
import datetime
import functions_framework
from google.cloud import bigquery, storage


BUCKET_NAME = "musa5090s26-team6-public"
OUTPUT_PATH = "configs/tile_style_metadata.json"


def _to_float(value):
    if value is None:
        return None
    if isinstance(value, decimal.Decimal):
        return float(value)
    return value


@functions_framework.http
def generate_tile_style_metadata(request):
    """
    HTTP-triggered Cloud Function: computes min/max/quintile breakpoints for
    each field rendered on the property vector tiles, and uploads a JSON
    metadata file to the public bucket for front-end map styling.
    """
    bq = bigquery.Client()
    gcs = storage.Client()
    dir_path = os.path.dirname(os.path.realpath(__file__))

    sql_path = os.path.join(dir_path, 'generate_tile_style_metadata.sql')
    with open(sql_path) as f:
        sql = f.read()

    print("Querying tile style stats from derived.property_tile_info...")
    rows = bq.query(sql).result()

    layers = {}
    for row in rows:
        quantiles = [_to_float(q) for q in row.quantiles]
        # APPROX_QUANTILES(x, 5) returns 6 values (0%, 20%, 40%, 60%, 80%, 100%)
        # min/max are reported separately; expose only the 4 internal breaks.
        breakpoints = quantiles[1:-1] if len(quantiles) >= 2 else []
        layers[row.field] = {
            "min": _to_float(row.min_value),
            "max": _to_float(row.max_value),
            "count": int(row.value_count),
            "breakpoints": breakpoints,
        }

    output = {
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "source": "derived.property_tile_info",
        "layers": layers,
    }

    print(f"Uploading metadata to gs://{BUCKET_NAME}/{OUTPUT_PATH}...")
    bucket = gcs.bucket(BUCKET_NAME)
    blob = bucket.blob(OUTPUT_PATH)
    blob.upload_from_string(
        data=json.dumps(output, indent=2),
        content_type="application/json",
    )

    print("Done.")
    return {
        "status": "success",
        "layers": list(layers.keys()),
        "file": f"gs://{BUCKET_NAME}/{OUTPUT_PATH}",
    }
