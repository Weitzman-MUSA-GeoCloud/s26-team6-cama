# OPA Data Feature Analysis & Engineering Notes

**Issue**: #10 — Explore OPA data for assessment model
**Team**: Spring 26 Team 6 CAMA
**Data Source**: `musa5090s26-team6.core.opa_properties` (BigQuery, exported as CSV)

---

## 1. Data Sources

| Table | Location | Description |
|-------|----------|-------------|
| `core.opa_properties` | BigQuery | Main table — sale price, property features |
| `core.opa_assessments` | BigQuery | Historical assessment records (supplementary) |

Original data downloaded from [Philadelphia Properties and Assessment History](https://opendataphilly.org/dataset/opa-property-assessments) on OpenDataPhilly.

---

## 2. Data Cleaning Steps

### 2.1 Remove Anomalously Low Sale Prices
Properties with `sale_price <= 100` were removed. These are likely family transfers or administrative transactions that do not reflect true market value.

### 2.2 Remove Anomalously High Sale Prices
Properties with `sale_price >= 2,000,000` were removed. Analysis showed that 99% of Philadelphia residential properties sell below $2.1M. Records above this threshold are likely commercial properties, data entry errors, or incompletely filtered bundle sales.

- Raw max sale price: **$968,000,000** (clearly not a single residential property)
- After filtering: max sale price **$1,998,393**
- Records removed: approximately 210,000 (out of 581,058 raw records)

### 2.3 Remove Bundle Sales
Properties sold on the exact same day at the exact same price are likely sold as a bundle. The `sale_price` in those cases represents the price of the entire bundle, not any individual property.

- Identified by: grouping on `sale_date` and `sale_price` where count > 1

### 2.4 Remove Invalid Property Ages
Records where `property_age < 0` or `property_age > 200` were set to NA, as these indicate data entry errors in `year_built`.

### 2.5 Target Variable
- **Predict**: `sale_price` (actual transaction price)
- **Do NOT use**: `market_value` (OPA's own internal estimate — risks data leakage)
- **Transformation**: Use `log(sale_price)` as the model target due to strong right skew

---

## 3. Feature Analysis

### 3.1 Correlation with sale_price (after cleaning)

After removing outliers, correlations with `sale_price` improved dramatically:

| Feature | Correlation with sale_price | Correlation with log_sale_price |
|---------|----------------------------|--------------------------------|
| `log_sale_price` | **0.77** | 1.00 |
| `total_livable_area` | **0.44** | 0.31 |
| `number_of_bathrooms` | 0.42 | 0.30 |
| `fireplaces` | 0.28 | 0.17 |
| `days_since_sale` | -0.42 | **-0.56** |
| `interior_condition` | -0.43 | **-0.41** |
| `exterior_condition` | -0.36 | -0.33 |
| `number_of_bedrooms` | 0.09 | 0.02 |

> Note: `exterior_condition` and `interior_condition` are rated 0–8 where lower = better condition, which explains the negative correlation with price.

### 3.2 Key Predictors

**Strongest features (recommended for model):**
- `days_since_sale` — strongest predictor of log_sale_price (-0.56); more recent sales reflect current market better
- `interior_condition` / `exterior_condition` — strong negative correlation (-0.41 / -0.33)
- `total_livable_area` — strong positive correlation (0.44 with sale_price)
- `number_of_bathrooms` — moderate positive correlation (0.42)
- `zip_code` — location drives significant price variation (19118 median ~$450K vs 19154 median ~$175K)

**Weaker features (include but lower priority):**
- `number_of_bedrooms` — weak correlation (0.09), partly because it's correlated with `number_of_bathrooms`
- `property_age` — weak direct correlation but may interact with condition
- `fireplaces` — moderate correlation (0.28)
- `garage_spaces` — moderate correlation (0.11)

### 3.3 Features Excluded

| Feature | Reason |
|---------|--------|
| `market_value` | OPA's own estimate — data leakage risk |
| `basements` | 41.4% missing rate — too high to impute reliably |
| `central_air` | 46.9% missing rate — too high to impute reliably |
| `building_code_description` | Redundant with zoning |

### 3.4 Missing Value Summary

| Feature | Missing Rate | Strategy |
|---------|-------------|----------|
| `garage_spaces` | ~10% | Treat NA as 0 (assume no garage) |
| `fireplaces` | ~10% | Treat NA as 0 (assume no fireplace) |
| `number_of_bathrooms` | ~10% | Impute with median by zip_code |
| `number_of_bedrooms` | ~9% | Impute with median by zip_code |
| `total_livable_area` | ~5% | Impute with median by building type |
| `exterior_condition` | ~5% | Impute with mode |
| `interior_condition` | ~5% | Impute with mode |
| `year_built` / `property_age` | ~5% | Impute with median by zip_code |

---

## 4. Feature Engineering Plan

### 4.1 Derived Features

```
log_sale_price    = log(sale_price)             # target variable
log_livable_area  = log(total_livable_area + 1) # reduce right skew
property_age      = 2025 - year_built           # more interpretable than raw year
days_since_sale   = today() - sale_date         # recency signal (strongest predictor)
```

### 4.2 Categorical Encoding

| Feature | Method | Rationale |
|---------|--------|-----------|
| `zip_code` | Target encoding | ~50 zip codes; encodes location price signal directly |
| `zoning` | Grouped into 5 categories | Residential Single / Residential Multi / Commercial / Industrial / Other |
| `exterior_condition` | Numeric as-is | Already ordinal 0–8 |
| `interior_condition` | Numeric as-is | Already ordinal 0–8 |

### 4.3 Zoning Groups

```r
zoning_group = case_when(
  str_starts(zoning, "RM")  ~ "Residential_Multi",
  str_starts(zoning, "RSA") | str_starts(zoning, "RSD") ~ "Residential_Single",
  str_starts(zoning, "CMX") | str_starts(zoning, "CA")  ~ "Commercial",
  str_starts(zoning, "I")   ~ "Industrial",
  TRUE ~ "Other"
)
```

---

## 5. Recommended Feature Set for Model

To be used as inputs in `derived.assessment_inputs`:

**Numeric features:**
- `log_livable_area` (derived from `total_livable_area`)
- `property_age` (derived from `year_built`)
- `days_since_sale` (derived from `sale_date`)
- `number_of_bathrooms`
- `number_of_bedrooms`
- `exterior_condition`
- `interior_condition`
- `garage_spaces`
- `fireplaces`
- `total_area`

**Categorical features (encoded):**
- `zip_code` (target encoded)
- `zoning_group` (5 grouped categories)

---

## 6. Key EDA Findings

1. **Outlier filtering is critical**: Raw data contained sale prices up to $968M. Filtering to $100 < sale_price < $2M removed ~36% of records but dramatically improved feature correlations.
2. **Recency is the strongest signal**: `days_since_sale` has the highest correlation with `log_sale_price` (-0.56). Philadelphia prices rose sharply 2019–2021 and have since stabilized around $250K median.
3. **Condition matters more than size**: `interior_condition` (-0.41) and `exterior_condition` (-0.33) are stronger predictors than `total_livable_area` (0.31) when predicting log price.
4. **Location drives large variation**: Zip code 19118 has a median sale price of ~$450K while 19154 is ~$175K — a 2.5x difference purely from location.
5. **High missing rates for amenity features**: `garage_spaces`, `fireplaces`, `number_of_bathrooms`, and `number_of_bedrooms` all have ~10% missing — imputation strategy required before modeling.
6. **basements and central_air must be excluded**: Both have >40% missing rates, making them unreliable for modeling.

---

## 7. Artifacts in This Folder

| File | Description |
|------|-------------|
| `opa_eda.Rmd` | R Markdown notebook with all EDA code and visualizations |
| `opa_eda.html` | Rendered HTML output (knit from Rmd) |
| `feature_notes.md` | This document — feature analysis and engineering plan |

> **Note**: Raw data files are NOT committed to this repository. Data is accessed via BigQuery at `musa5090s26-team6.core.opa_properties` and exported locally as CSV for analysis.

---

*Last updated: April 2026 | Author: Xiaoqing Chen | Team 6*
