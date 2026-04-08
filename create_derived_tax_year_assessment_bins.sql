CREATE OR REPLACE TABLE `musa5090s26-team6.derived.tax_year_assessment_bins` AS
WITH base AS (
    SELECT
        year,
        SAFE_CAST(market_value AS FLOAT64) AS market_value
    FROM `musa5090s26-team6.source.opa_assessments`
    WHERE market_value IS NOT NULL
),

bounds AS (
    SELECT
        year,
        MIN(market_value) AS min_val,
        MAX(market_value) AS max_val
    FROM base
    GROUP BY year
),

binned AS (
    SELECT
        b.year,
        FLOOR((a.market_value - b.min_val) / 100000) * 100000 AS lower_bound,
        FLOOR((a.market_value - b.min_val) / 100000) * 100000 + 100000 AS upper_bound
    FROM base a
    JOIN bounds b
    ON a.year = b.year
)

SELECT
    year AS tax_year,
    lower_bound,
    upper_bound,
    COUNT(*) AS property_count
FROM binned
GROUP BY year, lower_bound, upper_bound
ORDER BY year, lower_bound;