import requests
from google.cloud import storage
import functions_framework

BATCH_SIZE = 50_000
TABLE = "pwd_parcels"
# Select all property fields plus geometry as GeoJSON string
SELECT = (
    "objectid, parcelid, tencode, address, owner1, owner2, "
    "bldg_code, bldg_desc, brt_id, num_brt, num_accounts, gross_area, pin, parcel_id, "
    "ST_AsGeoJSON(the_geom) AS geometry"
)


@functions_framework.http
def extract_pwd_parcels(request):
    """
    HTTP-triggered Cloud Function: download PWD parcels from the Philadelphia
    CARTO API in paginated batches (with geometry as GeoJSON string) and stream
    directly to GCS as CSV.
    """
    bucket_name = "musa5090s26-team6-raw_data"
    destination_blob_name = "pwd_parcels/raw.csv"

    storage_client = storage.Client()
    blob = storage_client.bucket(bucket_name).blob(destination_blob_name)

    offset = 0
    total_rows = 0

    with blob.open('w') as gcs_file:
        while True:
            print(f"Fetching rows {offset}–{offset + BATCH_SIZE}...")
            response = requests.get(
                "https://phl.carto.com/api/v2/sql",
                params={
                    'format': 'csv',
                    'q': f"SELECT {SELECT} FROM {TABLE} LIMIT {BATCH_SIZE} OFFSET {offset}",
                },
                timeout=120,
            )
            response.raise_for_status()

            content = response.text.strip()
            if not content:
                break

            lines = content.split('\n')

            if offset == 0:
                gcs_file.write(content + '\n')
                data_rows = len(lines) - 1
            else:
                data_lines = [l for l in lines[1:] if l.strip()]
                if not data_lines:
                    break
                gcs_file.write('\n'.join(data_lines) + '\n')
                data_rows = len(data_lines)

            total_rows += data_rows
            print(f"Total rows downloaded: {total_rows}")

            if data_rows < BATCH_SIZE:
                break

            offset += BATCH_SIZE

    return f"Success: {total_rows} parcels extracted to gs://{bucket_name}/{destination_blob_name}", 200
