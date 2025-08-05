# PumpFun Tokens Pipe

This pipe indexes PumpFun token creation events from the Solana blockchain and stores them in ClickHouse.

## What it does

- Listens for PumpFun token creation instructions
- Extracts token metadata (name, symbol, URI, creation time)
- Stores data in ClickHouse with proper partitioning
- Creates materialized views for analytics

## Usage

```typescript
import { createClient } from '@clickhouse/client';
import { PumpfunTokensPipe } from './pipes/pumpfun-tokens/index.js';

const clickhouse = createClient({
  url: 'http://localhost:8123',
  database: 'default'
});

const pipe = new PumpfunTokensPipe(clickhouse, {
  fromBlock: 332557468,
  portalUrl: 'https://portal.sqd.dev'
});

await pipe.start();
```

## Configuration

- `fromBlock`: Starting block number
- `toBlock`: (optional) Ending block number
- `portalUrl`: (optional) Portal URL, defaults to https://portal.sqd.dev

## Database Tables

### `solana_pumpfun_tokens`
Main table storing token creation events:
- `name`: Token name
- `symbol`: Token symbol  
- `address`: Token mint address
- `metadata_uri`: Token metadata URI
- `creation_time`: When the token was created

### `solana_pumpfun_tokens_daily`
Materialized view with daily aggregations:
- Daily token creation counts
- Unique symbols per day

## Real-time Usage

For real-time frontends, query the latest tokens:

```sql
SELECT * FROM solana_pumpfun_tokens 
ORDER BY creation_time DESC 
LIMIT 20
```
