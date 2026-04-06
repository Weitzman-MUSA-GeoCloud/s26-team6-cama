import os
from google.cloud import bigquery
import functions_framework


@functions_framework.http
def load_pwd_parcels(request):
    """
    HTTP-triggered Cloud Function: execute SQL scripts to load PWD parcels
    data into BigQuery source and core datasets.
    """
    client = bigquery.Client()
    dir_path = os.path.dirname(os.path.realpath(__file__))

    try:
        source_sql_path = os.path.join(dir_path, 'source_phl_pwd_parcels.sql')
        with open(source_sql_path, 'r') as file:
            source_sql = file.read()

        print("Executing source_phl_pwd_parcels.sql...")
        source_job = client.query(source_sql)
        source_job.result()
        print("External table source.pwd_parcels created successfully.")

        core_sql_path = os.path.join(dir_path, 'core_phl_pwd_parcels.sql')
        with open(core_sql_path, 'r') as file:
            core_sql = file.read()

        print("Executing core_phl_pwd_parcels.sql...")
        core_job = client.query(core_sql)
        core_job.result()
        print("Core table core.pwd_parcels created successfully.")

        return "Successfully loaded PWD parcels into source and core datasets.", 200

    except Exception as e:
        print(f"Error executing SQL: {e}")
        return f"Error executing BigQuery SQL: {e}", 500
