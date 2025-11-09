# Dashboard Test Runner

A comprehensive test orchestration module for the PanSou MCP server that provides end-to-end test execution, coverage parsing, and status tracking.

## Features

- **Sequential Test Execution**: Runs test modules in sequence with configurable timeouts
- **Multi-Format Support**: Parses Go test JSON output, Jest JSON results, and basic test output
- **Coverage Tracking**: Generates and parses coverage reports with percentage calculations
- **Event-Driven Architecture**: Emits lifecycle events for real-time monitoring
- **Concurrent Run Control**: Prevents concurrent execution beyond configured limits
- **Persistent Status Storage**: Saves test results to configurable cache directory
- **Toolchain Detection**: Checks for availability of Go, Node, and Jest toolchains

## Usage

```typescript
import { TestRunner, TestModule } from './dashboard/index.js';

// Initialize the test runner
const testRunner = new TestRunner({
  cacheDirectory: './test-cache',
  defaultTimeout: 30000,
  maxConcurrentRuns: 2,
  enableCoverage: true,
});

await testRunner.initialize();

// Define test modules
const modules: TestModule[] = [
  {
    id: 'go-backend-tests',
    name: 'Go Backend Tests',
    command: 'go test -json ./...',
    workingDirectory: '../../',
    labels: ['backend', 'go'],
  },
  {
    id: 'typescript-tests',
    name: 'TypeScript Tests',
    command: 'npm run test:dashboard',
    workingDirectory: './',
    labels: ['frontend', 'typescript'],
  },
];

// Listen for events
testRunner.on((event) => {
  console.log('Test event:', event);
});

// Run tests
const status = await testRunner.runTests(modules);
console.log('Final status:', status);
```

## API Reference

### TestRunner

#### Constructor
```typescript
constructor(config: TestRunnerConfig)
```

#### Methods
- `initialize()`: Initialize the test runner and cache directory
- `runTests(modules: TestModule[]): Promise<TestStatus>`: Execute test modules
- `cancelRun(runId: string): Promise<boolean>`: Cancel a running test
- `getStatus(runId: string): TestStatus | undefined`: Get test status by ID
- `getAllStatuses(): TestStatus[]`: Get all stored test statuses
- `getMetrics(): TestMetrics`: Get aggregated metrics
- `checkToolchains(): Promise<ToolchainStatus>`: Check toolchain availability

### TestStatusStore

Manages persistent storage of test statuses and provides metrics calculation.

#### Methods
- `createStatus(id: string, moduleIds: string[]): TestStatus`: Create new test status
- `updateStatus(id: string, updates: Partial<TestStatus>): TestStatus | undefined`: Update status
- `updateModuleResult(id: string, moduleId: string, result: Partial<TestResult>)`: Update module result
- `addCoverageData(id: string, coverageData: CoverageData)`: Add coverage data
- `saveStatus(id: string): Promise<void>`: Save status to disk
- `loadStatus(id: string): Promise<TestStatus | undefined>`: Load status from disk

## Types

### TestModule
```typescript
interface TestModule {
  id: string;
  name: string;
  command: string;
  workingDirectory: string;
  labels: string[];
  timeout?: number;
}
```

### TestStatus
```typescript
interface TestStatus {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  modules: TestResult[];
  overallCoverage?: number;
  coverageData: CoverageData[];
  error?: string;
}
```

### TestResult
```typescript
interface TestResult {
  moduleId: string;
  status: 'passed' | 'failed' | 'skipped' | 'timeout';
  duration: number;
  passCount: number;
  failCount: number;
  skipCount: number;
  coverage?: number;
  error?: string;
  output?: string[];
}
```

## Events

The TestRunner emits the following events:

- `queued`: Test run has been queued
- `started`: Test run has started
- `moduleStarted`: Individual module execution started
- `moduleCompleted`: Individual module execution completed
- `completed`: Test run completed successfully
- `failed`: Test run failed
- `cancelled`: Test run was cancelled

## Testing

Run the dashboard tests with:

```bash
npm run test:dashboard
```

The test suite includes:
- Unit tests for TestStatusStore
- Unit tests for TestRunner (with mocked dependencies)
- Integration tests for complete workflows
- Coverage parsing validation
- State transition verification

## Configuration

The TestRunner accepts the following configuration:

```typescript
interface TestRunnerConfig {
  cacheDirectory: string;      // Directory for storing test artifacts
  defaultTimeout: number;       // Default timeout per module (ms)
  maxConcurrentRuns: number;    // Maximum concurrent test runs
  enableCoverage: boolean;      // Enable coverage parsing
}
```

## Coverage Parsing

The module automatically parses coverage from:
- Go tests using `go tool cover -func`
- Jest tests using built-in coverage reporting
- Generates `cover.out` files in working directories

Coverage data includes:
- Line coverage percentages
- Function coverage metrics
- Overall aggregation across modules
- Per-module breakdowns

## Error Handling

The test runner includes comprehensive error handling for:
- Missing toolchains
- Invalid working directories
- Command execution failures
- Timeout scenarios
- Coverage parsing errors
- File system permissions

All errors are captured and stored in the test status for later analysis.