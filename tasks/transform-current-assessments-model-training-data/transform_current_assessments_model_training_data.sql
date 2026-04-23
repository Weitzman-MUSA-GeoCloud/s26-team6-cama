-- Training data for the current-assessments model.
-- Each row is a single arm's-length sale used as a training example.
--
-- Notes:
--   * `sale_price` is NUMERIC after core.opa_properties is loaded with
--     the typed core SQL, so no CAST is needed.
--   * "Bundle sales" = the same (price, date) occurring on multiple
--     properties. These are usually estate / LLC / package transfers
--     where the per-property price is not market value, so they are
--     excluded from training.
--   * BigQuery does not support `(a, b) NOT IN (SELECT (a, b) ...)`;
--     we use NOT EXISTS instead.
--   * Training window: sales from 2020-01-01 onward. Older sales come
--     from a different market regime (pre-COVID, pre-2008 boom/bust)
--     and their prices are not comparable to current market values.
--     This also excludes sentinel/placeholder dates like 1700-01-01.

CREATE OR REPLACE TABLE `derived.current_assessments_model_training_data` AS (
    WITH bundle_sales AS (
        SELECT sale_price, sale_date
        FROM `core.opa_properties`
        WHERE
            sale_price IS NOT NULL
            AND sale_date IS NOT NULL
            AND sale_date >= '2020-01-01'
        GROUP BY sale_price, sale_date
        HAVING COUNT(*) > 1
    )

    SELECT
        c.property_id,
        c.sale_price,
        c.sale_date,
        c.total_livable_area,
        c.total_area,
        c.number_of_bedrooms,
        c.number_of_bathrooms,
        c.number_stories,
        c.year_built,
        c.zip_code,
        c.category_code_description,
        c.building_code_description,
        c.interior_condition,
        c.exterior_condition
    FROM `core.opa_properties` AS c
    WHERE
        c.sale_price IS NOT NULL
        AND c.sale_price > 1
        AND c.sale_date IS NOT NULL
        AND c.sale_date >= '2020-01-01'
        AND NOT EXISTS (
            SELECT 1
            FROM bundle_sales AS b
            WHERE b.sale_price = c.sale_price
                AND b.sale_date = c.sale_date
        )
);
