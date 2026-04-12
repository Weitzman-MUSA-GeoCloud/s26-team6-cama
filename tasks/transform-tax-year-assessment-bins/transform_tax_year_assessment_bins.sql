CREATE OR REPLACE TABLE `derived.tax_year_assessment_bins` AS (
    WITH bins AS (
        SELECT
            tax_year,
            FLOOR(assessed_value / 50000) * 50000 AS lower_bound,
            FLOOR(assessed_value / 50000) * 50000 + 50000 AS upper_bound
        FROM `core.opa_assessments`
        WHERE assessed_value IS NOT NULL
            AND assessed_value >= 0
    )

    SELECT
        tax_year,
        CAST(lower_bound AS INT64) AS lower_bound,
        CAST(upper_bound AS INT64) AS upper_bound,
        COUNT(*) AS property_count
    FROM bins
    GROUP BY
        tax_year,
        lower_bound,
        upper_bound
    ORDER BY
        tax_year,
        lower_bound
);
