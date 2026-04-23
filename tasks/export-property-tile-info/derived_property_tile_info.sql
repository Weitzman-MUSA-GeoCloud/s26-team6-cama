CREATE OR REPLACE TABLE `derived.property_tile_info` AS (
    WITH latest_tax_year AS (
        SELECT MAX(year) AS max_year
        FROM `core.opa_assessments`
    ),

    latest_assessments AS (
        SELECT
            property_id,
            SAFE_CAST(market_value AS FLOAT64) AS tax_year_assessed_value
        FROM `core.opa_assessments`
        WHERE year = (SELECT max_year FROM latest_tax_year)
    )

    SELECT
        o.property_id,
        o.location AS address,
        par.geometry AS geog,
        NULL AS current_assessed_value,
        la.tax_year_assessed_value
    FROM `core.opa_properties` AS o
    JOIN `core.pwd_parcels` AS par
        ON o.property_id = par.property_id
    LEFT JOIN latest_assessments AS la
        ON o.property_id = la.property_id
    WHERE
        o.category_code_description = 'RESIDENTIAL'
        AND par.geometry IS NOT NULL
);
