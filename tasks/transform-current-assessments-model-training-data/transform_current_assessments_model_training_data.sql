CREATE OR REPLACE TABLE `derived.current_assessments_model_training_data` AS (
    WITH bundle_sales AS (
        SELECT sale_price, sale_date
        FROM `core.opa_properties`
        WHERE
            sale_price IS NOT NULL
            AND sale_date IS NOT NULL
        GROUP BY sale_price, sale_date
        HAVING COUNT(*) > 1
    )

    SELECT
        property_id,
        sale_price,
        sale_date,
        total_livable_area,
        total_area,
        number_of_bedrooms,
        number_of_bathrooms,
        number_stories,
        year_built,
        zip_code,
        category_code_description,
        building_code_description,
        interior_condition,
        exterior_condition
    FROM `core.opa_properties`
    WHERE
        sale_price IS NOT NULL
        AND CAST(sale_price AS FLOAT64) > 1
        AND sale_date IS NOT NULL
        AND (sale_price, sale_date) NOT IN (
            SELECT (sale_price, sale_date) FROM bundle_sales
        )
);
