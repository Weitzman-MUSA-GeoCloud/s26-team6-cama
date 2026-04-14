import os
import functions_framework
from google.cloud import bigquery


@functions_framework.http
def transform_tax_year_assessment_bins(request):
    """
    HTTP-triggered Cloud Function: builds derived.tax_year_assessment_bins
    in BigQuery by binning historical assessment values by tax year.
    """
    bq = bigquery.Client()
    dir_path = os.path.dirname(os.path.realpath(__file__))

    sql_path = os.path.join(
        dir_path,
        'transform_tax_year_assessment_bins.sql',
    )
    with open(sql_path) as f:
        sql = f.read()

    print("Creating derived.tax_year_assessment_bins...")
    bq.query(sql).result()
    print("derived.tax_year_assessment_bins created.")

    return "Success", 200
