# Test Dashboard API Reference

This document describes the API patterns and data structures for integrating the test dashboard module into your application.

## Table of Contents

- [Overview](#overview)
- [Status Endpoint](#status-endpoint)
- [SSE (Server-Sent Events) Endpoint](#sse-server-sent-events-endpoint)
- [Control Endpoints](#control-endpoints)
- [Data Structures](#data-structures)
- [Integration Examples](#integration-examples)

## Overview

The test dashboard provides a programmable API for triggering, monitoring, and managing test runs. While the current implementation provides a TypeScript module (`TestRunner`), this document describes the recommended HTTP API patterns for exposing dashboard functionality via REST/SSE endpoints.

## Status Endpoint

### GET /dashboard/status

Returns the current state of the test dashboard, including all module states, coverage information, and run status.

**Authentication**: Optional (depends on your auth configuration)

**Response**: `200 OK`

```json
{
  "status": "running",
  "runId": "2025-11-09T12-30-45-123Z",
  "queueSize": 0,
  "startedAt": "2025-11-09T12:30:45.123Z",
  "completedAt": null,
  "durationMs": null,
  "error": null,
  "modules": {
    "api-tests": {
      "id": "api-tests",
      "label": "API Handler Tests",
      "labels": ["api", "go", "handlers"],
      "status": "running",
      "durationMs": null,
      "summary": null,
      "failures": null,
      "error": null,
      "startedAt": "2025-11-09T12:30:46.000Z",
      "completedAt": null,
      "coverage": null,
      "rawOutput": null,
      "timedOut": false,
      "cancelled": false
    },
    "dashboard-tests": {
      "id": "dashboard-tests",
      "label": "Dashboard Unit Tests",
      "labels": ["typescript", "jest", "dashboard"],
      "status": "idle",
      "durationMs": null,
      "summary": null,
      "failures": null,
      "error": null,
      "startedAt": null,
      "completedAt": null,
      "coverage": null,
      "rawOutput": null,
      "timedOut": false,
      "cancelled": false
    }
  },
  "coverage": {
    "total": null,
    "modules": {
      "api-tests": null,
      "dashboard-tests": null
    }
  },
  "lastUpdated": "2025-11-09T12:30:46.500Z"
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `status` | `string` | Overall run status: `idle`, `queued`, `running`, `completed`, `failed` |
| `runId` | `string\|null` | Unique identifier for current/last test run |
| `queueSize` | `number` | Number of test runs waiting in queue |
| `startedAt` | `string\|null` | ISO timestamp when run started |
| `completedAt` | `string\|null` | ISO timestamp when run completed |
| `durationMs` | `number\|null` | Total run duration in milliseconds |
| `error` | `string\|null` | Error message if run failed |
| `modules` | `object` | Map of module ID to module state (see ModuleState below) |
| `coverage.total` | `number\|null` | Average coverage across all modules (0-100) |
| `coverage.modules` | `object` | Map of module ID to coverage summary |
| `lastUpdated` | `string` | ISO timestamp of last status update |

### ModuleState Structure

Each module in the `modules` object has the following structure:

```json
{
  "id": "api-tests",
  "label": "API Handler Tests",
  "labels": ["api", "go"],
  "status": "passed",
  "durationMs": 5432,
  "summary": {
    "total": 24,
    "passed": 24,
    "failed": 0,
    "skipped": 0
  },
  "failures": [],
  "error": null,
  "startedAt": "2025-11-09T12:30:46.000Z",
  "completedAt": "2025-11-09T12:30:51.432Z",
  "coverage": {
    "profilePath": "/tmp/dashboard-test-runner/2025-11-09-api-tests-cover.out",
    "total": 78.5,
    "entries": [
      {
        "name": "github.com/user/pansou/api",
        "coverage": 82.3
      },
      {
        "name": "github.com/user/pansou/api/middleware",
        "coverage": 74.7
      }
    ],
    "raw": "github.com/user/pansou/api\t82.3%\n..."
  },
  "rawOutput": "{\"Action\":\"run\",\"Package\":\"github.com/user/pansou/api\"}...",
  "timedOut": false,
  "cancelled": false
}
```

**ModuleState Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Module identifier |
| `label` | `string\|undefined` | Human-readable label |
| `labels` | `string[]\|undefined` | Additional labels for filtering |
| `status` | `string` | Module status: `idle`, `queued`, `running`, `passed`, `failed` |
| `durationMs` | `number\|undefined` | Execution duration in milliseconds |
| `summary` | `TestSummary\|undefined` | Test counts (total, passed, failed, skipped) |
| `failures` | `TestFailureDetail[]\|undefined` | Array of failure details |
| `error` | `string\|undefined` | Error message if module failed |
| `startedAt` | `string\|undefined` | ISO timestamp when module started |
| `completedAt` | `string\|undefined` | ISO timestamp when module completed |
| `coverage` | `ModuleCoverageSummary\|null` | Coverage information |
| `rawOutput` | `string\|undefined` | Raw stdout from command |
| `timedOut` | `boolean\|undefined` | Whether execution timed out |
| `cancelled` | `boolean\|undefined` | Whether execution was cancelled |

### TestFailureDetail Structure

```json
{
  "test": "TestHandleSearch",
  "message": "Expected status 200, got 500",
  "output": "--- FAIL: TestHandleSearch (0.01s)\n    handler_test.go:42: Expected status 200, got 500\n"
}
```

## SSE (Server-Sent Events) Endpoint

### GET /dashboard/events

Establishes a persistent connection for real-time test status updates.

**Authentication**: Optional (depends on your auth configuration)

**Response**: `200 OK` with `Content-Type: text/event-stream`

**Event Stream Format**:

```
event: queued
data: {"status":"queued","queueSize":1,...}

event: running
data: {"status":"running","runId":"2025-11-09T12-30-45-123Z",...}

event: completed
data: {"status":"completed","runId":"2025-11-09T12-30-45-123Z","durationMs":12345,...}
```

**Event Types**:

- `queued` - Test run added to queue
- `running` - Test run started
- `completed` - Test run completed successfully
- `failed` - Test run failed

Each event's `data` field contains a complete `TestStatusSnapshot` (same structure as `/dashboard/status`).

**Client Example** (JavaScript):

```javascript
const eventSource = new EventSource('/dashboard/events')

eventSource.addEventListener('running', (event) => {
  const status = JSON.parse(event.data)
  console.log('Test run started:', status.runId)
})

eventSource.addEventListener('completed', (event) => {
  const status = JSON.parse(event.data)
  console.log('Test run completed:', status.coverage.total + '%')
})

eventSource.addEventListener('failed', (event) => {
  const status = JSON.parse(event.data)
  console.error('Test run failed:', status.error)
})
```

## Control Endpoints

### POST /dashboard/trigger

Triggers a new test run. If a run is already in progress, the new run is queued.

**Authentication**: Recommended (to prevent abuse)

**Request Body**: Empty (or optional configuration)

```json
{
  "modules": ["api-tests", "dashboard-tests"]
}
```

**Response**: `202 Accepted`

```json
{
  "status": "queued",
  "queueSize": 1,
  "message": "Test run queued"
}
```

or `200 OK` if run started immediately:

```json
{
  "status": "running",
  "runId": "2025-11-09T12-30-45-123Z",
  "queueSize": 0,
  "message": "Test run started"
}
```

### POST /dashboard/cancel

Cancels the currently running test.

**Authentication**: Recommended

**Request Body**: Empty

**Response**: `200 OK`

```json
{
  "message": "Test run cancelled",
  "status": "failed",
  "error": "run cancelled"
}
```

or `400 Bad Request` if no run is active:

```json
{
  "error": "No test run in progress"
}
```

## Data Structures

### TestStatusSnapshot

Complete snapshot of test runner state. See [Status Endpoint](#status-endpoint) for full structure.

### ModuleCoverageSummary

```typescript
{
  profilePath?: string               // Path to coverage profile
  total: number                      // Overall coverage (0-100)
  entries: ModuleCoverageEntry[]     // Per-package breakdown
  raw?: string                       // Raw coverage output
}
```

### ModuleCoverageEntry

```typescript
{
  name: string         // Package/file name
  coverage: number     // Coverage percentage (0-100)
}
```

### TestSummary

```typescript
{
  total: number        // Total test count
  passed: number       // Passed test count
  failed: number       // Failed test count
  skipped: number      // Skipped test count
}
```

### TestFailureDetail

```typescript
{
  test?: string        // Test name
  message: string      // Failure message
  output?: string      // Full test output
}
```

## Integration Examples

### Express.js Integration

```javascript
import express from 'express'
import { TestRunner } from './dashboard/test-runner.js'

const app = express()
const runner = new TestRunner(modules)

// Status endpoint
app.get('/dashboard/status', (req, res) => {
  res.json(runner.status)
})

// SSE endpoint
app.get('/dashboard/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`)
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  runner.on('queued', (status) => sendEvent('queued', status))
  runner.on('running', (status) => sendEvent('running', status))
  runner.on('completed', (status) => sendEvent('completed', status))
  runner.on('failed', (status) => sendEvent('failed', status))

  req.on('close', () => {
    runner.removeAllListeners()
  })
})

// Trigger endpoint
app.post('/dashboard/trigger', async (req, res) => {
  const status = runner.status
  if (status.status === 'running' || status.queueSize > 0) {
    res.status(202).json({
      status: 'queued',
      queueSize: status.queueSize,
      message: 'Test run queued'
    })
  } else {
    res.json({
      status: 'running',
      message: 'Test run started'
    })
  }
  
  runner.trigger().catch(console.error)
})

// Cancel endpoint
app.post('/dashboard/cancel', (req, res) => {
  const status = runner.status
  if (status.status !== 'running') {
    return res.status(400).json({ error: 'No test run in progress' })
  }
  
  runner.cancel()
  res.json({
    message: 'Test run cancelled',
    status: 'failed',
    error: 'run cancelled'
  })
})
```

### Gin (Go) Integration Pattern

```go
package api

import (
    "encoding/json"
    "net/http"
    "github.com/gin-gonic/gin"
)

// DashboardStatusHandler returns the current test dashboard status
func DashboardStatusHandler(c *gin.Context) {
    // Call Node.js dashboard via child process or HTTP
    status := getTestDashboardStatus()
    c.JSON(http.StatusOK, status)
}

// DashboardEventsHandler streams SSE events
func DashboardEventsHandler(c *gin.Context) {
    c.Header("Content-Type", "text/event-stream")
    c.Header("Cache-Control", "no-cache")
    c.Header("Connection", "keep-alive")
    
    // Stream events from dashboard
    streamTestDashboardEvents(c)
}

func RegisterDashboardRoutes(r *gin.Engine) {
    dashboard := r.Group("/dashboard")
    {
        dashboard.GET("/status", DashboardStatusHandler)
        dashboard.GET("/events", DashboardEventsHandler)
        dashboard.POST("/trigger", TriggerTestHandler)
        dashboard.POST("/cancel", CancelTestHandler)
    }
}
```

## Best Practices

1. **Rate Limiting**: Implement rate limiting on `/dashboard/trigger` to prevent abuse
2. **Authentication**: Protect control endpoints (`/trigger`, `/cancel`) with JWT or session auth
3. **CORS**: Configure CORS headers if accessing from a web UI
4. **Connection Limits**: Limit concurrent SSE connections to prevent resource exhaustion
5. **Timeout Handling**: Set reasonable timeouts for long-running tests
6. **Artifact Cleanup**: Periodically clean up old test artifacts to save disk space
7. **Error Handling**: Always check `status.error` and `module.error` fields for failure details

## Troubleshooting

### SSE Connection Issues

If SSE connections are not working:

1. Ensure proxy/load balancer doesn't buffer SSE responses
2. Check that `Content-Type: text/event-stream` header is set
3. Verify `Cache-Control: no-cache` header is present
4. Test with a simple curl command:
   ```bash
   curl -N http://localhost:8888/dashboard/events
   ```

### Status Not Updating

If status appears stale:

1. Check `lastUpdated` timestamp in response
2. Verify TestRunner is emitting events (`runner.on('running', ...)`)
3. Ensure no exceptions are thrown in event handlers
4. Check that TestStatusStore is calling `touch()` after updates

### Coverage Not Collected

If `coverage.total` is always `null`:

1. Verify Go is installed and in PATH
2. Check that `go tool cover` command works:
   ```bash
   go tool cover -h
   ```
3. Ensure module definition has `coverage: true`
4. Verify coverage profile was generated (check `profilePath`)
5. Look for errors in `module.error` field

For more troubleshooting tips, see the [TypeScript README](../typescript/README.md#troubleshooting).
