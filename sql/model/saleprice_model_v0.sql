-- v0: Baseline, no filtering, minimal features
CREATE OR REPLACE MODEL `musa5090s26-team6.derived.saleprice_model_v0`
OPTIONS (
    model_type = 'RANDOM_FOREST_REGRESSOR',
    input_label_cols = ['sale_price'],
    num_parallel_tree = 100,
    max_tree_depth = 8,
    subsample = 0.8,
    data_split_method = 'AUTO_SPLIT'
) AS

SELECT
    sale_price,
    total_livable_area,
    cast(number_of_bedrooms AS FLOAT64) AS number_of_bedrooms,
    cast(number_of_bathrooms AS FLOAT64) AS number_of_bathrooms,
    cast(exterior_condition AS FLOAT64) AS exterior_condition,
    cast(interior_condition AS FLOAT64) AS interior_condition,
    2025 - year_built AS property_age,
    date_diff(current_date(), sale_date, DAY) AS days_since_sale,
    zip_code
FROM `musa5090s26-team6.core.opa_properties`
WHERE 
    sale_price IS NOT NULL
    AND sale_price > 1000
    AND total_livable_area IS NOT NULL
    AND year_built IS NOT NULL
    AND sale_date IS NOT NULL
