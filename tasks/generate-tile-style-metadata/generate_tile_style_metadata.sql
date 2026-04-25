WITH current_stats AS (
    SELECT
        'current_assessed_value' AS field,
        MIN(current_assessed_value) AS min_value,
        MAX(current_assessed_value) AS max_value,
        COUNT(current_assessed_value) AS value_count,
        APPROX_QUANTILES(current_assessed_value, 5) AS quantiles
    FROM `derived.property_tile_info`
    WHERE current_assessed_value IS NOT NULL
),

tax_year_stats AS (
    SELECT
        'tax_year_assessed_value' AS field,
        MIN(tax_year_assessed_value) AS min_value,
        MAX(tax_year_assessed_value) AS max_value,
        COUNT(tax_year_assessed_value) AS value_count,
        APPROX_QUANTILES(tax_year_assessed_value, 5) AS quantiles
    FROM `derived.property_tile_info`
    WHERE tax_year_assessed_value IS NOT NULL
)

SELECT * FROM current_stats
UNION ALL
SELECT * FROM tax_year_stats;
