import os
from google.cloud import bigquery
import functions_framework


@functions_framework.http
def load_opa_properties(request):
    """
    HTTP-triggered Cloud Function that executes SQL scripts
    to load OPA data into BigQuery.
    """
    # Initialize BigQuery client
    client = bigquery.Client()

    # Get the directory of the current Python file
    # to reliably locate SQL files in the same directory
    dir_path = os.path.dirname(os.path.realpath(__file__))

    try:
        # ==========================================
        # 1. Execute SQL to create external table (Source)
        # ==========================================
        source_sql_path = os.path.join(dir_path, 'source_phl_opa_properties.sql')
        with open(source_sql_path, 'r') as file:
            source_sql = file.read()

        print("Running source_phl_opa_properties.sql...")
        source_job = client.query(source_sql)
        source_job.result()  # Block until job completes
        print("External table source.opa_properties created successfully.")

        # ==========================================
        # 2. Execute SQL to create internal table (Core)
        # ==========================================
        core_sql_path = os.path.join(dir_path, 'core_phl_opa_properties.sql')
        with open(core_sql_path, 'r') as file:
            core_sql = file.read()

        print("Running core_phl_opa_properties.sql...")
        core_job = client.query(core_sql)
        core_job.result()  # Block until job completes
        print("Internal table core.opa_properties created successfully.")

        return "Successfully loaded OPA properties into source and core datasets.", 200

    except Exception as e:
        print(f"Error occurred while executing SQL: {e}")
        return f"Error executing BigQuery SQL: {e}", 500

