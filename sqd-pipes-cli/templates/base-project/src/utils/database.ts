import fs from 'node:fs/promises'
import path from 'node:path'
import * as process from 'node:process'
import { ClickHouseClient } from '@clickhouse/client'
import { logger } from './logger'

export async function loadSqlFiles(directoryOrFile: string): Promise<string[]> {
  let sqlFiles: string[] = []

  if (directoryOrFile.endsWith('.sql')) {
    sqlFiles = [directoryOrFile]
  } else {
    const files = await fs.readdir(directoryOrFile)
    sqlFiles = files.filter((file) => path.extname(file) === '.sql').map((file) => path.join(directoryOrFile, file))
  }

  const tables = await Promise.all(sqlFiles.map((file) => fs.readFile(file, 'utf-8')))

  return tables.flatMap((table) => table.split(';').filter((t) => t.trim().length > 0))
}

export async function ensureTables(clickhouse: ClickHouseClient, dir: string) {
  const tables = await loadSqlFiles(dir)

  for (const table of tables) {
    try {
      logger.info(`Executing SQL: ${table.trim().substring(0, 80)}...`)
      await clickhouse.command({ query: table })
    } catch (e: any) {
      logger.error(`======================`)
      logger.error(table.trim())
      logger.error(`======================`)
      logger.error(`Failed to execute SQL: ${e.message}`)
      if (!e.message) logger.error(e)

      // Don't exit on schema errors - some views might fail if base tables don't exist yet
      logger.warn('Continuing with next SQL statement...')
    }
  }
}
