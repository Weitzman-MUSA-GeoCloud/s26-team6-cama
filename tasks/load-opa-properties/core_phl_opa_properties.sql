CREATE OR REPLACE TABLE `core.opa_properties` AS (
    SELECT
        parcel_number AS property_id,
        *
    FROM `source.opa_properties`
);
