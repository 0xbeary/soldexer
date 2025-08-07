import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createClient } from '@clickhouse/client';
import { logger } from './utils/logger';
import { ensureTables } from './utils/database';
import path from 'path';

/**
 * ClickHouse API Server with Schema Management
 * 
 * This Hono server provides:
 * 1. REST API endpoints for frontend apps to query ClickHouse
 * 2. Schema sync functionality for materialized views
 * 3. Real-time data endpoints optimized for frontend consumption
 */

const app = new Hono();

// Enable CORS for frontend apps
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'], // Add your frontend URLs
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}));

// Global ClickHouse client
const clickhouse = createClient({
  url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
  database: process.env.CLICKHOUSE_DB || 'default',
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  clickhouse_settings: {
    date_time_input_format: 'best_effort',
  },
});

// =============================================================================
// SCHEMA MANAGEMENT ENDPOINTS
// =============================================================================

app.post('/schema/sync', async (c) => {
  try {
    logger.info('Syncing schema with database...');
    await ensureTables(clickhouse, path.join(__dirname, '../schema.sql'));
    
    const validation = await validateSchema(clickhouse);
    
    return c.json({
      success: true,
      message: 'Schema synced successfully',
      materialized_views: validation.materializedViews,
      regular_views: validation.regularViews,
    });
  } catch (error) {
    logger.error('Schema sync failed:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.get('/schema/status', async (c) => {
  try {
    const validation = await validateSchema(clickhouse);
    return c.json({
      success: true,
      materialized_views: validation.materializedViews,
      regular_views: validation.regularViews,
      total_tables: validation.totalTables,
    });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// =============================================================================
// PUMPFUN TOKEN ENDPOINTS
// =============================================================================

// Latest tokens (real-time feed)
app.get('/tokens/latest', async (c) => {
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = parseInt(c.req.query('offset') || '0');
  
  try {
    const result = await clickhouse.query({
      query: `
        SELECT name, symbol, address, metadata_uri, creation_time
        FROM solana_pumpfun_tokens
        ORDER BY creation_time DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      format: 'JSONEachRow'
    });
    
    const tokens = await result.json();
    return c.json({ tokens, count: tokens.length });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Daily stats from materialized view
app.get('/tokens/stats/daily', async (c) => {
  const days = parseInt(c.req.query('days') || '30');
  
  try {
    const result = await clickhouse.query({
      query: `
        SELECT date, tokens_created, unique_symbols, first_letter_diversity
        FROM pumpfun_daily_stats
        WHERE date >= today() - INTERVAL ${days} DAY
        ORDER BY date DESC
      `,
      format: 'JSONEachRow'
    });
    
    const stats = await result.json();
    return c.json({ stats, days });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Hourly stats for real-time dashboards
app.get('/tokens/stats/hourly', async (c) => {
  const hours = parseInt(c.req.query('hours') || '24');
  
  try {
    const result = await clickhouse.query({
      query: `
        SELECT hour, tokens_created, unique_symbols, avg_name_length
        FROM pumpfun_hourly_stats
        WHERE hour >= now() - INTERVAL ${hours} HOUR
        ORDER BY hour DESC
      `,
      format: 'JSONEachRow'
    });
    
    const stats = await result.json();
    return c.json({ stats, hours });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Search tokens
app.get('/tokens/search', async (c) => {
  const query = c.req.query('q');
  const limit = parseInt(c.req.query('limit') || '10');
  
  if (!query) {
    return c.json({ error: 'Query parameter "q" is required' }, 400);
  }
  
  try {
    const result = await clickhouse.query({
      query: `
        SELECT name, symbol, address, metadata_uri, creation_time
        FROM solana_pumpfun_tokens
        WHERE name ILIKE '%${query}%' OR symbol ILIKE '%${query}%'
        ORDER BY creation_time DESC
        LIMIT ${limit}
      `,
      format: 'JSONEachRow'
    });
    
    const tokens = await result.json();
    return c.json({ tokens, query, count: tokens.length });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// =============================================================================
// HEALTH CHECK
// =============================================================================

app.get('/health', async (c) => {
  try {
    await clickhouse.ping();
    return c.json({ status: 'healthy', clickhouse: 'connected' });
  } catch (error) {
    return c.json({ status: 'unhealthy', clickhouse: 'disconnected', error: error.message }, 500);
  }
});

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'ClickHouse API Server',
    version: '1.0.0',
    endpoints: {
      schema: ['/schema/sync', '/schema/status'],
      tokens: ['/tokens/latest', '/tokens/stats/daily', '/tokens/stats/hourly', '/tokens/search'],
      health: '/health'
    }
  });
});

async function startServer() {
  const port = parseInt(process.env.PORT || '3001');
  
  logger.info('Starting ClickHouse API Server...');
  
  // Initial schema sync on startup
  try {
    await ensureTables(clickhouse, path.join(__dirname, '../schema.sql'));
    logger.info('✅ Initial schema sync completed');
  } catch (error) {
    logger.warn('⚠️ Initial schema sync failed:', error);
  }
  
  logger.info(`🚀 Server running on http://localhost:${port}`);
  
  return {
    port,
    fetch: app.fetch,
  };
}

async function validateSchema(clickhouse: any) {
  logger.info('Validating schema...');
  
  try {
    // Check if materialized views were created
    const views = await clickhouse.query({
      query: `
        SELECT name, engine 
        FROM system.tables 
        WHERE database = currentDatabase() 
        AND engine LIKE '%MaterializedView%'
      `,
      format: 'JSONEachRow'
    });
    
    const viewList = await views.json();
    logger.info(`Found ${viewList.length} materialized views:`);
    viewList.forEach((view: any) => {
      logger.info(`  - ${view.name} (${view.engine})`);
    });
    
    // Check if regular views were created
    const regularViews = await clickhouse.query({
      query: `
        SELECT name 
        FROM system.tables 
        WHERE database = currentDatabase() 
        AND engine = 'View'
      `,
      format: 'JSONEachRow'
    });
    
    const regularViewList = await regularViews.json();
    logger.info(`Found ${regularViewList.length} regular views:`);
    regularViewList.forEach((view: any) => {
      logger.info(`  - ${view.name}`);
    });
    
    // Get total tables count
    const tablesResult = await clickhouse.query({
      query: `SELECT count() as total FROM system.tables WHERE database = currentDatabase()`,
      format: 'JSONEachRow'
    });
    const tablesData = await tablesResult.json();
    const totalTables = tablesData[0]?.total || 0;
    
    logger.info('✅ Schema validation completed');
    
    return {
      materializedViews: viewList,
      regularViews: regularViewList,
      totalTables
    };
    
  } catch (error) {
    logger.warn('⚠️  Schema validation failed:', error);
    return {
      materializedViews: [],
      regularViews: [],
      totalTables: 0
    };
  }
}

// =============================================================================
// SERVER STARTUP
// =============================================================================

async function startServerAsync() {
  try {
    const { serve } = await import('@hono/node-server');
    const serverConfig = await startServer();
    
    serve({
      fetch: serverConfig.fetch,
      port: serverConfig.port,
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Run as server if this file is executed directly
if (require.main === module) {
  startServerAsync();
}

export { app, startServer };
