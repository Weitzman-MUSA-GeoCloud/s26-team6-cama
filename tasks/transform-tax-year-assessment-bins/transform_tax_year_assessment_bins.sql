CREATE OR REPLACE TABLE `derived.tax_year_assessment_bins` AS (
    WITH bins AS (
        SELECT
            year,
            FLOOR(market_value / 50000) * 50000 AS lower_bound,
            FLOOR(market_value / 50000) * 50000 + 50000 AS upper_bound
        FROM `core.opa_assessments`
        WHERE
            market_value IS NOT NULL
            AND market_value >= 0
    )

    SELECT
        year,
        CAST(lower_bound AS INT64) AS lower_bound,
        CAST(upper_bound AS INT64) AS upper_bound,
        COUNT(*) AS property_count
    FROM bins
    GROUP BY
        year,
        lower_bound,
        upper_bound
    ORDER BY
        year,
        lower_bound
);
