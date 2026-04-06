import requests
from google.cloud import storage
import functions_framework


@functions_framework.http
def extract_opa_assessments(request):
    """
    HTTP-triggered Cloud Function: stream OPA assessment history CSV from S3
    directly to GCS without buffering in memory.
    """
    url = "https://opendata-downloads.s3.amazonaws.com/assessments.csv"
    bucket_name = "musa5090s26-team6-raw_data"
    destination_blob_name = "opa_assessments/raw.csv"

    storage_client = storage.Client()
    blob = storage_client.bucket(bucket_name).blob(destination_blob_name)

    print(f"Streaming data from {url}...")
    with requests.get(url, stream=True, timeout=480) as response:
        response.raise_for_status()
        blob.upload_from_file(response.raw, content_type='text/csv')

    print(f"Data saved to gs://{bucket_name}/{destination_blob_name}")
    return f"Success: Data extracted to gs://{bucket_name}/{destination_blob_name}", 200
