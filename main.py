import json
from google.cloud import bigquery
from google.cloud import storage

def generate_assessment_chart_configs(request):
    bq_client = bigquery.Client()
    storage_client = storage.Client()


    query = """
        SELECT
            tax_year,
            lower_bound,
            upper_bound,
            property_count
        FROM `musa5090s26-team6.derived.tax_year_assessment_bins`
        ORDER BY tax_year, lower_bound
    """

    results = bq_client.query(query).result()

    # Format results
    output = []
    for row in results:
        output.append({
            "tax_year": row["tax_year"],
            "lower_bound": float(row["lower_bound"]) if row["lower_bound"] is not None else None,
            "upper_bound": float(row["upper_bound"]) if row["upper_bound"] is not None else None,
            "property_count": int(row["property_count"]) if row["property_count"] is not None else 0
        })

    # Convert to JSON
    json_data = json.dumps(output)

   
    bucket = storage_client.bucket("musa5090s26-team6-public")
    blob = bucket.blob("configs/current_assessment_bins.json")

    blob.upload_from_string(json_data, content_type="application/json")

    return {
        "status": "success",
        "records": len(output)
    }