export type TestRunStatus = 'idle' | 'queued' | 'running' | 'completed' | 'failed'

export type TestModuleType = 'go' | 'jest' | 'generic'

export interface TestSummary {
  total: number
  passed: number
  failed: number
  skipped: number
}

export interface TestFailureDetail {
  test?: string
  message: string
  output?: string
}

export interface ModuleCoverageEntry {
  name: string
  coverage: number
}

export interface ModuleCoverageSummary {
  profilePath?: string
  total: number
  entries: ModuleCoverageEntry[]
  raw?: string
}

export interface TestModuleDefinition {
  id: string
  label?: string
  labels?: string[]
  command: string
  args?: string[]
  cwd?: string
  env?: NodeJS.ProcessEnv
  type: TestModuleType
  timeoutMs?: number
  coverage?: boolean
}

export type ModuleExecutionStatus = 'idle' | 'queued' | 'running' | 'passed' | 'failed'

export interface ModuleState {
  id: string
  label?: string
  labels?: string[]
  status: ModuleExecutionStatus
  durationMs?: number
  summary?: TestSummary
  failures?: TestFailureDetail[]
  error?: string
  startedAt?: string
  completedAt?: string
  coverage?: ModuleCoverageSummary | null
  rawOutput?: string
  timedOut?: boolean
  cancelled?: boolean
}

export interface TestStatusSnapshot {
  status: TestRunStatus
  runId?: string
  queueSize: number
  startedAt?: string
  completedAt?: string
  durationMs?: number
  error?: string
  modules: Record<string, ModuleState>
  coverage: {
    total: number | null
    modules: Record<string, ModuleCoverageSummary | null>
  }
  lastUpdated: string
}

export type TestRunnerEvent = 'queued' | 'running' | 'completed' | 'failed'
