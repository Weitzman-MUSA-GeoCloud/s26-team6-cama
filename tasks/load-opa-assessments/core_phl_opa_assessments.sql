CREATE OR REPLACE TABLE `core.opa_assessments` AS (
    SELECT
        parcel_number AS property_id,
        parcel_number,

        SAFE_CAST(year AS INT64) AS year,

        SAFE_CAST(market_value     AS NUMERIC) AS market_value,
        SAFE_CAST(taxable_land     AS NUMERIC) AS taxable_land,
        SAFE_CAST(taxable_building AS NUMERIC) AS taxable_building,
        SAFE_CAST(exempt_land      AS NUMERIC) AS exempt_land,
        SAFE_CAST(exempt_building  AS NUMERIC) AS exempt_building,

        * EXCEPT (
            parcel_number,
            year,
            market_value,
            taxable_land,
            taxable_building,
            exempt_land,
            exempt_building
        )
    FROM `source.opa_assessments`
);
