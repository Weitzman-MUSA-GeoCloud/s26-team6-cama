import os
import functions_framework
from google.cloud import bigquery


@functions_framework.http
def transform_current_assessments_model_training_data(request):
    """
    HTTP-triggered Cloud Function: builds derived.current_assessments_model_training_data
    in BigQuery by selecting and filtering property features and sale prices
    from core.opa_properties for model training.
    """
    bq = bigquery.Client()
    dir_path = os.path.dirname(os.path.realpath(__file__))

    sql_path = os.path.join(
        dir_path,
        'transform_current_assessments_model_training_data.sql',
    )
    with open(sql_path) as f:
        sql = f.read()

    print("Creating derived.current_assessments_model_training_data...")
    bq.query(sql).result()
    print("derived.current_assessments_model_training_data created.")

    return "Success", 200
