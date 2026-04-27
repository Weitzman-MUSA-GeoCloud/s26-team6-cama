-- Predict current assessment values for all residential properties
CREATE OR REPLACE TABLE `musa5090s26-team6.derived.current_assessments` AS

SELECT
    property_id,
    predicted_sale_price AS predicted_value,
    current_timestamp() AS predicted_at
FROM ml.PREDICT (
    MODEL `musa5090s26-team6.derived.saleprice_model_current`,
    (
        SELECT
            property_id,
            total_livable_area,
            log(total_livable_area + 1) AS log_livable_area,
            total_area,
            cast(number_of_bedrooms AS FLOAT64) AS number_of_bedrooms,
            cast(number_of_bathrooms AS FLOAT64) AS number_of_bathrooms,
            cast(number_stories AS FLOAT64) AS number_stories,
            cast(interior_condition AS FLOAT64) AS interior_condition,
            cast(exterior_condition AS FLOAT64) AS exterior_condition,
            2025 - year_built AS property_age,
            date_diff(current_date(), sale_date, DAY) AS days_since_sale,
            log(date_diff(current_date(), sale_date, DAY) + 1) AS log_days_since_sale,
            zip_code,
            category_code_description,
            building_code_description
        FROM `musa5090s26-team6.core.opa_properties`
        WHERE
            total_livable_area IS NOT NULL
            AND total_livable_area > 0
            AND year_built IS NOT NULL
            AND year_built > 1800
            AND sale_date IS NOT NULL
            AND category_code_description IN (
                'SINGLE FAMILY',
                'MULTI FAMILY',
                'APARTMENTS > 4 UNITS',
                'MIXED USE'
            )
    )
)
