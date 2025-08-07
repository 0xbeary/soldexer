# PumpFun Tokens Pipe

This pipe indexes PumpFun token creation events from the Solana blockchain and stores them in ClickHouse.

## What it does

- Listens for PumpFun token creation instructions
- Extracts token metadata (name, symbol, URI, creation time)
- Stores data in ClickHouse with proper partitioning
- Creates materialized views for analytics

## Installation

This pipe is completely self-contained and can be run standalone:

```bash
# Install dependencies
pnpm install

# Or if you prefer npm/yarn
npm install
yarn install
```

## Usage

### As a standalone pipe
```bash
# Set environment variables
export CLICKHOUSE_URL=http://localhost:8123
export CLICKHOUSE_DB=default
export FROM_BLOCK=332557468
export PORTAL_URL=https://portal.sqd.dev

# Run the pipe
pnpm start
# or for development with auto-reload
pnpm run dev
```

### In your main application
```typescript
// Since main() is not exported, you'll need to run as a separate process
import { spawn } from 'child_process';

async function runPipes() {
  // Run pipes as separate processes for true autonomy
  const pumpfunProcess = spawn('npm', ['start'], {
    cwd: './pipes/pumpfun-tokens',
    stdio: 'inherit'
  });
  
  // Or include the pipe logic directly if you need integration
  // (you'd need to export main() function for this approach)
}
```

## Configuration

Environment variables:
- `FROM_BLOCK`: Starting block number (default: 332557468)
- `TO_BLOCK`: (optional) Ending block number
- `PORTAL_URL`: Portal URL (default: https://portal.sqd.dev)
- `CLICKHOUSE_URL`: ClickHouse URL (default: http://localhost:8123)
- `CLICKHOUSE_DB`: ClickHouse database (default: default)
- `CLICKHOUSE_USER`: ClickHouse username (default: default)
- `CLICKHOUSE_PASSWORD`: ClickHouse password (default: empty)

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
