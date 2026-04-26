import json
import functions_framework
from google.cloud import bigquery, storage


@functions_framework.http
def export_assessment_chart_configs(request):
    bq = bigquery.Client()
    gcs = storage.Client()
    bucket = gcs.bucket('musa5090s26-team6-public')

    tax_year_sql = """
        SELECT tax_year, lower_bound, upper_bound, property_count
        FROM `musa5090s26-team6.derived.tax_year_assessment_bins`
        ORDER BY tax_year, lower_bound
    """
    rows = list(bq.query(tax_year_sql).result())
    tax_year_data = [
        {
            'tax_year': str(r['tax_year']),
            'lower_bound': r['lower_bound'],
            'upper_bound': r['upper_bound'],
            'property_count': r['property_count'],
        }
        for r in rows
    ]
    bucket.blob('configs/tax_year_assessment_bins.json').upload_from_string(
        json.dumps(tax_year_data),
        content_type='application/json',
    )
    print(f"Exported {len(tax_year_data)} tax_year_assessment_bins rows.")

    current_sql = """
        SELECT tax_year, lower_bound, upper_bound, property_count
        FROM `musa5090s26-team6.derived.current_assessment_bins`
        ORDER BY tax_year, lower_bound
    """
    rows = list(bq.query(current_sql).result())
    current_data = [
        {
            'tax_year': str(r['tax_year']),
            'lower_bound': r['lower_bound'],
            'upper_bound': r['upper_bound'],
            'property_count': r['property_count'],
        }
        for r in rows
    ]
    bucket.blob('configs/current_assessment_bins.json').upload_from_string(
        json.dumps(current_data),
        content_type='application/json',
    )
    print(f"Exported {len(current_data)} current_assessment_bins rows.")

    return 'Success', 200
