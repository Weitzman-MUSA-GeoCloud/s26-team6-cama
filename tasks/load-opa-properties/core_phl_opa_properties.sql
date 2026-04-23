-- core.opa_properties
-- Materialize source.opa_properties with:
--   1. A standardized `property_id` derived from parcel_number.
--   2. Numeric / date / geography columns cast from STRING to their proper
--      BigQuery types using SAFE_CAST (dirty values -> NULL, never fail).
--   3. Descriptive text columns passed through as STRING via `* EXCEPT (...)`,
--      so the query does NOT break if OPA adds new columns upstream.
--   4. A derived `geog` GEOGRAPHY column so downstream tasks
--      (e.g. export-property-tile-info) don't have to rebuild points.

CREATE OR REPLACE TABLE `core.opa_properties` AS (
    SELECT
        -- Standardized identifier (used across core.* and derived.*)
        parcel_number AS property_id,
        parcel_number,

        -- Money / assessment values
        SAFE_CAST(market_value     AS NUMERIC) AS market_value,
        SAFE_CAST(sale_price       AS NUMERIC) AS sale_price,
        SAFE_CAST(taxable_land     AS NUMERIC) AS taxable_land,
        SAFE_CAST(taxable_building AS NUMERIC) AS taxable_building,
        SAFE_CAST(exempt_land      AS NUMERIC) AS exempt_land,
        SAFE_CAST(exempt_building  AS NUMERIC) AS exempt_building,

        -- Physical characteristics
        SAFE_CAST(total_livable_area  AS NUMERIC) AS total_livable_area,
        SAFE_CAST(total_area          AS NUMERIC) AS total_area,
        SAFE_CAST(depth               AS NUMERIC) AS depth,
        SAFE_CAST(frontage            AS NUMERIC) AS frontage,
        SAFE_CAST(off_street_open     AS NUMERIC) AS off_street_open,
        SAFE_CAST(garage_spaces       AS INT64)   AS garage_spaces,
        SAFE_CAST(number_of_bedrooms  AS INT64)   AS number_of_bedrooms,
        SAFE_CAST(number_of_bathrooms AS NUMERIC) AS number_of_bathrooms,
        SAFE_CAST(number_stories      AS INT64)   AS number_stories,
        SAFE_CAST(year_built          AS INT64)   AS year_built,

        -- Dates
        SAFE_CAST(sale_date         AS DATE) AS sale_date,
        SAFE_CAST(recording_date    AS DATE) AS recording_date,
        SAFE_CAST(assessment_date   AS DATE) AS assessment_date,
        SAFE_CAST(market_value_date AS DATE) AS market_value_date,

        -- Coordinates + derived geography
        SAFE_CAST(lat AS FLOAT64) AS lat,
        SAFE_CAST(lng AS FLOAT64) AS lng,
        SAFE.ST_GEOGPOINT(
            SAFE_CAST(lng AS FLOAT64),
            SAFE_CAST(lat AS FLOAT64)
        ) AS geog,

        -- All remaining columns (addresses, descriptions, codes, owner info,
        -- etc.) pass through unchanged as STRING.
        * EXCEPT (
            parcel_number,
            market_value,
            sale_price,
            taxable_land,
            taxable_building,
            exempt_land,
            exempt_building,
            total_livable_area,
            total_area,
            depth,
            frontage,
            off_street_open,
            garage_spaces,
            number_of_bedrooms,
            number_of_bathrooms,
            number_stories,
            year_built,
            sale_date,
            recording_date,
            assessment_date,
            market_value_date,
            lat,
            lng
        )
    FROM `source.opa_properties`
);
