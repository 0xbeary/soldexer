-- =============================================================================
-- GLOBAL MATERIALIZED VIEWS FOR FRONTEND APPS
-- =============================================================================
-- This file contains cross-pipe materialized views and aggregations
-- Each pipe manages its own base tables, but shared views go here
--
-- HOW TO ADD NEW MATERIALIZED VIEWS:
-- 1. Add your SQL below following the existing patterns
-- 2. Run: npm start (to apply schema changes)
-- 3. Views will be created automatically
--
-- MATERIALIZED VIEW PATTERNS:
-- - SummingMergeTree: For aggregations (counts, sums)
-- - ReplacingMergeTree: For latest-value queries
-- - AggregatingMergeTree: For complex aggregations
--
-- EXAMPLE:
-- CREATE MATERIALIZED VIEW my_new_view
-- ENGINE = SummingMergeTree()
-- PARTITION BY toYYYYMM(date)
-- ORDER BY date
-- POPULATE
-- AS SELECT ...
-- =============================================================================

-- =============================================================================
-- PUMPFUN TOKEN ANALYTICS
-- =============================================================================

-- Daily token creation statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS pumpfun_daily_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY date
POPULATE
AS SELECT
    toDate(creation_time) as date,
    count() as tokens_created,
    uniq(symbol) as unique_symbols,
    uniq(substring(name, 1, 1)) as first_letter_diversity
FROM solana_pumpfun_tokens
GROUP BY date;

-- Hourly token creation for real-time dashboards
CREATE MATERIALIZED VIEW IF NOT EXISTS pumpfun_hourly_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY hour
POPULATE
AS SELECT
    toStartOfHour(creation_time) as hour,
    count() as tokens_created,
    uniq(symbol) as unique_symbols,
    avg(length(name)) as avg_name_length
FROM solana_pumpfun_tokens
GROUP BY hour;

-- Minute-level stats for ultra real-time SSE streams
CREATE MATERIALIZED VIEW IF NOT EXISTS pumpfun_minute_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(minute)
ORDER BY minute
POPULATE
AS SELECT
    toStartOfMinute(creation_time) as minute,
    count() as tokens_created,
    uniq(symbol) as unique_symbols,
    avg(length(name)) as avg_name_length,
    min(creation_time) as first_token_time,
    max(creation_time) as last_token_time
FROM solana_pumpfun_tokens
GROUP BY minute;

-- Token velocity (5-minute windows for real-time rate monitoring)
CREATE MATERIALIZED VIEW IF NOT EXISTS pumpfun_velocity_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(window_start)
ORDER BY window_start
POPULATE
AS SELECT
    toStartOfFiveMinute(creation_time) as window_start,
    count() as tokens_in_window,
    count() / 300.0 as tokens_per_second,
    uniq(symbol) as unique_symbols_in_window
FROM solana_pumpfun_tokens
GROUP BY window_start;

-- Top symbols by creation frequency (rolling 24h)
CREATE MATERIALIZED VIEW IF NOT EXISTS pumpfun_trending_symbols
ENGINE = ReplacingMergeTree()
PARTITION BY toYYYYMM(last_seen)
ORDER BY (symbol, last_seen)
POPULATE
AS SELECT
    symbol,
    count() as occurrence_count,
    max(creation_time) as last_seen,
    min(creation_time) as first_seen
FROM solana_pumpfun_tokens
WHERE creation_time >= now() - INTERVAL 24 HOUR
GROUP BY symbol;

-- =============================================================================
-- REAL-TIME VIEWS FOR FRONTEND QUERIES
-- =============================================================================

-- Latest tokens (optimized for real-time feeds)
CREATE VIEW IF NOT EXISTS latest_tokens AS
SELECT 
    name,
    symbol,
    address,
    metadata_uri,
    creation_time,
    toUnixTimestamp(creation_time) as timestamp_unix
FROM solana_pumpfun_tokens
ORDER BY creation_time DESC
LIMIT 1000;

-- Token search view (optimized for autocomplete)
CREATE VIEW IF NOT EXISTS searchable_tokens AS
SELECT 
    name,
    symbol,
    address,
    creation_time,
    concat(name, ' ', symbol) as search_text
FROM solana_pumpfun_tokens
WHERE length(name) > 0 AND length(symbol) > 0
ORDER BY creation_time DESC;

-- =============================================================================
-- PERFORMANCE OPTIMIZATION VIEWS
-- =============================================================================

-- Aggregated stats for dashboard (faster than calculating on-demand)
CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_stats
ENGINE = ReplacingMergeTree()
ORDER BY metric_name
POPULATE
AS SELECT
    'total_tokens' as metric_name,
    toString(count()) as metric_value,
    now() as last_updated
FROM solana_pumpfun_tokens
UNION ALL
SELECT
    'tokens_last_24h' as metric_name,
    toString(count()) as metric_value,
    now() as last_updated
FROM solana_pumpfun_tokens
WHERE creation_time >= now() - INTERVAL 24 HOUR
UNION ALL
SELECT
    'unique_symbols' as metric_name,
    toString(uniq(symbol)) as metric_value,
    now() as last_updated
FROM solana_pumpfun_tokens;

-- =============================================================================
-- INDEXES FOR FRONTEND PERFORMANCE
-- =============================================================================

-- Add indexes to base tables for common frontend queries
-- (These would be applied to tables created by individual pipes)

-- Example indexes (uncomment when tables exist):
-- ALTER TABLE solana_pumpfun_tokens ADD INDEX IF NOT EXISTS idx_creation_time creation_time TYPE minmax;
-- ALTER TABLE solana_pumpfun_tokens ADD INDEX IF NOT EXISTS idx_symbol symbol TYPE bloom_filter;
-- ALTER TABLE solana_pumpfun_tokens ADD INDEX IF NOT EXISTS idx_name name TYPE tokenbf_v1(32768, 3, 0);