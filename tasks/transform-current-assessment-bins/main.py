import os
import functions_framework
from google.cloud import bigquery


@functions_framework.http
def transform_current_assessment_bins(request):
    """
    HTTP-triggered Cloud Function: builds derived.current_assessment_bins
    in BigQuery by binning current model-predicted assessment values.
    """
    bq = bigquery.Client()
    dir_path = os.path.dirname(os.path.realpath(__file__))

    sql_path = os.path.join(
        dir_path,
        'transform_current_assessment_bins.sql',
    )
    with open(sql_path) as f:
        sql = f.read()

    print("Creating derived.current_assessment_bins...")
    bq.query(sql).result()
    print("derived.current_assessment_bins created.")

    return "Success", 200
