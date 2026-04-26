-- All numeric columns are CAST to NUMERIC so the two CTEs UNION ALL with
-- compatible types. Without the cast, BigQuery infers ARRAY<INT64> for the
-- all-NULL `current_assessed_value` column and ARRAY<NUMERIC> for the real
-- `tax_year_assessed_value`, which fails with a 400 type-mismatch error.

WITH current_stats AS (
    SELECT
        'current_assessed_value' AS field,
        CAST(MIN(current_assessed_value) AS NUMERIC) AS min_value,
        CAST(MAX(current_assessed_value) AS NUMERIC) AS max_value,
        COUNT(current_assessed_value) AS value_count,
        APPROX_QUANTILES(CAST(current_assessed_value AS NUMERIC), 5) AS quantiles
    FROM `derived.property_tile_info`
    WHERE current_assessed_value IS NOT NULL
),

tax_year_stats AS (
    SELECT
        'tax_year_assessed_value' AS field,
        CAST(MIN(tax_year_assessed_value) AS NUMERIC) AS min_value,
        CAST(MAX(tax_year_assessed_value) AS NUMERIC) AS max_value,
        COUNT(tax_year_assessed_value) AS value_count,
        APPROX_QUANTILES(CAST(tax_year_assessed_value AS NUMERIC), 5) AS quantiles
    FROM `derived.property_tile_info`
    WHERE tax_year_assessed_value IS NOT NULL
)

SELECT * FROM current_stats
UNION ALL
SELECT * FROM tax_year_stats;
