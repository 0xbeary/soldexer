import fs from 'node:fs'
import path from 'node:path'
import { NodeClickHouseClient } from '@clickhouse/client/dist/client'
import { createClickhouseClient } from './db/clickhouse'
import { metaplexIndexer } from './indexers/metaplex'
// import { pumpfunBondingCurveSwapsIndexer, pumpfunTokenCreationIndexer } from './indexers/pumpfun'
import { pumpfunTokenCreationIndexer } from './pipes/pumpfun-tokens'
import { swapsIndexer } from './indexers/swaps'
import { logger } from './utils'
import { retry } from './utils/retry'

type Pipes = 'swaps' | 'metaplex' | 'pumpfun-tokens' //| 'pumpfun.token-creation' | 'pumpfun.bonding-curve-swaps'

export interface PipeConfig {
  fromBlock: number
  toBlock?: number
}

export interface ClickhouseConfig {
  database: string
  url: string
  username: string
  password: string
}

export interface SoldexerConfig {
  portalUrl: string
  pipes: Record<Pipes, PipeConfig>
  clickhouse?: ClickhouseConfig
}

export type IndexerFunction = (portalUrl: string, clickhouse: NodeClickHouseClient, config: PipeConfig) => Promise<void>

const indexersMap: Record<Pipes, IndexerFunction> = {
  swaps: swapsIndexer,
  metaplex: metaplexIndexer,
  'pumpfun-tokens': pumpfunTokenCreationIndexer,
  // 'pumpfun.token-creation': pumpfunTokenCreationIndexer,
  // 'pumpfun.bonding-curve-swaps': pumpfunBondingCurveSwapsIndexer,
}

async function main() {
  const configPath = path.join(__dirname, '../soldexer.json')
  const rawConfig = fs.readFileSync(configPath, 'utf-8')
  const config: SoldexerConfig = JSON.parse(rawConfig)
  const pipes: Pipes[] = Object.keys(config.pipes) as Pipes[]

  if (pipes.length === 0) {
    logger.error('No pipes configured in config.json')
    process.exit(1)
  }

  logger.info(`Starting Soldexer with pipes: ${pipes.join(', ')}`)

  const clickhouse = createClickhouseClient({
    url: config.clickhouse?.url || 'http://localhost:8123',
    database: config.clickhouse?.database || 'default',
    username: config.clickhouse?.username || 'default',
    password: config.clickhouse?.password || '',
  })

  await Promise.all(
    pipes.map(async (pipe) => {
      const pipeConfig = config.pipes[pipe]
      const portalUrl = config.portalUrl || 'https://portal.sqd.dev'

      if (!indexersMap[pipe]) {
        logger.error(`No indexer found for pipe: ${pipe}`)
        return
      }

      await retry(() => indexersMap[pipe](portalUrl, clickhouse, pipeConfig))
    }),
  )
}

void main()
