CREATE OR REPLACE TABLE `musa5090s26-team6.derived.current_assessments` AS

SELECT
  property_id,
  predicted_sale_price AS predicted_value,
  CURRENT_TIMESTAMP() AS predicted_at
FROM
  ML.PREDICT(
    MODEL `musa5090s26-team6.derived.saleprice_model_current`,
    (
      SELECT
        property_id,
        total_livable_area,
        LOG(total_livable_area + 1)                        AS log_livable_area,
        total_area,
        CAST(number_of_bedrooms AS FLOAT64)                AS number_of_bedrooms,
        CAST(number_of_bathrooms AS FLOAT64)               AS number_of_bathrooms,
        CAST(number_stories AS FLOAT64)                    AS number_stories,
        CAST(interior_condition AS FLOAT64)                AS interior_condition,
        CAST(exterior_condition AS FLOAT64)                AS exterior_condition,
        2025 - year_built                                  AS property_age,
        DATE_DIFF(CURRENT_DATE(), sale_date, DAY)          AS days_since_sale,
        LOG(DATE_DIFF(CURRENT_DATE(), sale_date, DAY) + 1) AS log_days_since_sale,
        zip_code,
        category_code_description,
        building_code_description
      FROM `musa5090s26-team6.core.opa_properties`
      WHERE total_livable_area IS NOT NULL
        AND year_built IS NOT NULL
        AND sale_date IS NOT NULL
        AND category_code_description IN (
          'SINGLE FAMILY',
          'MULTI FAMILY',
          'APARTMENTS > 4 UNITS',
          'MIXED USE'
        )
    )
  )
