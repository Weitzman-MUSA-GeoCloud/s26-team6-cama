CREATE OR REPLACE TABLE `core.pwd_parcels` AS (
    SELECT
        CAST(brt_id AS STRING) AS property_id,
        * EXCEPT (geometry),
        SAFE.ST_GEOGFROMGEOJSON(geometry) AS geometry
    FROM `source.pwd_parcels`
);
