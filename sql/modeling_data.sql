CREATE OR REPLACE TABLE `musa5090s26-team6.derived.modeling_data` AS

SELECT
  property_id,
  SAFE_CAST(sale_price AS FLOAT64) AS sale_price,
  LOG(SAFE_CAST(sale_price AS FLOAT64)) AS log_sale_price,
  SAFE_CAST(total_livable_area AS FLOAT64) AS total_livable_area,
  LOG(SAFE_CAST(total_livable_area AS FLOAT64)) AS log_livable_area,
  SAFE_CAST(number_of_bathrooms AS FLOAT64) AS number_of_bathrooms,
  SAFE_CAST(number_of_bedrooms AS FLOAT64) AS number_of_bedrooms,
  SAFE_CAST(number_of_rooms AS FLOAT64) AS number_of_rooms,
  SAFE_CAST(exterior_condition AS FLOAT64) AS exterior_condition,
  SAFE_CAST(interior_condition AS FLOAT64) AS interior_condition,
  SAFE_CAST(garage_spaces AS FLOAT64) AS garage_spaces,
  SAFE_CAST(fireplaces AS FLOAT64) AS fireplaces,
  (2025 - SAFE_CAST(year_built AS INT64)) AS property_age,
  DATE_DIFF(
    CURRENT_DATE(),
    DATE(SAFE.PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%S%Ez', sale_date)),
    DAY
  ) AS days_since_sale,
  LOG(DATE_DIFF(
    CURRENT_DATE(),
    DATE(SAFE.PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%S%Ez', sale_date)),
    DAY
  ) + 1) AS log_days_since_sale,
  zip_code,
  category_code_description,
  quality_grade,
  geographic_ward
FROM `musa5090s26-team6.core.opa_properties`
WHERE SAFE_CAST(sale_price AS FLOAT64) > 100
  AND SAFE_CAST(sale_price AS FLOAT64) < 2000000
  AND sale_date IS NOT NULL
  AND sale_date != ''
  AND total_livable_area IS NOT NULL
  AND total_livable_area != ''
  AND SAFE_CAST(total_livable_area AS FLOAT64) > 0
  AND zip_code IS NOT NULL
  AND zip_code != ''
  AND category_code_description IS NOT NULL
  AND category_code_description != ''