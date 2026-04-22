SELECT
    tax_year,
    lower_bound,
    upper_bound,
    property_count
FROM `musa5090s26-team6.derived.tax_year_assessment_bins`
ORDER BY tax_year, lower_bound;
