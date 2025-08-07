-- Create the main table for pumpfun tokens
CREATE TABLE IF NOT EXISTS solana_pumpfun_tokens
(
    name String,
    symbol String,
    address String,
    metadata_uri String,
    creation_time DateTime CODEC (DoubleDelta, ZSTD)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(creation_time)
ORDER BY (creation_time, symbol);
