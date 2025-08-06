import path from 'path';
import { ClickHouseClient } from '@clickhouse/client';
import { ClickhouseState } from '@sqd-pipes/core';
import { SolanaPumpfunTokensStream, PumpfunTokenCreation } from './streams/pumpfunTokenStream';
import { logger } from './utils/logger';
import { ensureTables } from './utils/database';

export interface PipeConfig {
  fromBlock: number;
  toBlock?: number;
  clickhouse: ClickHouseClient;
  portalUrl: string;
}

export const pumpfunTokenCreationIndexer = async (
  config: PipeConfig,
) => {
  const ds = new SolanaPumpfunTokensStream({
    portal: `${config.portalUrl}/datasets/solana-mainnet`,
    blockRange: {
      from: config.fromBlock,
      to: config.toBlock,
    },
    state: new ClickhouseState(config.clickhouse, {
      table: 'solana_sync_status',
      id: 'solana_pumpfun_token_creation',
    }),
    logger,
  })

  await ensureTables(config.clickhouse, path.join(__dirname, './sql/schema.sql'))

  for await (const tokens of await ds.stream()) {
    await config.clickhouse.insert({
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