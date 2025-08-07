#!/usr/bin/env ts-node
import { createClient } from '@clickhouse/client';
import { logger } from '../../utils/logger';
import path from 'path';
import fs from 'fs-extra';

/**
 * Migration Script
 * 
 * Run this script to apply database migrations
 * 
 * Usage:
 *   pnpm run migrate
 *   pnpm run migrate:rollback
 *   ts-node sql/scripts/migrate.ts
 * 
 * Environment Variables:
 *   CLICKHOUSE_URL - ClickHouse server URL
 *   CLICKHOUSE_DB - Database name
 *   CLICKHOUSE_USER - Username
 *   CLICKHOUSE_PASSWORD - Password
 */

interface Migration {
  id: string;
  name: string;
  filename: string;
  up: string;
  down: string;
}

interface MigrationRecord {
  id: string;
  name: string;
  applied_at: string;
}

async function main() {
  const command = process.argv[2];
  
  if (command === 'rollback') {
    await rollbackLastMigration();
  } else {
    await runMigrations();
  }
}

async function runMigrations() {
  logger.info('Starting database migrations...');
  
  const clickhouse = await createConnection();
  
  try {
    // Ensure migration tracking table exists
    await ensureMigrationsTable(clickhouse);
    
    // Load migration files
    const migrations = await loadMigrations();
    const appliedMigrations = await getAppliedMigrations(clickhouse);
    
    // Find pending migrations
    const pendingMigrations = migrations.filter(m => 
      !appliedMigrations.some(am => am.id === m.id)
    );
    
    if (pendingMigrations.length === 0) {
      logger.info('No pending migrations');
      return;
    }
    
    logger.info(`Found ${pendingMigrations.length} pending migrations:`);
    pendingMigrations.forEach(m => {
      logger.info(`  ${m.id} - ${m.name}`);
    });
    
    // Apply migrations
    for (const migration of pendingMigrations) {
      logger.info(`Applying migration ${migration.id} - ${migration.name}...`);
      
      try {
        await clickhouse.exec({ query: migration.up });
        await recordMigration(clickhouse, migration);
        logger.info(`✓ Applied ${migration.id}`);
      } catch (error) {
        logger.error(`✗ Failed to apply ${migration.id}:`, error);
        process.exit(1);
      }
    }
    
    logger.info('All migrations applied successfully');
    
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

async function rollbackLastMigration() {
  logger.info('Rolling back last migration...');
  
  const clickhouse = await createConnection();
  
  try {
    await ensureMigrationsTable(clickhouse);
    
    const appliedMigrations = await getAppliedMigrations(clickhouse);
    
    if (appliedMigrations.length === 0) {
      logger.info('No migrations to rollback');
      return;
    }
    
    // Get the last applied migration
    const lastMigration = appliedMigrations[appliedMigrations.length - 1];
    const migrations = await loadMigrations();
    const migrationToRollback = migrations.find(m => m.id === lastMigration.id);
    
    if (!migrationToRollback) {
      logger.error(`Migration file not found for ${lastMigration.id}`);
      process.exit(1);
    }
    
    logger.info(`Rolling back ${migrationToRollback.id} - ${migrationToRollback.name}...`);
    
    try {
      await clickhouse.exec({ query: migrationToRollback.down });
      await removeMigrationRecord(clickhouse, migrationToRollback.id);
      logger.info(`✓ Rolled back ${migrationToRollback.id}`);
    } catch (error) {
      logger.error(`✗ Failed to rollback ${migrationToRollback.id}:`, error);
      process.exit(1);
    }
    
  } catch (error) {
    logger.error('Rollback failed:', error);
    process.exit(1);
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

async function ensureMigrationsTable(clickhouse: any) {
  await clickhouse.exec({
    query: `
      CREATE TABLE IF NOT EXISTS _migrations (
        id String,
        name String,
        applied_at DateTime DEFAULT now()
      ) ENGINE = MergeTree()
      ORDER BY applied_at
    `
  });
}

async function loadMigrations(): Promise<Migration[]> {
  const migrationsDir = path.join(__dirname, '../migrations');
  
  if (!await fs.pathExists(migrationsDir)) {
    logger.info('No migrations directory found, creating example migration...');
    await createExampleMigration(migrationsDir);
  }
  
  const files = await fs.readdir(migrationsDir);
  const migrationFiles = files
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  const migrations: Migration[] = [];
  
  for (const filename of migrationFiles) {
    const filePath = path.join(migrationsDir, filename);
    const content = await fs.readFile(filePath, 'utf8');
    
    // Parse migration file (expects -- UP and -- DOWN sections)
    const sections = content.split(/^--\s*(UP|DOWN)\s*$/m);
    
    if (sections.length < 3) {
      logger.warn(`Invalid migration format in ${filename}, skipping`);
      continue;
    }
    
    const id = filename.replace('.sql', '');
    const name = extractMigrationName(filename);
    const up = sections[2].trim();
    const down = sections[4]?.trim() || '';
    
    migrations.push({ id, name, filename, up, down });
  }
  
  return migrations;
}

async function getAppliedMigrations(clickhouse: any): Promise<MigrationRecord[]> {
  const result = await clickhouse.query({
    query: 'SELECT id, name, applied_at FROM _migrations ORDER BY applied_at',
    format: 'JSONEachRow'
  });
  
  return await result.json();
}

async function recordMigration(clickhouse: any, migration: Migration) {
  await clickhouse.exec({
    query: `
      INSERT INTO _migrations (id, name) 
      VALUES ('${migration.id}', '${migration.name}')
    `
  });
}

async function removeMigrationRecord(clickhouse: any, migrationId: string) {
  await clickhouse.exec({
    query: `DELETE FROM _migrations WHERE id = '${migrationId}'`
  });
}

function extractMigrationName(filename: string): string {
  // Extract name from filename like "001_create_initial_views.sql"
  const parts = filename.replace('.sql', '').split('_');
  return parts.slice(1).join('_').replace(/_/g, ' ');
}

async function createExampleMigration(migrationsDir: string) {
  await fs.ensureDir(migrationsDir);
  
  const exampleMigration = `-- UP
-- Example: Transaction count per block per hour
-- (Assumes a transactions table exists with block_id and timestamp columns)
CREATE MATERIALIZED VIEW IF NOT EXISTS transactions_per_block_hourly
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

-- DOWN
DROP VIEW IF EXISTS transactions_per_block_hourly;
`;

  await fs.writeFile(
    path.join(migrationsDir, '001_create_initial_views.sql'),
    exampleMigration
  );
  
  logger.info('Created example migration: 001_create_initial_views.sql');
}

// Run the migration system
main().catch((error) => {
  logger.error('Migration failed:', error);
  process.exit(1);
});
