CREATE OR REPLACE TABLE `core.pwd_parcels` AS (
    SELECT
        brt_id AS property_id,
        * EXCEPT (geometry),
        SAFE.ST_GEOGFROMGEOJSON(geometry) AS geometry
    FROM `source.pwd_parcels`
);
