CREATE OR REPLACE EXTERNAL TABLE `source.opa_assessments`
OPTIONS (
    format = 'PARQUET',
    uris = ['gs://musa5090s26-team6-prepared_data/opa_assessments/data.*']
);
