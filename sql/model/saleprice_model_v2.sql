-- v2: Added log features + more fields
CREATE OR REPLACE MODEL `musa5090s26-team6.derived.saleprice_model_v2`
OPTIONS(
  model_type = 'RANDOM_FOREST_REGRESSOR',
  input_label_cols = ['sale_price'],
  num_parallel_tree = 100,
  max_tree_depth = 8,
  subsample = 0.8,
  data_split_method = 'AUTO_SPLIT'
) AS

WITH bundle_sales AS (
  SELECT sale_price, sale_date
  FROM `musa5090s26-team6.core.opa_properties`
  WHERE sale_price IS NOT NULL
    AND sale_date IS NOT NULL
  GROUP BY sale_price, sale_date
  HAVING COUNT(*) > 1
),

clean_data AS (
  SELECT p.*
  FROM `musa5090s26-team6.core.opa_properties` p
  LEFT JOIN bundle_sales b
    ON p.sale_price = b.sale_price
    AND p.sale_date = b.sale_date
  WHERE b.sale_price IS NULL
)

SELECT
  sale_price,
  total_livable_area,
  LOG(total_livable_area + 1)                        AS log_livable_area,
  total_area,
  CAST(number_of_bedrooms AS FLOAT64)                AS number_of_bedrooms,
  CAST(number_of_bathrooms AS FLOAT64)               AS number_of_bathrooms,
  CAST(number_stories AS FLOAT64)                    AS number_stories,
  CAST(garage_spaces AS FLOAT64)                     AS garage_spaces,
  CAST(exterior_condition AS FLOAT64)                AS exterior_condition,
  CAST(interior_condition AS FLOAT64)                AS interior_condition,
  2025 - year_built                                  AS property_age,
  DATE_DIFF(CURRENT_DATE(), sale_date, DAY)          AS days_since_sale,
  LOG(DATE_DIFF(CURRENT_DATE(), sale_date, DAY) + 1) AS log_days_since_sale,
  zip_code,
  category_code_description,
  building_code_description,
  geographic_ward,
  quality_grade
FROM clean_data
WHERE sale_price IS NOT NULL
  AND sale_price > 1000
  AND sale_price < 2000000
  AND total_livable_area IS NOT NULL
  AND year_built IS NOT NULL
  AND sale_date IS NOT NULL