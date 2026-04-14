CREATE OR REPLACE TABLE `derived.current_assessment_bins` AS (
    WITH bins AS (
        SELECT
            FLOOR(assessed_value / 50000) * 50000 AS lower_bound,
            FLOOR(assessed_value / 50000) * 50000 + 50000 AS upper_bound
        FROM `derived.current_assessments`
        WHERE
            assessed_value IS NOT NULL
            AND assessed_value >= 0
    )

    SELECT
        CAST(lower_bound AS INT64) AS lower_bound,
        CAST(upper_bound AS INT64) AS upper_bound,
        COUNT(*) AS property_count
    FROM bins
    GROUP BY
        lower_bound,
        upper_bound
    ORDER BY
        lower_bound
);
