# Test Dashboard

The PanSou MCP server includes an optional web-based test dashboard that provides real-time monitoring of test execution and status.

## Configuration

The dashboard can be enabled and configured via environment variables:

- `TEST_DASHBOARD_ENABLED`: Set to `true` to enable the dashboard (default: `false`)
- `TEST_DASHBOARD_HOST`: Host to bind the dashboard server (default: `localhost`)
- `TEST_DASHBOARD_PORT`: Port for the dashboard server (default: `3001`)
- `TEST_DASHBOARD_STATIC_PATH`: Optional path to static assets directory (default: built-in HTML)
- `TEST_DASHBOARD_AUTORUN`: Set to `true` to automatically run tests on startup (default: `false`)

## Features

### Web Interface

The dashboard provides a web interface with:
- Real-time test status display
- Progress tracking with visual progress bars
- Test results summary (passed/failed counts)
- Event log with timestamps
- Manual test trigger button

### API Endpoints

- `GET /dashboard/status` - Returns current test status snapshot
- `GET /dashboard/events` - Server-Sent Events stream for real-time updates
- `POST /dashboard/run` - Manually trigger a new test cycle
- `GET /` - Dashboard web interface (if no static path configured)

### SSE Events

The `/dashboard/events` endpoint streams the following events:
- `connected` - Initial connection established
- `statusUpdated` - Test status changed
- `progressUpdated` - Test progress updated
- `testStarted` - New test cycle started
- `testCompleted` - Test cycle completed
- `testFailed` - Test cycle failed

## Usage Examples

### Enable Dashboard
```bash
export TEST_DASHBOARD_ENABLED=true
export TEST_DASHBOARD_PORT=3001
npm start
```

### Enable with Auto-run
```bash
export TEST_DASHBOARD_ENABLED=true
export TEST_DASHBOARD_AUTORUN=true
npm start
```

### Custom Static Assets
```bash
export TEST_DASHBOARD_ENABLED=true
export TEST_DASHBOARD_STATIC_PATH=/path/to/dashboard/assets
npm start
```

## Integration

The dashboard integrates with the existing MCP server infrastructure:

- **TestRunner**: Executes test cases with configurable timeouts and retries
- **TestStatusStore**: Manages state and emits events for real-time updates
- **DashboardServer**: Express-based HTTP server with SSE support
- **Graceful Shutdown**: Properly closes HTTP server on process termination

## Test Cases

The dashboard includes sample test cases for demonstration:
- Connection tests
- Health check tests
- Search functionality tests

These can be extended or replaced with custom test implementations.

## Security Notes

- CORS headers are enabled for cross-origin requests
- No authentication is built-in (add as needed for production)
- Dashboard binds to localhost by default for security
- Consider adding authentication for production deployments