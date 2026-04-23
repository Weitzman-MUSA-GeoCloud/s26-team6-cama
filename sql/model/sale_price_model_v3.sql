CREATE OR REPLACE MODEL `musa5090s26-team6.derived.sale_price_model_v3`
OPTIONS(
  model_type = 'RANDOM_FOREST_REGRESSOR',
  input_label_cols = ['sale_price'],
  num_parallel_tree = 200,
  max_tree_depth = 10,
  subsample = 0.8,
  data_split_method = 'AUTO_SPLIT'
) AS

SELECT
  sale_price,
  total_livable_area,
  log_livable_area,
  number_of_bathrooms,
  number_of_bedrooms,
  number_of_rooms,
  exterior_condition,
  interior_condition,
  garage_spaces,
  fireplaces,
  property_age,
  days_since_sale,
  log_days_since_sale,
  zip_code,
  category_code_description,
  quality_grade,
  geographic_ward
FROM `musa5090s26-team6.derived.modeling_data`
WHERE sale_price IS NOT NULL
  AND sale_price > 1000
  AND total_livable_area IS NOT NULL