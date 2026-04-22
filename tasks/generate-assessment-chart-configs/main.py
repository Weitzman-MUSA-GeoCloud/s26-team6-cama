import json
from google.cloud import bigquery
from google.cloud import storage

PROJECT_ID = "musa5090s26-team6"
SQL_FILE = "generate-assessment-chart-configs.sql"

BUCKET_NAME = "musa5090s26-team6-public"
OUTPUT_PATH = "configs/current_assessment_bins.json"


def generate_assessment_chart_configs(request):
    # BigQuery client
    bq = bigquery.Client(project=PROJECT_ID)

    # Load SQL
    with open(SQL_FILE, "r") as f:
        query = f.read()

    # Run query
    results = bq.query(query).result()

    # Format JSON output
    output = [
        {
            "tax_year": row["tax_year"],
            "lower_bound": row["lower_bound"],
            "upper_bound": row["upper_bound"],
            "property_count": row["property_count"],
        }
        for row in results
    ]

    # Write to GCS
    storage_client = storage.Client()
    bucket = storage_client.bucket(BUCKET_NAME)
    blob = bucket.blob(OUTPUT_PATH)

    blob.upload_from_string(
        data=json.dumps(output),
        content_type="application/json"
    )

    return {
        "status": "success",
        "rows_written": len(output),
        "file": f"gs://{BUCKET_NAME}/{OUTPUT_PATH}"
    }