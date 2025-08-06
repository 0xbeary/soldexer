import { NodeClickHouseClient } from '@clickhouse/client/dist/client'
import { ClickHouseClient, createClient } from '@clickhouse/client'
import { pumpfunTokenCreationIndexer } from './pipes/pumpfun-tokens'
import { logger } from './utils/logger'
import { retry } from './utils/retry'

export interface PipeConfig {
  fromBlock: number;
  toBlock?: number;
  clickhouse: ClickHouseClient;
  portalUrl: string;
}

// Configuration - no external config file needed
const portalUrl = 'https://portal.sqd.dev'

const clickhouseConfig = {
  url: 'http://localhost:8123',
  database: 'default',
  username: 'default',
  password: ''
}
  

export type IndexerFunction = (portalUrl: string, clickhouse: NodeClickHouseClient, config: PipeConfig) => Promise<void>

async function main() {
  
  const pumpfunPipeConfig: PipeConfig = {
    fromBlock: 332557468,
    clickhouse:  clickhouseConfig,
    portalUrl
  }

  logger.info('Starting Soldexer with pumpfun-tokens pipe')

  // Create ClickHouse client
  const clickhouse = createClient({
    url: clickhouseConfig.url,
    database: clickhouseConfig.database,
    username: clickhouseConfig.username,
    password: clickhouseConfig.password,
    clickhouse_settings: {
      date_time_input_format: 'best_effort',
    },
  })

  // Run the pumpfun-tokens indexer
  await retry(() => pumpfunTokenCreationIndexer(portalUrl, clickhouse, pipeConfig))
}

void main()
