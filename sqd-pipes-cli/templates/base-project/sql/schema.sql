-- =============================================================================
-- SAMPLE MATERIALIZED VIEW
-- =============================================================================
-- This file contains example materialized views for cross-pipe aggregations
-- Each pipe manages its own base tables, but shared views go here
--
-- HOW TO ADD NEW MATERIALIZED VIEWS:
-- 1. Add your SQL below following the existing patterns
-- 2. Run: pnpm run schema:sync
-- 3. Views will be created automatically
-- =============================================================================

-- Example: Transaction count per block per hour
-- (Assumes a transactions table exists with block_id and timestamp columns)
CREATE MATERIALIZED VIEW IF NOT EXISTS transactions_per_block_hourly
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