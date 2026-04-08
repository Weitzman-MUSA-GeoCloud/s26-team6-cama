CREATE OR REPLACE TABLE `derived.property_tile_info` AS (
    WITH latest_tax_year AS (
        SELECT MAX(tax_year) AS max_year
        FROM `core.opa_assessments`
    ),
    latest_assessments AS (
        SELECT
            property_id,
            assessed_value AS tax_year_assessed_value
        FROM `core.opa_assessments`
        WHERE tax_year = (SELECT max_year FROM latest_tax_year)
    )
    SELECT
        o.property_id,
        o.location AS address,
        par.geometry AS geog,
        ca.assessed_value AS current_assessed_value,
        la.tax_year_assessed_value
    FROM `core.opa_properties` AS o
    JOIN `core.pwd_parcels` AS par
        ON o.property_id = par.property_id
    LEFT JOIN latest_assessments AS la
        ON o.property_id = la.property_id
    LEFT JOIN `derived.current_assessments` AS ca
        ON o.property_id = ca.property_id
    WHERE o.category_code_description = 'RESIDENTIAL'
        AND par.geometry IS NOT NULL
);
