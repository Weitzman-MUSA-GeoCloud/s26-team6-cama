CREATE OR REPLACE TABLE `derived.year_assessment_bins` AS (
    WITH bins AS (
        SELECT
            year,
            FLOOR(CAST(market_value AS FLOAT64) / 50000) * 50000 AS lower_bound,
            FLOOR(CAST(market_value AS FLOAT64) / 50000) * 50000 + 50000 AS upper_bound
        FROM `core.opa_assessments`
        WHERE
            market_value IS NOT NULL
            AND SAFE_CAST(market_value AS FLOAT64) >= 0
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
