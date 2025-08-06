import path from 'path';
import { ClickHouseClient } from '@clickhouse/client';
import { ClickhouseState } from '@sqd-pipes/core';
import { SolanaPumpfunTokensStream, PumpfunTokenCreation } from './stream.js';
import { logger } from './utils/logger.js';
import { ensureTables } from './utils/database.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface PipeConfig {
  fromBlock: number;
  toBlock?: number;
}

export const pumpfunTokenCreationIndexer = async (
  portalUrl: string,
  clickhouse: ClickHouseClient,
  config: PipeConfig,
) => {
  const ds = new SolanaPumpfunTokensStream({
    portal: `${portalUrl}/datasets/solana-mainnet`,
    blockRange: {
      from: config.fromBlock,
      to: config.toBlock,
    },
    state: new ClickhouseState(clickhouse, {
      table: 'solana_sync_status',
      id: 'solana_pumpfun_token_creation',
    }),
    logger,
  })

  await ensureTables(clickhouse, path.join(__dirname, 'sql/schema.sql'))

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
    })

    await ds.ack()
  }
}

export { PumpfunTokenCreation };
