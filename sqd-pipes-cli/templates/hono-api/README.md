# Hono API Server with Server-Sent Events

Real-time API server built with Hono framework for streaming ClickHouse data via Server-Sent Events (SSE).

## Quick Start

```bash
# Install dependencies
pnpm install

# Set environment variables
export CLICKHOUSE_URL=http://localhost:8123
export CLICKHOUSE_DB=default
export PORT=3001

# Start the server
pnpm start

# Development mode with auto-reload
pnpm run dev
```

Server runs on `http://localhost:3001` by default.

## Server-Sent Events

### Basic Usage

```javascript
// Connect to real-time stream
const eventSource = new EventSource('/events');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'data') {
    console.log('New data:', data.payload);
    // Update your UI with fresh data
  }
};

eventSource.onerror = () => {
  console.log('Connection lost - will reconnect automatically');
};
```

### Live Demo

Visit `/demo` for a working SSE example that shows real-time data updates.

## API Endpoints

- `GET /` - API information
- `GET /events` - **SSE stream** for real-time data
- `GET /health` - Health check  
- `GET /demo` - Interactive SSE demo

## Configuration

Environment variables:

- `PORT` - Server port (default: 3001)  
- `CLICKHOUSE_URL` - ClickHouse URL (default: http://localhost:8123)
- `CLICKHOUSE_DB` - Database name (default: default)
- `CLICKHOUSE_USER` - Username (default: default)
- `CLICKHOUSE_PASSWORD` - Password (default: empty)

## Perfect For

- Live dashboards
- Real-time monitoring  
- Event streams
- Financial data feeds
- IoT telemetry

The SSE approach is lightweight, auto-reconnecting, and perfect for one-way real-time data streaming!
