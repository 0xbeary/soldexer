-- Materialized View: Transaction count per block per hour
-- Stores aggregated data physically for fast queries
-- POPULATE makes it apply to ALL historic data, not just future data

CREATE MATERIALIZED VIEW transactions_per_block_hourly
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (hour, block_id)
POPULATE
AS SELECT
    toStartOfHour(timestamp) as hour,
    block_id,
    count() as transaction_count
FROM transactions
GROUP BY hour, block_id;