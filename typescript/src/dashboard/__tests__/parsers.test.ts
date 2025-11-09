import { parseGoCoverageReport, parseGoTestJson, parseJestJson } from '../parsers.js'

function buildGoEvent(event: Record<string, unknown>): string {
  return JSON.stringify(event)
}

describe('parsers', () => {
  it('parses go coverage output with totals and entries', () => {
    const report = [
      'github.com/example/project/pkg/service.go:32: Example  75.0%',
      'github.com/example/project/pkg/repository.go:12: Another  50.0%',
      'total: (statements) 62.5%'
    ].join('\n')

    const coverage = parseGoCoverageReport(report, '/tmp/cover.out')

    expect(coverage.profilePath).toBe('/tmp/cover.out')
    expect(coverage.total).toBeCloseTo(62.5)
    expect(coverage.entries).toHaveLength(2)
    expect(coverage.entries[0]).toEqual({ name: 'github.com/example/project/pkg/service.go:32: Example', coverage: 75 })
  })

  it('parses go test json stream and captures failures', () => {
    const stream = [
      buildGoEvent({ Action: 'run', Package: 'example', Test: 'TestAlpha' }),
      buildGoEvent({ Action: 'output', Package: 'example', Test: 'TestAlpha', Output: '--- FAIL: TestAlpha (0.00s)\n' }),
      buildGoEvent({ Action: 'fail', Package: 'example', Test: 'TestAlpha' }),
      buildGoEvent({ Action: 'fail', Package: 'example' })
    ].join('\n')

    const result = parseGoTestJson(stream)

    expect(result.success).toBe(false)
    expect(result.summary.failed).toBe(1)
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0]?.message).toContain('FAIL')
  })

  it('parses jest json output', () => {
    const output = JSON.stringify({
      success: true,
      numTotalTests: 3,
      numPassedTests: 3,
      numFailedTests: 0,
      numPendingTests: 0,
      testResults: [
        {
          assertionResults: [
            {
              status: 'passed',
              title: 'alpha',
              fullName: 'suite alpha'
            }
          ],
          perfStats: {
            runtime: 125
          }
        }
      ]
    })

    const result = parseJestJson(output)

    expect(result.success).toBe(true)
    expect(result.summary.total).toBe(3)
    expect(result.summary.failed).toBe(0)
    expect(result.durationMs).toBe(125)
  })
})
