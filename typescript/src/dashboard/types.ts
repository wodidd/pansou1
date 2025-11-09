/**
 * Overall status of a test run across all modules.
 * - idle: No test run in progress
 * - queued: Test run is queued, waiting for current run to complete
 * - running: Test run is currently executing
 * - completed: All modules passed successfully
 * - failed: One or more modules failed or run was cancelled
 */
export type TestRunStatus = 'idle' | 'queued' | 'running' | 'completed' | 'failed'

/**
 * Type of test module, determines how output is parsed.
 * - go: Go test with -json output, supports coverage via -coverprofile
 * - jest: Jest test with --json output
 * - generic: Any command, exit code determines pass/fail
 */
export type TestModuleType = 'go' | 'jest' | 'generic'

/**
 * Aggregated statistics for tests in a module.
 */
export interface TestSummary {
  total: number      // Total number of tests run
  passed: number     // Number of tests that passed
  failed: number     // Number of tests that failed
  skipped: number    // Number of tests skipped
}

/**
 * Details about a failed test case.
 */
export interface TestFailureDetail {
  test?: string        // Name of the failed test (optional)
  message: string      // Failure message or error description
  output?: string      // Additional output from the test (optional)
}

/**
 * Coverage information for a single package or file.
 */
export interface ModuleCoverageEntry {
  name: string         // Package or file name (e.g., "github.com/user/repo/api")
  coverage: number     // Coverage percentage (0-100)
}

/**
 * Aggregated coverage information for a test module.
 */
export interface ModuleCoverageSummary {
  profilePath?: string               // Path to Go coverage profile file
  total: number                      // Overall coverage percentage (0-100)
  entries: ModuleCoverageEntry[]     // Per-package/file coverage breakdown
  raw?: string                       // Raw coverage report output for debugging
}

/**
 * Configuration for a test module to be executed by TestRunner.
 * Defines the command, environment, and parsing strategy for a test suite.
 */
export interface TestModuleDefinition {
  id: string                          // Unique identifier for this module
  label?: string                      // Human-readable label (optional)
  labels?: string[]                   // Additional labels for filtering/grouping (optional)
  command: string                     // Command to execute (e.g., 'go', 'npm', 'jest')
  args?: string[]                     // Command arguments (e.g., ['test', './api/...'])
  cwd?: string                        // Working directory for command execution
  env?: NodeJS.ProcessEnv             // Environment variables for the command
  type: TestModuleType                // Module type determines output parsing strategy
  timeoutMs?: number                  // Execution timeout in milliseconds (default: 15 minutes)
  coverage?: boolean                  // Enable coverage collection (default: true for Go modules)
}

/**
 * Execution status of an individual test module.
 * - idle: Module has not started
 * - queued: Module is waiting to execute
 * - running: Module is currently executing
 * - passed: Module completed successfully
 * - failed: Module failed, timed out, or was cancelled
 */
export type ModuleExecutionStatus = 'idle' | 'queued' | 'running' | 'passed' | 'failed'

/**
 * Runtime state of a test module, including results and coverage.
 */
export interface ModuleState {
  id: string                          // Module identifier
  label?: string                      // Human-readable label
  labels?: string[]                   // Additional labels
  status: ModuleExecutionStatus       // Current execution status
  durationMs?: number                 // Execution duration in milliseconds
  summary?: TestSummary               // Test result summary
  failures?: TestFailureDetail[]      // Details of failed tests
  error?: string                      // Error message if module failed
  startedAt?: string                  // ISO timestamp when module started
  completedAt?: string                // ISO timestamp when module completed
  coverage?: ModuleCoverageSummary | null  // Coverage information (null if not available)
  rawOutput?: string                  // Raw stdout from command
  timedOut?: boolean                  // True if module execution timed out
  cancelled?: boolean                 // True if module execution was cancelled
}

/**
 * Complete snapshot of test runner state at a point in time.
 * This is the primary data structure exposed via /dashboard/status endpoint
 * and emitted through TestRunner events.
 */
export interface TestStatusSnapshot {
  status: TestRunStatus                           // Overall test run status
  runId?: string                                  // Unique ID for the current/last run
  queueSize: number                               // Number of queued test runs waiting
  startedAt?: string                              // ISO timestamp when run started
  completedAt?: string                            // ISO timestamp when run completed
  durationMs?: number                             // Total run duration in milliseconds
  error?: string                                  // Error message if run failed
  modules: Record<string, ModuleState>            // State of each test module by ID
  coverage: {
    total: number | null                          // Average coverage across all modules (0-100)
    modules: Record<string, ModuleCoverageSummary | null>  // Coverage by module ID
  }
  lastUpdated: string                             // ISO timestamp of last status update
}

/**
 * Events emitted by TestRunner during test lifecycle.
 * Subscribe to these events to monitor test progress in real-time.
 */
export type TestRunnerEvent = 'queued' | 'running' | 'completed' | 'failed'
