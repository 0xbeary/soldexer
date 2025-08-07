import path from 'path';
import { ClickhouseState } from '@sqd-pipes/core';
import { SolanaPumpfunTokensStream } from './streams/pumpfunTokenStream';
import { logger } from './utils/logger';
import { ensureTables, createClickhouseClient } from './utils/database';
import { retry } from './utils/retry';

async function main() {
  logger.info('Starting Pumpfun Token Creation Indexer');

  await retry(async () => {
    // Configuration from environment variables
    const portalUrl = process.env.PORTAL_URL || 'https://portal.sqd.dev';
    const fromBlock = parseInt('332557468');
    const toBlock = undefined;

    // Create ClickHouse client
    const clickhouse = createClickhouseClient({
      url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
      database: process.env.CLICKHOUSE_DB || 'default',
      username: process.env.CLICKHOUSE_USER || 'default',
      password: process.env.CLICKHOUSE_PASSWORD || '',
    });

    logger.info(`Indexing from block ${fromBlock}${toBlock ? ` to ${toBlock}` : ''}`);

    const ds = new SolanaPumpfunTokensStream({
      portal: `${portalUrl}/datasets/solana-mainnet`,
      blockRange: {
        from: fromBlock,
        to: toBlock,
      },
      state: new ClickhouseState(clickhouse, {
        table: 'solana_sync_status',
        id: 'solana_pumpfun_token_creation',
      }),
      logger,
    });

    await ensureTables(clickhouse, path.join(__dirname, './sql/schema.sql'));

    for await (const tokens of await ds.stream()) {
      await clickhouse.insert({
        table: 'solana_pumpfun_tokens',
        format: 'JSONEachRow',
        values: tokens.map((t) => ({
          name: t.name,
          symbol: t.symbol,
          address: t.address,
          metadata_uri: t.uri,
          creation_time: t.deployTime,
        })),
      });
      await ds.ack();
    }
  }, 6, 5000, 2); // 6 max retries, 5 second initial delay, 2x backoff
}

// Run directly if this file is executed
if (require.main === module) {
  main().catch((error) => {
    logger.error('Failed to run pumpfun token indexer:', error);
    process.exit(1);
  });
}
