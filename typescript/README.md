# PanSou MCP Server - TypeScript

This directory contains the TypeScript-based Model Context Protocol (MCP) server for PanSou, including the test dashboard module for orchestrating and monitoring test runs.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Test Dashboard](#test-dashboard)
  - [Features](#features)
  - [Setup](#setup)
  - [Usage](#usage)
  - [Configuration](#configuration)
  - [API Reference](#api-reference)
  - [Troubleshooting](#troubleshooting)

## Overview

The PanSou MCP server provides a bridge between the Go-based backend search API and MCP clients like Claude Desktop. It includes a comprehensive test dashboard for running and monitoring automated tests across both Go and TypeScript/Jest test suites.

## Installation

### Prerequisites

- **Node.js**: 18.0.0 or higher
- **npm**: Comes with Node.js
- **Go**: 1.18+ (required for running Go tests via dashboard)
- **Git**: For version control

### Install Dependencies

```bash
cd typescript
npm install
```

### Build the Project

```bash
npm run build
```

This compiles TypeScript files from `src/` to `dist/`.

## Test Dashboard

### Features

The test dashboard provides:

- **Test Orchestration**: Sequential execution of Go and Jest test modules
- **Real-time Status Tracking**: Live updates on test execution status
- **Coverage Aggregation**: Automatic collection and aggregation of test coverage from Go modules
- **Artifact Persistence**: Storage of test results, coverage reports, and raw output
- **Event-driven API**: Subscribe to test lifecycle events (queued, running, completed, failed)
- **Cancellation Support**: Cancel running tests gracefully
- **Queue Management**: Automatic queuing of concurrent test requests
- **Timeout Protection**: Configurable timeouts prevent hanging tests

### Setup

#### 1. Install Test Dependencies

Test dependencies are already included in `package.json`:

```json
{
  "devDependencies": {
    "@types/jest": "^29.5.14",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0"
  }
}
```

Run `npm install` if you haven't already.

#### 2. Configure Test Modules

Create a test configuration defining your test modules. Example:

```typescript
import { TestModuleDefinition } from './src/dashboard/types.js'

const modules: TestModuleDefinition[] = [
  {
    id: 'api-tests',
    label: 'API Handler Tests',
    command: 'go',
    args: ['test', './api/...'],
    type: 'go',
    cwd: '/path/to/project',
    coverage: true,
    timeoutMs: 60000
  },
  {
    id: 'dashboard-tests',
    label: 'Dashboard Unit Tests',
    command: 'npm',
    args: ['test'],
    type: 'jest',
    cwd: '/path/to/project/typescript',
    timeoutMs: 30000
  }
]
```

#### 3. Environment Variables

The dashboard uses environment variables for configuration:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `TEST_ARTIFACT_DIR` | Directory for test artifacts and coverage reports | `$TMPDIR/dashboard-test-runner` | No |
| `GO_BINARY` | Path to Go binary | `go` | No |
| `NODE_ENV` | Node environment (`test`, `development`, `production`) | `development` | No |

Example `.env` file:

```bash
TEST_ARTIFACT_DIR=/path/to/artifacts
GO_BINARY=/usr/local/go/bin/go
NODE_ENV=test
```

### Usage

#### Running Dashboard Tests

Run the dashboard's own unit tests:

```bash
cd typescript
npm test
```

This executes Jest tests in `src/dashboard/__tests__/`.

#### Using TestRunner Programmatically

```typescript
import { TestRunner } from './src/dashboard/test-runner.js'
import { TestModuleDefinition } from './src/dashboard/types.js'

const modules: TestModuleDefinition[] = [
  {
    id: 'go-api',
    command: 'go',
    args: ['test', './api/...'],
    type: 'go',
    coverage: true
  }
]

const runner = new TestRunner(modules, {
  artifactDir: './test-artifacts',
  goBinary: 'go'
})

// Subscribe to events
runner.on('queued', (status) => {
  console.log('Test run queued:', status)
})

runner.on('running', (status) => {
  console.log('Test run started:', status)
})

runner.on('completed', (status) => {
  console.log('Test run completed:', status)
  console.log('Total coverage:', status.coverage.total)
})

runner.on('failed', (status) => {
  console.error('Test run failed:', status.error)
})

// Trigger test run
const result = await runner.trigger()

// Get current status
const status = runner.status

// Cancel running tests
runner.cancel()
```

### Configuration

#### Jest Configuration

The dashboard uses a dedicated Jest configuration in `jest.config.ts`:

```typescript
import type { Config } from 'jest'

const config: Config = {
  roots: ['<rootDir>/src/dashboard'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { 
      useESM: true, 
      tsconfig: '<rootDir>/tsconfig.test.json' 
    }]
  },
  collectCoverage: false
}

export default config
```

#### TypeScript Test Configuration

Test-specific TypeScript configuration in `tsconfig.test.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["jest", "node"],
    "esModuleInterop": true
  },
  "include": ["src/dashboard/**/*.ts"]
}
```

### API Reference

#### TestRunner Class

**Constructor**

```typescript
constructor(
  modules: TestModuleDefinition[],
  options?: TestRunnerOptions
)
```

**Options:**
- `artifactDir?: string` - Directory for storing test artifacts (default: system temp dir)
- `goBinary?: string` - Path to Go binary (default: `'go'`)
- `spawnFn?: SpawnFunction` - Custom spawn function for testing (default: `child_process.spawn`)
- `now?: () => Date` - Custom date function for testing (default: `() => new Date()`)

**Methods:**

- `trigger(): Promise<TestStatusSnapshot>` - Trigger a new test run
- `cancel(): void` - Cancel the currently running test
- `get status(): TestStatusSnapshot` - Get current test status

**Events:**

- `'queued'` - Test run queued (emits `TestStatusSnapshot`)
- `'running'` - Test run started (emits `TestStatusSnapshot`)
- `'completed'` - Test run completed successfully (emits `TestStatusSnapshot`)
- `'failed'` - Test run failed (emits `TestStatusSnapshot`)

#### Response Shapes

##### TestStatusSnapshot

```typescript
{
  status: 'idle' | 'queued' | 'running' | 'completed' | 'failed'
  runId?: string                    // Unique identifier for the test run
  queueSize: number                 // Number of queued test runs
  startedAt?: string                // ISO timestamp when run started
  completedAt?: string              // ISO timestamp when run completed
  durationMs?: number               // Total duration in milliseconds
  error?: string                    // Error message if run failed
  modules: Record<string, ModuleState>  // Status of each test module
  coverage: {
    total: number | null            // Average coverage across all modules
    modules: Record<string, ModuleCoverageSummary | null>
  }
  lastUpdated: string               // ISO timestamp of last status update
}
```

##### ModuleState

```typescript
{
  id: string                        // Module identifier
  label?: string                    // Human-readable label
  labels?: string[]                 // Additional labels
  status: 'idle' | 'queued' | 'running' | 'passed' | 'failed'
  durationMs?: number               // Module execution duration
  summary?: {
    total: number                   // Total number of tests
    passed: number                  // Number of passed tests
    failed: number                  // Number of failed tests
    skipped: number                 // Number of skipped tests
  }
  failures?: Array<{
    test?: string                   // Test name
    message: string                 // Failure message
    output?: string                 // Full test output
  }>
  error?: string                    // Error message if module failed
  startedAt?: string                // ISO timestamp when module started
  completedAt?: string              // ISO timestamp when module completed
  coverage?: ModuleCoverageSummary | null
  rawOutput?: string                // Raw command output
  timedOut?: boolean                // Whether module execution timed out
  cancelled?: boolean               // Whether module execution was cancelled
}
```

##### ModuleCoverageSummary

```typescript
{
  profilePath?: string              // Path to Go coverage profile
  total: number                     // Total coverage percentage (0-100)
  entries: Array<{
    name: string                    // Package or file name
    coverage: number                // Coverage percentage for this entry
  }>
  raw?: string                      // Raw coverage report output
}
```

#### TestModuleDefinition

Define a test module to be executed:

```typescript
{
  id: string                        // Required: Unique module identifier
  label?: string                    // Optional: Human-readable label
  labels?: string[]                 // Optional: Additional labels for filtering
  command: string                   // Required: Command to execute (e.g., 'go', 'npm')
  args?: string[]                   // Optional: Command arguments
  cwd?: string                      // Optional: Working directory
  env?: NodeJS.ProcessEnv           // Optional: Environment variables
  type: 'go' | 'jest' | 'generic'   // Required: Module type for parsing
  timeoutMs?: number                // Optional: Timeout (default: 900000 = 15 min)
  coverage?: boolean                // Optional: Enable coverage (default: true for Go)
}
```

### Troubleshooting

#### Common Issues

##### 1. Go Binary Not Found

**Error:**
```
command not found: go
```

**Solution:**
- Ensure Go is installed: `go version`
- Set `GO_BINARY` environment variable to the full path:
  ```bash
  export GO_BINARY=/usr/local/go/bin/go
  ```
- Or pass it in TestRunner options:
  ```typescript
  const runner = new TestRunner(modules, {
    goBinary: '/usr/local/go/bin/go'
  })
  ```

##### 2. Jest Tests Fail to Run

**Error:**
```
Cannot find module 'jest'
```

**Solution:**
- Install test dependencies:
  ```bash
  npm install --save-dev jest @types/jest ts-jest
  ```
- Rebuild the project:
  ```bash
  npm run build
  ```

##### 3. Coverage Reports Not Generated

**Issue:** `coverage.total` is `null` in test results

**Solution:**
- Ensure Go tests are run with `-coverprofile` flag (automatically added for type='go')
- Check that `go tool cover` is available:
  ```bash
  go tool cover -h
  ```
- Verify coverage is enabled in module definition:
  ```typescript
  {
    type: 'go',
    coverage: true  // Make sure this is true
  }
  ```

##### 4. Tests Timeout

**Error:**
```
command timed out
```

**Solution:**
- Increase timeout in module definition:
  ```typescript
  {
    id: 'slow-tests',
    timeoutMs: 900000  // 15 minutes
  }
  ```
- Or use `DEFAULT_TIMEOUT_MS` which is 15 minutes by default

##### 5. Artifact Directory Permissions

**Error:**
```
EACCES: permission denied, mkdir '/tmp/dashboard-test-runner'
```

**Solution:**
- Set a custom artifact directory with proper permissions:
  ```bash
  export TEST_ARTIFACT_DIR=./test-artifacts
  ```
- Or pass it in options:
  ```typescript
  const runner = new TestRunner(modules, {
    artifactDir: './test-artifacts'
  })
  ```

##### 6. ESM Module Issues

**Error:**
```
ERR_REQUIRE_ESM
```

**Solution:**
- Ensure `package.json` has `"type": "module"`
- Import with `.js` extension even for `.ts` files:
  ```typescript
  import { TestRunner } from './dashboard/test-runner.js'
  ```
- Check Jest configuration for ESM support (see `jest.config.ts`)

#### Debug Mode

Enable verbose logging for troubleshooting:

```typescript
import { TestRunner } from './src/dashboard/test-runner.js'

const runner = new TestRunner(modules)

// Log all events
runner.on('queued', (status) => console.log('QUEUED:', JSON.stringify(status, null, 2)))
runner.on('running', (status) => console.log('RUNNING:', JSON.stringify(status, null, 2)))
runner.on('completed', (status) => console.log('COMPLETED:', JSON.stringify(status, null, 2)))
runner.on('failed', (status) => console.log('FAILED:', JSON.stringify(status, null, 2)))

const result = await runner.trigger()
console.log('Raw output:', result.modules['module-id'].rawOutput)
```

## Building for Production

```bash
npm run build
```

Compiled files will be in `dist/` directory.

## Development

### Watch Mode

```bash
npm run dev
```

### Linting

```bash
npm run lint
npm run lint:fix
```

## License

MIT License - see [LICENSE](../LICENSE) file for details.
