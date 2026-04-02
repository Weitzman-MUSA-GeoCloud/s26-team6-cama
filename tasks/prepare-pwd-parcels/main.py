import csv
import json
import functions_framework
from google.cloud import storage


@functions_framework.http
def prepare_pwd_parcels(request):
    """
    HTTP-triggered Cloud Function: read raw PWD parcels CSV from GCS row-by-row,
    normalize column names to lowercase, and write as JSONL to prepared_data bucket.
    The geometry column is already a GeoJSON string from the extract step.
    """
    raw_bucket_name = "musa5090s26-team6-raw_data"
    raw_blob_name = "pwd_parcels/raw.csv"
    prepared_bucket_name = "musa5090s26-team6-prepared_data"
    prepared_blob_name = "pwd_parcels/data.jsonl"

    storage_client = storage.Client()
    raw_blob = storage_client.bucket(raw_bucket_name).blob(raw_blob_name)
    prepared_blob = storage_client.bucket(prepared_bucket_name).blob(prepared_blob_name)

    print(f"Reading gs://{raw_bucket_name}/{raw_blob_name}...")

    count = 0
    with raw_blob.open('r') as raw_file, prepared_blob.open('w') as prepared_file:
        reader = csv.DictReader(raw_file)
        for row in reader:
            record = {k.lower(): v for k, v in row.items()}
            prepared_file.write(json.dumps(record) + '\n')
            count += 1

    print(f"Saved {count} records to gs://{prepared_bucket_name}/{prepared_blob_name}")
    return f"Success: {count} parcels prepared and saved.", 200
