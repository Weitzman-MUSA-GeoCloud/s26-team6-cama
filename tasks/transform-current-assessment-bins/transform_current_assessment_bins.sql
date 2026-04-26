CREATE OR REPLACE TABLE `derived.current_assessment_bins` AS (
    -- Note: derived.current_assessments uses `predicted_value` (FLOAT64) as
    -- the model output column, per the schema set by #12. If the model job
    -- writes multiple prediction rows per property over time, take the
    -- latest one per property before binning.
    WITH latest_predictions AS (
        SELECT
            property_id,
            predicted_value
        FROM (
            SELECT
                property_id,
                predicted_value,
                ROW_NUMBER() OVER (
                    PARTITION BY property_id ORDER BY predicted_at DESC
                ) AS rn
            FROM `derived.current_assessments`
            WHERE
                predicted_value IS NOT NULL
                AND predicted_value >= 0
        )
        WHERE rn = 1
    ),

    bins AS (
        SELECT
            FLOOR(predicted_value / 50000) * 50000 AS lower_bound,
            FLOOR(predicted_value / 50000) * 50000 + 50000 AS upper_bound
        FROM latest_predictions
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
