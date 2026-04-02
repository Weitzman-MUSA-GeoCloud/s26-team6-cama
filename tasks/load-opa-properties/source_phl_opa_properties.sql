-- 创建或替换外部表 source.opa_properties
CREATE OR REPLACE EXTERNAL TABLE `source.opa_properties`
OPTIONS (
    format = 'PARQUET',
    uris = ['gs://musa5090s26-team6-prepared_data/opa_properties/data.*']
);
