import { NodeClickHouseClient } from '@clickhouse/client/dist/client'
import { ClickHouseClient, createClient } from '@clickhouse/client'
// import { pumpfunTokenCreationIndexer } from './pipes/pumpfun-tokens'
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

export type IndexerFunction = (portalUrl: string, clickhouse: NodeClickHouseClient, config: PipeConfig) => Promise<void>

async function main() {
  
  logger.info('Starting indexer with pipes')
  logger.info('(Dont forget to install pipes and add them to the main.ts file!)')

  // Create ClickHouse client
  const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    database: process.env.CLICKHOUSE_DB || 'default',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    clickhouse_settings: {
      date_time_input_format: 'best_effort',
    },
  })

  // Example pipe configuration
  // const pumpfunPipeConfig: PipeConfig = {
  //   fromBlock: 332557468,
  //   clickhouse: clickhouse,
  //   portalUrl
  // }

  // Run your pipes here
  // await retry(() => pumpfunTokenCreationIndexer(pumpfunPipeConfig))
}

void main()
