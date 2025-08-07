import { NodeClickHouseClient } from '@clickhouse/client/dist/client'
import { ClickHouseClient, createClient } from '@clickhouse/client'
// import { pumpfunTokenCreationIndexer } from './pipes/pumpfun-tokens'
import { logger } from './utils/logger'
import { retry } from './utils/retry'

async function main() {
  
  logger.info('Starting indexer with pipes')
  logger.info('(Dont forget to install pipes and add them to the main.ts file!)')


  // Configuration
  const portalUrl = 'https://portal.sqd.dev'

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


  // Run your pipes here
  // await Promise.all([
  //   retry(() => pumpfunTokenCreationIndexer({
  //     fromBlock: pumpfunTokenCreationIndexer.defaults.fromBlock,
  //     clickhouse: clickhouse,
  //     portalUrl
  // })),
  //   retry(() => anotherPipeIndexer({
  //     fromBlock: 400000000,
  //     clickhouse: clickhouse,
  //     portalUrl
  // }))
// ])
}

void main()
