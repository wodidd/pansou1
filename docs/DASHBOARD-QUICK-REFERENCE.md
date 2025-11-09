# Test Dashboard Quick Reference

One-page reference for the PanSou test dashboard.

## Installation

```bash
cd typescript
npm install
```

## Environment Variables

```bash
export TEST_ARTIFACT_DIR=/path/to/artifacts  # default: $TMPDIR/dashboard-test-runner
export GO_BINARY=go                          # default: go
export NODE_ENV=production                   # default: development
```

## Running Tests

```bash
# Run dashboard's own tests
npm test

# Build the project
npm run build
```

## API Endpoints (Proposed)

```bash
# Get current status
GET /dashboard/status

# Trigger test run
POST /dashboard/trigger

# Cancel running test
POST /dashboard/cancel

# Subscribe to events (SSE)
GET /dashboard/events
```

## Response Structure

### /dashboard/status

```json
{
  "status": "running|idle|queued|completed|failed",
  "runId": "2025-11-09T12-30-45-123Z",
  "queueSize": 0,
  "startedAt": "2025-11-09T12:30:45.123Z",
  "completedAt": null,
  "durationMs": null,
  "error": null,
  "modules": {
    "module-id": {
      "status": "passed|failed|running|idle|queued",
      "durationMs": 5000,
      "summary": { "total": 10, "passed": 10, "failed": 0, "skipped": 0 },
      "coverage": { "total": 85.5, "entries": [...] }
    }
  },
  "coverage": {
    "total": 85.5,
    "modules": { "module-id": {...} }
  },
  "lastUpdated": "2025-11-09T12:30:46.500Z"
}
```

## Programmatic Usage

```typescript
import { TestRunner } from './src/dashboard/test-runner.js'

const modules = [
  {
    id: 'api-tests',
    command: 'go',
    args: ['test', './api/...'],
    type: 'go',
    coverage: true
  }
]

const runner = new TestRunner(modules)

// Listen for events
runner.on('completed', (status) => {
  console.log('Coverage:', status.coverage.total + '%')
})

// Trigger run
await runner.trigger()

// Get status
const status = runner.status

// Cancel
runner.cancel()
```

## Module Types

| Type | Description | Output Format |
|------|-------------|---------------|
| `go` | Go tests with `-json` flag | Go test JSON stream |
| `jest` | Jest with `--json` flag | Jest JSON output |
| `generic` | Any command | Exit code only |

## Coverage

Go modules automatically collect coverage with `-coverprofile`:

```bash
# Automatically run by TestRunner
go test -json -coverprofile=profile.out ./api/...
go tool cover -func=profile.out
```

Coverage is aggregated across all Go modules as an average.

## Troubleshooting

### Go not found
```bash
# Set GO_BINARY env var
export GO_BINARY=/usr/local/go/bin/go
```

### Tests timeout
```typescript
{
  id: 'slow-tests',
  timeoutMs: 900000  // 15 minutes
}
```

### No coverage collected
- Ensure `go tool cover` is available
- Set `coverage: true` in module definition
- Check module.coverage in status response

## Event Types

- `queued` - Test queued
- `running` - Test started
- `completed` - All passed
- `failed` - Test failed/cancelled

## File Locations

- Code: `typescript/src/dashboard/`
- Tests: `typescript/src/dashboard/__tests__/`
- Config: `typescript/jest.config.ts`
- Artifacts: `$TEST_ARTIFACT_DIR` or `/tmp/dashboard-test-runner/`

## Documentation Links

- [Full Guide](../typescript/README.md#test-dashboard)
- [API Reference](./TEST-DASHBOARD-API.md)
- [CHANGELOG](../CHANGELOG.md)

## Status Values

### TestRunStatus
- `idle` - No run active
- `queued` - Waiting to run
- `running` - Currently executing
- `completed` - Success
- `failed` - Failed or cancelled

### ModuleExecutionStatus
- `idle` - Not started
- `queued` - Waiting
- `running` - Executing
- `passed` - Success
- `failed` - Failed/timeout/cancelled

## Typical Workflow

1. Define test modules
2. Create TestRunner instance
3. Subscribe to events
4. Trigger test run
5. Monitor via status or events
6. Collect results from snapshot
7. Access artifacts in artifact directory

## Dependencies

**Required**:
- Node.js 18.0.0+
- Go 1.18+ (for Go module tests)

**npm packages** (auto-installed):
- `jest`, `ts-jest`, `@types/jest`

## Build Output

```
typescript/
├── dist/              # Compiled JS
├── src/
│   └── dashboard/     # Dashboard modules
│       ├── types.ts
│       ├── test-runner.ts
│       ├── status-store.ts
│       └── parsers.ts
└── test-artifacts/    # Generated artifacts
    ├── status.json
    ├── {runId}.json
    └── {runId}-{moduleId}-cover.out
```
