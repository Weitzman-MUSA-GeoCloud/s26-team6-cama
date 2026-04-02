import os
from google.cloud import bigquery
import functions_framework


@functions_framework.http
def load_opa_assessments(request):
    """
    HTTP-triggered Cloud Function: execute SQL scripts to load OPA assessment
    history data into BigQuery source and core datasets.
    """
    client = bigquery.Client()
    dir_path = os.path.dirname(os.path.realpath(__file__))

    try:
        source_sql_path = os.path.join(dir_path, 'source_phl_opa_assessments.sql')
        with open(source_sql_path, 'r') as file:
            source_sql = file.read()

        print("Executing source_phl_opa_assessments.sql...")
        source_job = client.query(source_sql)
        source_job.result()
        print("External table source.opa_assessments created successfully.")

        core_sql_path = os.path.join(dir_path, 'core_phl_opa_assessments.sql')
        with open(core_sql_path, 'r') as file:
            core_sql = file.read()

        print("Executing core_phl_opa_assessments.sql...")
        core_job = client.query(core_sql)
        core_job.result()
        print("Core table core.opa_assessments created successfully.")

        return "Successfully loaded OPA assessments into source and core datasets.", 200

    except Exception as e:
        print(f"Error executing SQL: {e}")
        return f"Error executing BigQuery SQL: {e}", 500
