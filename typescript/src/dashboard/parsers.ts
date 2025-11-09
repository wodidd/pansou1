import { ModuleCoverageEntry, ModuleCoverageSummary, TestFailureDetail, TestSummary } from './types.js'

/**
 * Represents a single event from Go's test JSON output format.
 * Go emits these events when tests are run with the -json flag.
 * @see https://pkg.go.dev/cmd/test2json
 */
export interface GoTestJsonEvent {
  Action: 'run' | 'pass' | 'fail' | 'skip' | 'pause' | 'cont' | 'output'
  Package?: string   // Package being tested
  Test?: string      // Test name (e.g., "TestMyFunction")
  Elapsed?: number   // Elapsed time in seconds
  Output?: string    // Test output line
  Time?: string      // ISO timestamp
}

/**
 * Parsed result from Go test JSON stream.
 */
export interface GoTestParseResult {
  success: boolean              // True if all tests passed
  summary: TestSummary          // Aggregated test counts
  failures: TestFailureDetail[] // Details of failed tests
  elapsedMs?: number            // Total elapsed time in milliseconds
}

/**
 * Parsed result from Jest JSON output.
 */
export interface JestParseResult {
  success: boolean              // True if all tests passed
  summary: TestSummary          // Aggregated test counts
  failures: TestFailureDetail[] // Details of failed tests
  durationMs?: number           // Total duration in milliseconds
}

/**
 * Parses Go test output in JSON format (from -json flag).
 * Aggregates test counts and extracts failure details.
 * 
 * @param stream - Raw stdout from `go test -json`
 * @returns Parsed test results with success status and failure details
 */
export function parseGoTestJson(stream: string): GoTestParseResult {
  const summary: TestSummary = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0
  }

  const testOutput = new Map<string, string[]>()
  const failedTests = new Set<string>()
  let packagePassed = false
  let packageFailed = false
  let elapsedSeconds: number | undefined

  const lines = stream.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length === 0) {
      continue
    }

    let event: GoTestJsonEvent | null = null
    try {
      event = JSON.parse(trimmed) as GoTestJsonEvent
    } catch {
      continue
    }

    switch (event.Action) {
      case 'run':
        if (event.Test) {
          summary.total += 1
          testOutput.set(event.Test, [])
        }
        break
      case 'pass':
        if (event.Test) {
          summary.passed += 1
          testOutput.delete(event.Test)
        } else {
          packagePassed = true
          if (typeof event.Elapsed === 'number') {
            elapsedSeconds = event.Elapsed
          }
        }
        break
      case 'fail':
        if (event.Test) {
          summary.failed += 1
          if (!testOutput.has(event.Test)) {
            testOutput.set(event.Test, [])
          }
          failedTests.add(event.Test)
        } else {
          packageFailed = true
          if (typeof event.Elapsed === 'number') {
            elapsedSeconds = event.Elapsed
          }
        }
        break
      case 'skip':
        if (event.Test) {
          summary.skipped += 1
          testOutput.delete(event.Test)
        }
        break
      case 'output':
        if (event.Test && typeof event.Output === 'string') {
          const buffer = testOutput.get(event.Test) ?? []
          buffer.push(event.Output.replace(/\s+$/g, ''))
          testOutput.set(event.Test, buffer)
        }
        break
      default:
        break
    }
  }

  const failures: TestFailureDetail[] = []
  for (const testName of failedTests) {
    const messages = testOutput.get(testName) ?? []
    const message = messages.length > 0 ? messages.join('\n').trim() : 'test failed'
    failures.push({
      test: testName,
      message
    })
  }

  return {
    success: packagePassed && !packageFailed && summary.failed === 0,
    summary,
    failures,
    elapsedMs: typeof elapsedSeconds === 'number' ? Math.round(elapsedSeconds * 1000) : undefined
  }
}

/**
 * Parses output from `go tool cover -func=<profile>`.
 * Extracts coverage percentages for each package and calculates total coverage.
 * 
 * @param report - Raw output from go tool cover
 * @param profilePath - Path to the coverage profile file (optional)
 * @returns Aggregated coverage summary with per-package breakdown
 * @throws Error if unable to parse coverage total
 */
export function parseGoCoverageReport(report: string, profilePath?: string): ModuleCoverageSummary {
  const entries: ModuleCoverageEntry[] = []
  let total: number | undefined

  const lines = report.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length === 0 || trimmed.startsWith('mode:')) {
      continue
    }

    const match = trimmed.match(/^(.*)\s+([0-9]+\.[0-9]+)%$/)
    if (!match) {
      continue
    }

    const name = match[1].trim()
    const value = parseFloat(match[2])
    if (Number.isNaN(value)) {
      continue
    }

    if (name.toLowerCase().startsWith('total')) {
      total = value
    } else {
      entries.push({
        name,
        coverage: value
      })
    }
  }

  if (typeof total !== 'number') {
    if (entries.length === 0) {
      throw new Error('unable to parse coverage total from go tool cover output')
    }
    total = parseFloat((entries.reduce((sum, entry) => sum + entry.coverage, 0) / entries.length).toFixed(2))
  }

  return {
    profilePath,
    total,
    entries,
    raw: report
  }
}

/**
 * Parses Jest output in JSON format (from --json flag).
 * Handles both single-line JSON and multi-line output where JSON is the last line.
 * 
 * @param output - Raw output from jest with --json flag
 * @returns Parsed test results with success status and failure details
 */
export function parseJestJson(output: string): JestParseResult {
  const data = extractJsonPayload(output)
  if (!data) {
    return {
      success: false,
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      },
      failures: []
    }
  }

  const total = typeof data.numTotalTests === 'number' ? data.numTotalTests : 0
  const passed = typeof data.numPassedTests === 'number' ? data.numPassedTests : 0
  const failed = typeof data.numFailedTests === 'number' ? data.numFailedTests : Math.max(0, total - passed)
  const skipped = typeof data.numPendingTests === 'number' ? data.numPendingTests : 0

  const failures: TestFailureDetail[] = []
  if (Array.isArray(data.testResults)) {
    for (const testFile of data.testResults) {
      if (!Array.isArray(testFile.assertionResults)) {
        continue
      }
      for (const assertion of testFile.assertionResults) {
        if (assertion.status === 'failed') {
          const messages: string[] = Array.isArray(assertion.failureMessages) ? assertion.failureMessages : []
          failures.push({
            test: assertion.fullName ?? assertion.title,
            message: messages.join('\n').trim()
          })
        }
      }
    }
  }

  let durationMs: number | undefined
  if (Array.isArray(data.testResults)) {
    let runtime = 0
    for (const testFile of data.testResults) {
      const fileRuntime = testFile?.perfStats?.runtime
      if (typeof fileRuntime === 'number') {
        runtime += fileRuntime
      }
    }
    if (runtime > 0) {
      durationMs = runtime
    }
  }

  const success = typeof data.success === 'boolean' ? data.success : failed === 0

  return {
    success,
    summary: {
      total,
      passed,
      failed,
      skipped
    },
    failures,
    durationMs
  }
}

function extractJsonPayload(output: string): any | null {
  const trimmed = output.trim()
  if (trimmed.length === 0) {
    return null
  }

  const candidates = [trimmed, ...trimmed.split(/\r?\n/).map(line => line.trim()).reverse()]

  for (const candidate of candidates) {
    if (!candidate) {
      continue
    }
    try {
      return JSON.parse(candidate)
    } catch {
      continue
    }
  }

  return null
}
