import { TestStatusStore } from '../status-store.js'
import type { ModuleState, TestModuleDefinition } from '../types.js'

describe('TestStatusStore', () => {
  const modules: TestModuleDefinition[] = [
    { id: 'cache', type: 'go', command: 'go', label: 'Cache' },
    { id: 'api', type: 'jest', command: 'npm', args: ['test'], label: 'API' }
  ]

  function createNowGenerator(): () => Date {
    let counter = 0
    const base = new Date('2024-01-01T00:00:00.000Z').getTime()
    return () => {
      const value = new Date(base + counter * 1000)
      counter += 1
      return value
    }
  }

  it('tracks queueing, running, results, and aggregate coverage', () => {
    const now = createNowGenerator()
    const store = new TestStatusStore(modules, now)

    store.enqueueRun()
    let snapshot = store.snapshot()
    expect(snapshot.status).toBe('queued')
    expect(snapshot.queueSize).toBe(1)

    const runId = 'run-123'
    const startedAt = now()
    store.startRun(runId, startedAt)
    snapshot = store.snapshot()
    expect(snapshot.status).toBe('running')
    expect(snapshot.queueSize).toBe(0)

    store.markModuleRunning('cache', now())
    const cacheResult: ModuleState = {
      id: 'cache',
      status: 'passed',
      summary: { total: 2, passed: 2, failed: 0, skipped: 0 },
      durationMs: 1200,
      startedAt: now().toISOString(),
      completedAt: now().toISOString(),
      coverage: {
        profilePath: '/tmp/cache-cover.out',
        total: 80,
        entries: [{ name: 'pkg/cache.go:Cache', coverage: 80 }]
      },
      failures: []
    }
    store.setModuleResult(cacheResult)

    const apiResult: ModuleState = {
      id: 'api',
      status: 'failed',
      summary: { total: 3, passed: 2, failed: 1, skipped: 0 },
      durationMs: 2000,
      startedAt: now().toISOString(),
      completedAt: now().toISOString(),
      failures: [{ message: 'expected true to be false' }],
      coverage: {
        profilePath: '/tmp/api-cover.out',
        total: 60,
        entries: []
      },
      error: 'expected true to be false'
    }
    store.setModuleResult(apiResult)

    store.failRun('api module failed', now())

    snapshot = store.snapshot()
    expect(snapshot.status).toBe('failed')
    expect(snapshot.error).toBe('api module failed')
    expect(snapshot.coverage.total).toBeCloseTo(70)
    expect(snapshot.coverage.modules.cache?.total).toBe(80)
    expect(snapshot.coverage.modules.api?.total).toBe(60)
    expect(snapshot.modules.cache.status).toBe('passed')
  })
})
