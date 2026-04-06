CREATE OR REPLACE EXTERNAL TABLE `source.pwd_parcels`
OPTIONS (
    format = 'NEWLINE_DELIMITED_JSON',
    uris = ['gs://musa5090s26-team6-prepared_data/pwd_parcels/data.*']
);
