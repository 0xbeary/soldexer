import { ClickHouseClient } from '@clickhouse/client';
import { ClickhouseState } from '@sqd-pipes/core';
import { SolanaPumpfunTokensStream, PumpfunTokenCreation } from './stream.js';
import { logger } from './logger.js';

export interface PipeConfig {
  fromBlock: number;
  toBlock?: number;
  portalUrl?: string;
}

export class PumpfunTokensPipe {
  private stream: SolanaPumpfunTokensStream;

  constructor(
    private clickhouse: ClickHouseClient,
    private config: PipeConfig
  ) {
    this.stream = new SolanaPumpfunTokensStream({
      portal: `${config.portalUrl || 'https://portal.sqd.dev'}/datasets/solana-mainnet`,
      blockRange: {
        from: config.fromBlock,
        to: config.toBlock,
      },
      state: new ClickhouseState(clickhouse, {
        table: 'solana_sync_status',
        id: 'solana_pumpfun_token_creation',
      }),
      logger,
    });
  }

  async start() {
    // Create tables if they don't exist
    await this.ensureTables();

    logger.info('Starting PumpFun tokens pipe...');

    for await (const tokens of await this.stream.stream()) {
      if (tokens.length === 0) continue;

      await this.clickhouse.insert({
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

      logger.info(`Inserted ${tokens.length} PumpFun tokens`);
      await this.stream.ack();
    }
  }

  private async ensureTables() {
    const createTableSQL = `
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
    `;

    const createViewSQL = `
      CREATE MATERIALIZED VIEW IF NOT EXISTS solana_pumpfun_tokens_daily
      ENGINE = AggregatingMergeTree()
      PARTITION BY toYYYYMM(creation_time)
      ORDER BY (creation_time)
      AS
      SELECT
          toStartOfDay(creation_time) as creation_time,
          countState() as total_tokens,
          uniqState(symbol) as unique_symbols
      FROM solana_pumpfun_tokens
      GROUP BY creation_time;
    `;

    await this.clickhouse.command({ query: createTableSQL });
    await this.clickhouse.command({ query: createViewSQL });
  }
}

export { PumpfunTokenCreation };
