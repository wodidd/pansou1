import { ModuleCoverageSummary, ModuleExecutionStatus, ModuleState, TestModuleDefinition, TestStatusSnapshot } from './types.js'

/**
 * Deep clone coverage data to ensure immutability of snapshots.
 * Prevents external mutations from affecting internal state.
 */
function cloneCoverage(coverage: Record<string, ModuleCoverageSummary | null>): Record<string, ModuleCoverageSummary | null> {
  const cloned: Record<string, ModuleCoverageSummary | null> = {}
  for (const [key, value] of Object.entries(coverage)) {
    cloned[key] = value ? { ...value, entries: value.entries.map(entry => ({ ...entry })) } : null
  }
  return cloned
}

/**
 * TestStatusStore manages the mutable state of a test run.
 * It tracks the status of each module, aggregates coverage,
 * and provides immutable snapshots of the current state.
 * 
 * This class ensures thread-safe state updates and prevents
 * external mutations through defensive cloning in snapshot().
 */
export class TestStatusStore {
  private state: TestStatusSnapshot
  private readonly now: () => Date

  constructor(modules: TestModuleDefinition[], now: () => Date = () => new Date()) {
    this.now = now
    const moduleState: Record<string, ModuleState> = {}
    const coverageState: Record<string, ModuleCoverageSummary | null> = {}

    for (const module of modules) {
      moduleState[module.id] = {
        id: module.id,
        label: module.label,
        labels: module.labels,
        status: 'idle'
      }
      coverageState[module.id] = null
    }

    this.state = {
      status: 'idle',
      queueSize: 0,
      modules: moduleState,
      coverage: {
        total: null,
        modules: coverageState
      },
      lastUpdated: this.timestamp()
    }
  }

  private timestamp(): string {
    return this.now().toISOString()
  }

  private touch(): void {
    this.state.lastUpdated = this.timestamp()
  }

  public snapshot(): TestStatusSnapshot {
    const modules: Record<string, ModuleState> = {}
    for (const [key, value] of Object.entries(this.state.modules)) {
      modules[key] = { ...value, summary: value.summary ? { ...value.summary } : undefined, failures: value.failures ? value.failures.map(failure => ({ ...failure })) : undefined, coverage: value.coverage ? { ...value.coverage, entries: value.coverage.entries.map(entry => ({ ...entry })) } : null }
    }

    return {
      ...this.state,
      modules,
      coverage: {
        total: this.state.coverage.total,
        modules: cloneCoverage(this.state.coverage.modules)
      }
    }
  }

  public enqueueRun(): void {
    this.state.queueSize += 1
    if (this.state.status === 'idle') {
      this.state.status = 'queued'
    }
    this.touch()
  }

  public startRun(runId: string, startedAt: Date): void {
    this.state.runId = runId
    this.state.status = 'running'
    this.state.startedAt = startedAt.toISOString()
    this.state.completedAt = undefined
    this.state.durationMs = undefined
    this.state.error = undefined
    this.state.queueSize = Math.max(0, this.state.queueSize - 1)

    for (const moduleId of Object.keys(this.state.modules)) {
      const current = this.state.modules[moduleId]
      this.state.modules[moduleId] = {
        id: moduleId,
        label: current.label,
        labels: current.labels,
        status: 'idle'
      }
      this.state.coverage.modules[moduleId] = null
    }

    this.state.coverage.total = null
    this.touch()
  }

  public setQueueSize(queueSize: number): void {
    this.state.queueSize = Math.max(0, queueSize)
    if (this.state.queueSize === 0 && this.state.status === 'queued') {
      this.state.status = 'idle'
    }
    this.touch()
  }

  public markModuleQueued(moduleId: string): void {
    this.setModuleStatus(moduleId, 'queued')
  }

  public markModuleRunning(moduleId: string, startedAt: Date): void {
    const module = this.state.modules[moduleId] ?? { id: moduleId, status: 'idle' }
    this.state.modules[moduleId] = {
      ...module,
      status: 'running',
      startedAt: startedAt.toISOString(),
      completedAt: undefined,
      durationMs: undefined,
      summary: undefined,
      failures: undefined,
      error: undefined,
      rawOutput: undefined,
      timedOut: undefined,
      cancelled: undefined,
      coverage: null
    }
    this.touch()
  }

  public setModuleResult(result: ModuleState): void {
    const current = this.state.modules[result.id]

    this.state.modules[result.id] = {
      ...current,
      ...result,
      label: result.label ?? current?.label,
      labels: result.labels ?? current?.labels,
      summary: result.summary ? { ...result.summary } : undefined,
      failures: result.failures ? result.failures.map(failure => ({ ...failure })) : undefined,
      coverage: result.coverage ? { ...result.coverage, entries: result.coverage.entries.map(entry => ({ ...entry })) } : result.coverage ?? null
    }

    if (result.coverage !== undefined) {
      this.state.coverage.modules[result.id] = result.coverage ? { ...result.coverage, entries: result.coverage.entries.map(entry => ({ ...entry })) } : null
      this.recalculateCoverage()
    }

    this.touch()
  }

  public completeRun(completedAt: Date): void {
    this.state.status = 'completed'
    this.state.completedAt = completedAt.toISOString()
    if (this.state.startedAt) {
      this.state.durationMs = completedAt.getTime() - new Date(this.state.startedAt).getTime()
    }
    this.touch()
  }

  public failRun(error: string, completedAt: Date): void {
    this.state.status = 'failed'
    this.state.error = error
    this.state.completedAt = completedAt.toISOString()
    if (this.state.startedAt) {
      this.state.durationMs = completedAt.getTime() - new Date(this.state.startedAt).getTime()
    }
    this.touch()
  }

  private setModuleStatus(moduleId: string, status: ModuleExecutionStatus): void {
    const module = this.state.modules[moduleId] ?? { id: moduleId, status: 'idle' }
    this.state.modules[moduleId] = {
      ...module,
      status
    }
    this.touch()
  }

  private recalculateCoverage(): void {
    const values = Object.values(this.state.coverage.modules).filter((value): value is ModuleCoverageSummary => value !== null)

    if (values.length === 0) {
      this.state.coverage.total = null
      return
    }

    const average = values.reduce((sum, value) => sum + value.total, 0) / values.length
    this.state.coverage.total = parseFloat(average.toFixed(2))
  }
}
