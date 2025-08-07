#!/usr/bin/env ts-node
import { createClient } from '@clickhouse/client';
import { logger } from '../src/utils/logger';
import { ensureTables } from '../src/utils/database';
import path from 'path';

/**
 * Schema Sync Script
 * 
 * Run this script to sync your schema.sql file with the ClickHouse database
 * 
 * Usage:
 *   pnpm run schema:sync
 *   ts-node scripts/sync-schema.ts
 * 
 * Environment Variables:
 *   CLICKHOUSE_URL - ClickHouse server URL
 *   CLICKHOUSE_DB - Database name
 *   CLICKHOUSE_USER - Username
 *   CLICKHOUSE_PASSWORD - Password
 */

async function syncSchema() {
  logger.info('🔄 Starting schema sync...');
  
  // Create ClickHouse client
  const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    database: process.env.CLICKHOUSE_DB || 'default',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    clickhouse_settings: {
      date_time_input_format: 'best_effort',
    },
  });

  try {
    // Test connection first
    await clickhouse.ping();
    logger.info('✅ ClickHouse connection established');
    
    // Apply schema from schema.sql
    const schemaPath = path.join(__dirname, '../schema.sql');
    await ensureTables(clickhouse, schemaPath);
    
    logger.info('✅ Schema sync completed successfully');
    
    // Validate what was created
    await validateSchema(clickhouse);
    
  } catch (error) {
    logger.error('❌ Schema sync failed:', error);
    process.exit(1);
  }
}

async function validateSchema(clickhouse: any) {
  logger.info('📋 Validating schema...');
  
  try {
    // Check materialized views
    const mvResult = await clickhouse.query({
      query: `
        SELECT name, engine 
        FROM system.tables 
        WHERE database = currentDatabase() 
        AND engine LIKE '%MaterializedView%'
        ORDER BY name
      `,
      format: 'JSONEachRow'
    });
    
    const materializedViews = await mvResult.json();
    
    if (materializedViews.length > 0) {
      logger.info(`📊 Found ${materializedViews.length} materialized views:`);
      materializedViews.forEach((view: any) => {
        logger.info(`  ✓ ${view.name} (${view.engine})`);
      });
    } else {
      logger.info('📊 No materialized views found');
    }
    
    // Check regular views
    const viewResult = await clickhouse.query({
      query: `
        SELECT name 
        FROM system.tables 
        WHERE database = currentDatabase() 
        AND engine = 'View'
        ORDER BY name
      `,
      format: 'JSONEachRow'
    });
    
    const regularViews = await viewResult.json();
    
    if (regularViews.length > 0) {
      logger.info(`👁️  Found ${regularViews.length} regular views:`);
      regularViews.forEach((view: any) => {
        logger.info(`  ✓ ${view.name}`);
      });
    } else {
      logger.info('👁️  No regular views found');
    }
    
    // Check indexes
    const indexResult = await clickhouse.query({
      query: `
        SELECT table, name, type
        FROM system.data_skipping_indices
        WHERE database = currentDatabase()
        ORDER BY table, name
      `,
      format: 'JSONEachRow'
    });
    
    const indexes = await indexResult.json();
    
    if (indexes.length > 0) {
      logger.info(`🗂️  Found ${indexes.length} indexes:`);
      indexes.forEach((index: any) => {
        logger.info(`  ✓ ${index.table}.${index.name} (${index.type})`);
      });
    } else {
      logger.info('🗂️  No custom indexes found');
    }
    
    logger.info('✅ Schema validation completed');
    
  } catch (error) {
    logger.warn('⚠️  Schema validation failed:', error);
  }
}

// Run the schema sync
syncSchema().catch((error) => {
  logger.error('Schema sync failed:', error);
  process.exit(1);
});
