#!/usr/bin/env ts-node
import { createClient } from '@clickhouse/client';
import { logger } from '../../utils/logger';
import path from 'path';
import fs from 'fs-extra';

/**
 * View Sync Script
 * 
 * Run this script to sync all view types from .sql files in the views/ folder
 * Supports: Regular Views, Materialized Views, Live Views, Window Views
 * 
 * Usage:
 *   pnpm run sync
 *   ts-node sql/scripts/sync.ts
 * 
 * Environment Variables:
 *   CLICKHOUSE_URL - ClickHouse server URL
 *   CLICKHOUSE_DB - Database name
 *   CLICKHOUSE_USER - Username
 *   CLICKHOUSE_PASSWORD - Password
 */

async function main() {
  logger.info('Syncing all view types...');
  
  const clickhouse = await createConnection();
  
  try {
    // Find all .sql files in views/ folder
    const sqlFiles = await findSqlFiles();
    
    if (sqlFiles.length === 0) {
      logger.info('No .sql files found in views/ folder');
      await createExampleFiles();
      return;
    }
    
    logger.info(`Found ${sqlFiles.length} SQL files to sync`);
    
    // Process each file
    for (const file of sqlFiles) {
      await processSqlFile(clickhouse, file);
    }
    
    logger.info('Sync completed successfully');
    
  } catch (error) {
    logger.error('Sync failed:', error);
    process.exit(1);
  }
}

async function processSqlFile(clickhouse: any, filePath: string) {
  const filename = path.basename(filePath);
  logger.info(`Processing ${filename}...`);
  
  const content = await fs.readFile(filePath, 'utf8');
  
  // First, extract all view names and drop them
  await dropExistingViews(clickhouse, content);
  
  // Then execute all statements
  const statements = content
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  for (const statement of statements) {
    if (statement.trim().length === 0) continue;
    
    try {
      await clickhouse.exec({ query: statement });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Statement in ${filename} failed:`, errorMessage);
      logger.error(`Statement was: ${statement.substring(0, 100)}...`);
      throw error; // Stop on errors since we're doing clean recreates
    }
  }
  
  logger.info(`✓ Processed ${filename}`);
}

async function dropExistingViews(clickhouse: any, content: string) {
  // Extract all view types from CREATE statements
  const materializedViewRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?MATERIALIZED\s+VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi;
  const liveViewRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?LIVE\s+VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi;
  const windowViewRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?WINDOW\s+VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi;
  const regularViewRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi;
  
  const viewNames: string[] = [];
  
  // Find all view types
  let match;
  
  // Materialized views
  while ((match = materializedViewRegex.exec(content)) !== null) {
    viewNames.push(match[1]);
  }
  
  // Live views (experimental)
  while ((match = liveViewRegex.exec(content)) !== null) {
    viewNames.push(match[1]);
  }
  
  // Window views (experimental)
  while ((match = windowViewRegex.exec(content)) !== null) {
    viewNames.push(match[1]);
  }
  
  // Regular views
  while ((match = regularViewRegex.exec(content)) !== null) {
    viewNames.push(match[1]);
  }
  
  // Drop all views (reverse order to handle potential dependencies)
  for (const viewName of viewNames.reverse()) {
    try {
      logger.info(`Dropping existing view: ${viewName}`);
      await clickhouse.exec({ 
        query: `DROP VIEW IF EXISTS ${viewName}` 
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`Failed to drop ${viewName} (might not exist):`, errorMessage);
    }
  }
  
  if (viewNames.length > 0) {
    logger.info(`Dropped ${viewNames.length} existing views (all types)`);
  }
}

async function createConnection() {
  const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    database: process.env.CLICKHOUSE_DB || 'default',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    clickhouse_settings: {
      date_time_input_format: 'best_effort',
    },
  });

  // Test connection
  await clickhouse.ping();
  logger.info('ClickHouse connection established');
  
  return clickhouse;
}

async function findSqlFiles(): Promise<string[]> {
  const viewsDir = path.join(__dirname, '../views');
  const files: string[] = [];
  
  // Check if views directory exists
  if (!await fs.pathExists(viewsDir)) {
    return [];
  }
  
  // Look for .sql files in views directory
  const entries = await fs.readdir(viewsDir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(viewsDir, entry.name);
    
    if (entry.isFile() && entry.name.endsWith('.sql')) {
      files.push(fullPath);
    } else if (entry.isDirectory()) {
      // Check subdirectories for .sql files (organized views)
      const subFiles = await findSqlFilesInDir(fullPath);
      files.push(...subFiles);
    }
  }
  
  return files.sort();
}

async function findSqlFilesInDir(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isFile() && entry.name.endsWith('.sql')) {
      files.push(fullPath);
    } else if (entry.isDirectory()) {
      const subFiles = await findSqlFilesInDir(fullPath);
      files.push(...subFiles);
    }
  }
  
  return files;
}

async function createExampleFiles() {
  const viewsDir = path.join(__dirname, '../views');
  await fs.ensureDir(viewsDir);
  
  // Create example materialized view
  const materializedViewContent = `-- Materialized View Example
-- Stores aggregated data physically for fast queries
CREATE MATERIALIZED VIEW transactions_per_block_hourly
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (hour, block_id)
POPULATE
AS SELECT
    toStartOfHour(timestamp) as hour,
    block_id,
    count() as transaction_count
FROM transactions
GROUP BY hour, block_id;
`;

  // Create example regular view
  const regularViewContent = `-- Regular View Example  
-- Virtual view that queries data on-demand
CREATE VIEW latest_transactions
AS SELECT 
    block_id,
    timestamp,
    hash,
    amount
FROM transactions 
ORDER BY timestamp DESC
LIMIT 100;
`;

  // Create example live view (experimental)
  const liveViewContent = `-- Live View Example (Experimental)
-- Auto-updates as source data changes
CREATE LIVE VIEW live_transaction_rate
AS SELECT 
    toStartOfMinute(now()) as minute,
    count() as transactions_last_minute
FROM transactions 
WHERE timestamp >= now() - INTERVAL 1 MINUTE;
`;

  // Create example window view (experimental)  
  const windowViewContent = `-- Window View Example (Experimental)
-- Time-based sliding window aggregations
CREATE WINDOW VIEW hourly_transaction_window
ENGINE = SummingMergeTree
ORDER BY (window_start, block_id)
WATERMARK = ASCENDING
AS SELECT
    tumbleStart(wid) as window_start,
    tumbleEnd(wid) as window_end,
    block_id,
    count() as transaction_count
FROM transactions
GROUP BY tumble(timestamp, INTERVAL '1' HOUR) as wid, block_id;
`;

  // Write example files
  await fs.writeFile(path.join(viewsDir, 'materialized_views.sql'), materializedViewContent);
  await fs.writeFile(path.join(viewsDir, 'regular_views.sql'), regularViewContent);
  await fs.writeFile(path.join(viewsDir, 'live_views.sql'), liveViewContent);
  await fs.writeFile(path.join(viewsDir, 'window_views.sql'), windowViewContent);
  
  logger.info('Created example view files in views/ directory');
  logger.info('- materialized_views.sql (stores data)');
  logger.info('- regular_views.sql (virtual views)');  
  logger.info('- live_views.sql (experimental - auto-updating)');
  logger.info('- window_views.sql (experimental - time windows)');
}

// Run the sync
main().catch((error) => {
  logger.error('Sync failed:', error);
  process.exit(1);
});
