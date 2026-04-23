CREATE OR REPLACE MODEL `musa5090s26-team6.derived.sale_price_model_v1`
OPTIONS(
  model_type = 'RANDOM_FOREST_REGRESSOR',
  input_label_cols = ['log_sale_price'],
  num_parallel_tree = 100,
  max_tree_depth = 8,
  subsample = 0.8,
  data_split_method = 'AUTO_SPLIT'
) AS

SELECT
  log_sale_price,
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
  zip_code,
  category_code_description,
  quality_grade,
  geographic_ward
FROM `musa5090s26-team6.derived.modeling_data`
WHERE log_sale_price IS NOT NULL
  AND log_livable_area IS NOT NULL
  AND exterior_condition IS NOT NULL
  AND interior_condition IS NOT NULL