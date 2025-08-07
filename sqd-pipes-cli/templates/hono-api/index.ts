import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createClient } from '@clickhouse/client';
import { logger } from './utils/logger';

const app = new Hono();

// Enable CORS
app.use('*', cors());

// ClickHouse client
const clickhouse = createClient({
  url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
  database: process.env.CLICKHOUSE_DB || 'default',
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
});

// Health check endpoint
app.get('/health', async (c) => {
  try {
    await clickhouse.ping();
    return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    return c.json({ status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'Hono API Server',
    description: 'Real-time ClickHouse data streaming via SSE',
    endpoints: {
      '/': 'API information',
      '/health': 'Health check',
      '/events': 'Server-Sent Events stream',
      '/demo': 'Interactive SSE demo'
    },
    timestamp: new Date().toISOString()
  });
});

// Server-Sent Events endpoint
app.get('/events', async (c) => {
  return c.newResponse(
    new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        
        // Send connection message
        controller.enqueue(encoder.encode('data: {"type":"connected","message":"SSE stream connected"}\n\n'));
        
        let lastCheck = Date.now();
        
        const poll = async () => {
          try {
            // Example: Query for recent data from materialized views
            const result = await clickhouse.query({
              query: `
                SELECT *
                FROM (
                  SELECT 'pumpfun_tokens' as source, name, symbol, creation_time as timestamp
                  FROM solana_pumpfun_tokens
                  WHERE creation_time > '${new Date(lastCheck).toISOString()}'
                  ORDER BY creation_time DESC
                  LIMIT 5
                )
                ORDER BY timestamp DESC
              `,
              format: 'JSONEachRow'
            });
            
            const data = await result.json();
            
            if (data.length > 0) {
              // Send new data to client
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'data',
                payload: data,
                timestamp: new Date().toISOString()
              })}\n\n`));
              
              lastCheck = Date.now();
            }
            
          } catch (error) {
            logger.error('SSE polling error:', error);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              message: 'Database query failed'
            })}\n\n`));
          }
        };
        
        // Poll every 3 seconds
        const interval = setInterval(poll, 3000);
        
        // Initial poll
        poll();
        
        // Cleanup on close
        return () => {
          clearInterval(interval);
        };
      }
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
});

// Demo page
app.get('/demo', async (c) => {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SSE Demo - Real-time Data Stream</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            .status { padding: 10px; border-radius: 5px; margin: 10px 0; }
            .connected { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .disconnected { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
            .data-item { background: #e7f3ff; border: 1px solid #b3d7ff; padding: 10px; margin: 5px 0; border-radius: 3px; }
            .timestamp { font-size: 0.8em; color: #666; }
            #log { height: 400px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; background: #f8f9fa; }
            button { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 5px; }
            button:disabled { background: #6c757d; cursor: not-allowed; }
            pre { background: #f1f1f1; padding: 10px; border-radius: 3px; overflow-x: auto; }
        </style>
    </head>
    <body>
        <h1>Real-time SSE Demo</h1>
        <p>This demo connects to the <code>/events</code> endpoint and displays real-time data from ClickHouse.</p>
        
        <div id="status" class="status disconnected">Connecting...</div>
        
        <div>
            <button id="connect" onclick="connect()">Connect</button>
            <button id="disconnect" onclick="disconnect()" disabled>Disconnect</button>
            <button onclick="clearLog()">Clear Log</button>
        </div>
        
        <h3>Live Data Stream</h3>
        <div id="log"></div>
        
        <h3>JavaScript Code</h3>
        <pre><code>const eventSource = new EventSource('/events');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('New data:', data);
};

eventSource.onerror = () => {
  console.log('Connection lost - will reconnect automatically');
};</code></pre>
        
        <script>
            let eventSource = null;
            const log = document.getElementById('log');
            const status = document.getElementById('status');
            const connectBtn = document.getElementById('connect');
            const disconnectBtn = document.getElementById('disconnect');
            
            function addToLog(message, type = 'info') {
                const div = document.createElement('div');
                const timestamp = new Date().toLocaleTimeString();
                div.innerHTML = \`<div class="timestamp">[\${timestamp}] \${type.toUpperCase()}</div><div>\${message}</div>\`;
                div.className = 'data-item';
                log.appendChild(div);
                log.scrollTop = log.scrollHeight;
            }
            
            function updateStatus(connected) {
                if (connected) {
                    status.textContent = 'Connected to SSE stream';
                    status.className = 'status connected';
                    connectBtn.disabled = true;
                    disconnectBtn.disabled = false;
                } else {
                    status.textContent = 'Disconnected';
                    status.className = 'status disconnected';
                    connectBtn.disabled = false;
                    disconnectBtn.disabled = true;
                }
            }
            
            function connect() {
                if (eventSource) return;
                
                addToLog('Connecting to /events...', 'info');
                eventSource = new EventSource('/events');
                
                eventSource.onopen = () => {
                    updateStatus(true);
                    addToLog('SSE connection established', 'success');
                };
                
                eventSource.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'connected') {
                            addToLog(\`Connected: \${data.message}\`, 'success');
                        } else if (data.type === 'data') {
                            addToLog(\`New data (\${data.payload.length} items): \${JSON.stringify(data.payload, null, 2)}\`, 'data');
                        } else if (data.type === 'error') {
                            addToLog(\`Error: \${data.message}\`, 'error');
                        }
                    } catch (e) {
                        addToLog(\`Raw message: \${event.data}\`, 'raw');
                    }
                };
                
                eventSource.onerror = () => {
                    addToLog('Connection error - EventSource will auto-reconnect', 'error');
                };
            }
            
            function disconnect() {
                if (eventSource) {
                    eventSource.close();
                    eventSource = null;
                    updateStatus(false);
                    addToLog('Disconnected by user', 'info');
                }
            }
            
            function clearLog() {
                log.innerHTML = '';
            }
            
            // Auto-connect on page load
            connect();
        </script>
    </body>
    </html>
  `;
  
  return c.html(html);
});

// Start server
async function startServer() {
  const port = parseInt(process.env.PORT || '3001');
  
  logger.info('Starting Hono API Server...');
  
  try {
    // Test ClickHouse connection
    await clickhouse.ping();
    logger.info('ClickHouse connection established');
  } catch (error) {
    logger.warn('ClickHouse connection failed:', error);
  }
  
  serve({
    fetch: app.fetch,
    port,
  });
  
  logger.info(`Server running on http://localhost:${port}`);
  logger.info('SSE endpoint available at /events');
  logger.info('Demo available at /demo');
}

// Run if this file is executed directly
if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}
