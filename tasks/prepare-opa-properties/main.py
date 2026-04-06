import csv as py_csv
import pyarrow as pa
import pyarrow.csv as pa_csv
import pyarrow.parquet as pq
import gcsfs
import functions_framework


@functions_framework.http
def prepare_opa_properties(request):
    """
    HTTP-triggered Cloud Function: stream raw OPA properties CSV from GCS,
    normalize column names to lowercase, read all columns as strings to avoid
    mixed-type inference errors, and write as Parquet batch-by-batch.
    """
    raw_uri = "gs://musa5090s26-team6-raw_data/opa_properties/raw.csv"
    prepared_uri = "gs://musa5090s26-team6-prepared_data/opa_properties/data.parquet"

    fs = gcsfs.GCSFileSystem()

    # Read header line to get column names for type overrides
    with fs.open(raw_uri, 'rb') as f:
        header_line = f.readline().decode('utf-8')
    col_names = next(py_csv.reader([header_line]))
    col_names_lower = [c.lower() for c in col_names]

    read_options = pa_csv.ReadOptions(
        column_names=col_names_lower,
        skip_rows=1,
    )
    convert_options = pa_csv.ConvertOptions(
        column_types={name: pa.string() for name in col_names_lower},
        strings_can_be_null=True,
    )

    print(f"Streaming {raw_uri} with pyarrow ({len(col_names)} columns)...")

    total_rows = 0
    writer = None

    with fs.open(raw_uri, 'rb') as raw_file, fs.open(prepared_uri, 'wb') as prepared_file:
        reader = pa_csv.open_csv(raw_file, read_options=read_options,
                                 convert_options=convert_options)
        for batch in reader:
            if writer is None:
                writer = pq.ParquetWriter(prepared_file, batch.schema)
            writer.write_batch(batch)
            total_rows += batch.num_rows

        if writer:
            writer.close()

    print(f"Done. {total_rows} rows saved to {prepared_uri}")
    return f"Success: {total_rows} rows prepared and saved to {prepared_uri}", 200
