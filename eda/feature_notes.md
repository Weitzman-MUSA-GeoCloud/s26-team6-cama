# OPA Data Feature Analysis & Engineering Notes

**Issue**: #10 — Explore OPA data for assessment model
**Team**: Spring 26 Team 6 CAMA
**Data Source**: `musa5090s25-team6.core.opa_properties` (BigQuery)

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

- Records removed: *(fill in after running EDA)*
- Threshold rationale: prices at or below $100 are not representative of open market transactions

### 2.2 Remove Bundle Sales

Properties sold on the exact same day at the exact same price are likely sold as a bundle. The `sale_price` in these cases represents the price of the entire bundle, not any individual property.

- Identified by: grouping on `sale_date` and `sale_price` where count > 1
- Records removed: *(fill in after running EDA)*

### 2.3 Target Variable

- **Predict**: `sale_price` (actual transaction price on the open market)
- **Do NOT use**: `market_value` (OPA's own internal estimate — not the model target)
- **Transformation**: Use `log(sale_price)` as the model target due to strong right skew

---

## 3. Feature Analysis

### 3.1 Strong Predictors (High Correlation with sale_price)

| Feature | Type | Notes |
|---------|------|-------|
| `total_livable_area` | Numeric | Strongest single predictor; apply log transform if skewed |
| `total_area` | Numeric | Correlated with livable area; may be redundant |
| `number_of_bathrooms` | Numeric | Strong positive relationship with price |
| `number_of_bedrooms` | Numeric | Positive but weaker than bathrooms |
| `exterior_condition` | Ordinal | Rated 0–7; strong signal |
| `interior_condition` | Ordinal | Rated 0–7; strong signal |
| `quality_grade` | Ordinal | Overall quality rating; useful predictor |

### 3.2 Location Features

| Feature | Type | Notes |
|---------|------|-------|
| `zip_code` | Categorical | Strong location signal; use target encoding |
| `zoning` | Categorical | Residential vs. commercial distinction is important |

### 3.3 Time Features

| Feature | Type | Notes |
|---------|------|-------|
| `sale_date` | Date | Recency matters — more recent sales carry stronger signal |
| `days_since_sale` | Derived | Transform `sale_date` to numeric days elapsed from today |

### 3.4 Property Characteristics

| Feature | Type | Notes |
|---------|------|-------|
| `year_built` | Numeric | Transform to `property_age = 2025 - year_built` |
| `garage_spaces` | Numeric | Positive effect on price |
| `fireplaces` | Numeric | Minor positive effect |
| `central_air` | Binary | Y/N — encode as 0/1 |
| `basements` | Categorical | Multiple categories — may need grouping |
| `type_heater` | Categorical | Lower priority feature |

### 3.5 Features to Exclude or Treat with Caution

| Feature | Reason |
|---------|--------|
| `market_value` | OPA's own estimate — using it as a feature risks data leakage |
| `number_stories` | High missing rate, low added value |
| `type_heater` | Too many categories, weak signal |

---

## 4. Feature Engineering Plan

### 4.1 Numeric Transformations

```
log_sale_price    = log(sale_price)             # target variable
log_livable_area  = log(total_livable_area + 1) # reduce skew
property_age      = 2025 - year_built           # more interpretable than raw year
days_since_sale   = today() - sale_date         # recency signal
```

### 4.2 Categorical Encoding

| Feature | Method | Rationale |
|---------|--------|-----------|
| `zip_code` | Target encoding | Too many levels for one-hot; encodes location price signal directly |
| `zoning` | One-hot (grouped) | Group rare zoning codes into "Other" |
| `central_air` | Binary 0/1 | Simple Y/N field |
| `basements` | One-hot (grouped) | Group minor categories together |
| `building_code_description` | Target encoding | Many levels; strong proxy for property type and location |

### 4.3 Interaction Features (Optional — for later stages)

- `price_per_sqft` = `sale_price / total_livable_area` — diagnostic only, not a model input
- `age_x_condition` = `property_age * exterior_condition` — may capture renovation effect

### 4.4 Missing Value Strategy

| Feature | Missing Rate | Strategy |
|---------|-------------|----------|
| `year_built` | Low | Impute with median by zip_code |
| `total_livable_area` | Low | Impute with median by building type |
| `number_of_bedrooms` | Medium | Impute with median by zip_code |
| `garage_spaces` | Medium | Treat NA as 0 (assume no garage) |
| `exterior_condition` | Low | Impute with mode |

---

## 5. Recommended Feature Set for Model

Based on EDA findings, the following features are recommended as inputs to `derived.assessment_inputs`:

**Numeric features:**
- `log_livable_area` (derived from `total_livable_area`)
- `property_age` (derived from `year_built`)
- `days_since_sale` (derived from `sale_date`)
- `number_of_bathrooms`
- `number_of_bedrooms`
- `exterior_condition`
- `interior_condition`
- `quality_grade`
- `garage_spaces`
- `fireplaces`

**Categorical features (encoded):**
- `zip_code` (target encoded)
- `zoning` (one-hot grouped)
- `central_air` (binary)
- `basements` (one-hot grouped)

---

## 6. Key EDA Findings

1. `sale_price` is strongly right-skewed — use `log(sale_price)` as the model target.
2. `total_livable_area` is the strongest single predictor of sale price.
3. Location (`zip_code`) explains a large portion of price variance and must be included.
4. Recent sales carry a stronger price signal — `days_since_sale` should be included as a feature.
5. `exterior_condition` and `interior_condition` have a clear ordinal relationship with price.
6. Bundle sales and family transfers create significant noise if not filtered out before modeling.

---

## 7. Artifacts in This Folder

| File | Description |
|------|-------------|
| `opa_eda.Rmd` | R Markdown notebook with all EDA code and visualizations |
| `opa_eda.html` | Rendered HTML output (knit from Rmd) |
| `feature_notes.md` | This document — feature analysis and engineering plan |

> **Note**: Raw data files are NOT committed to this repository. All data is accessed via BigQuery at `musa5090s25-team6.core.opa_properties`.

---

*Last updated: April 2026 | Author: Team 6*
