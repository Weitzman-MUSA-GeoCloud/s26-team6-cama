import json
import functions_framework
from google.cloud import bigquery

PROJECT = 'musa5090s26-team6'
DATASET = 'core'

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
}


def _ok(data):
    return (json.dumps(data, default=str), 200, CORS_HEADERS)


def _err(msg, status=400):
    return (json.dumps({'error': msg}), status, CORS_HEADERS)


@functions_framework.http
def property_lookup(request):
    if request.method == 'OPTIONS':
        return ('', 204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET',
            'Access-Control-Allow-Headers': 'Content-Type',
        })

    bq = bigquery.Client(project=PROJECT)

    # ── Address search: ?search=1234+MARKET ──────────────
    search = request.args.get('search', '').strip().upper()
    if search:
        sql = f"""
            SELECT property_id, location, owner_1, market_value
            FROM `{PROJECT}.{DATASET}.opa_properties`
            WHERE UPPER(location) LIKE @prefix
              AND category_code IN ('1', '2', '8', '13', '14')
            ORDER BY location
            LIMIT 5
        """
        cfg = bigquery.QueryJobConfig(query_parameters=[
            bigquery.ScalarQueryParameter('prefix', 'STRING', search + '%'),
        ])
        rows = list(bq.query(sql, job_config=cfg).result())
        return _ok([dict(r) for r in rows])

    # ── Property + assessment history: ?parcel_number=xxx ─
    parcel = request.args.get('parcel_number', '').strip()
    if not parcel:
        return _err('Provide ?search= or ?parcel_number=')

    prop_sql = f"""
        SELECT
            property_id,
            location,
            owner_1,
            market_value,
            taxable_land,
            taxable_building,
            exempt_land,
            exempt_building,
            year_built,
            number_of_bedrooms,
            number_of_bathrooms,
            total_livable_area,
            category_code
        FROM `{PROJECT}.{DATASET}.opa_properties`
        WHERE property_id = @parcel
        LIMIT 1
    """
    assess_sql = f"""
        SELECT
            year,
            market_value,
            taxable_land,
            taxable_building,
            exempt_land,
            exempt_building
        FROM `{PROJECT}.{DATASET}.opa_assessments`
        WHERE property_id = @parcel
        ORDER BY year ASC
        LIMIT 50
    """
    cfg = bigquery.QueryJobConfig(query_parameters=[
        bigquery.ScalarQueryParameter('parcel', 'STRING', parcel),
    ])

    prop_rows = list(bq.query(prop_sql, job_config=cfg).result())
    if not prop_rows:
        return _err('Property not found', 404)

    assess_rows = list(bq.query(assess_sql, job_config=cfg).result())

    return _ok({
        'property': dict(prop_rows[0]),
        'assessments': [dict(r) for r in assess_rows],
    })
