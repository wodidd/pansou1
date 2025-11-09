import { spawn as defaultSpawn, type ChildProcess, type SpawnOptionsWithoutStdio } from 'child_process'
import { EventEmitter } from 'events'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'

import { TestStatusStore } from './status-store.js'
import { parseGoCoverageReport, parseGoTestJson, parseJestJson } from './parsers.js'
import type { JestParseResult } from './parsers.js'
import {
  ModuleState,
  TestModuleDefinition,
  TestStatusSnapshot,
  TestSummary
} from './types.js'

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000

export interface TestRunnerOptions {
  artifactDir?: string
  goBinary?: string
  spawnFn?: SpawnFunction
  now?: () => Date
}

interface RunProcessOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
  timeoutMs?: number
}

interface RunProcessResult {
  code: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
  error?: Error
  timedOut: boolean
  cancelled: boolean
}

type SpawnFunction = (command: string, args: string[], options: SpawnOptionsWithoutStdio) => ChildProcess

class CancellationError extends Error {
  constructor(message = 'test run cancelled') {
    super(message)
    this.name = 'CancellationError'
  }
}

export class TestRunner extends EventEmitter {
  private readonly modules: TestModuleDefinition[]
  private readonly store: TestStatusStore
  private readonly artifactDir: string
  private readonly goBinary: string
  private readonly spawnFn: SpawnFunction
  private readonly now: () => Date

  private pendingRun?: Promise<TestStatusSnapshot>
  private deferred = false
  private currentProcess: ChildProcess | null = null
  private cancelRequested = false

  constructor(modules: TestModuleDefinition[], options: TestRunnerOptions = {}) {
    super()
    this.modules = modules
    this.goBinary = options.goBinary ?? 'go'
    this.spawnFn = options.spawnFn ?? defaultSpawn
    this.now = options.now ?? (() => new Date())
    this.artifactDir = options.artifactDir ?? path.join(os.tmpdir(), 'dashboard-test-runner')
    this.store = new TestStatusStore(modules, this.now)
  }

  public get status(): TestStatusSnapshot {
    return this.store.snapshot()
  }

  public async trigger(): Promise<TestStatusSnapshot> {
    return this.triggerInternal()
  }

  public cancel(): void {
    if (this.pendingRun) {
      this.cancelRequested = true
      this.currentProcess?.kill('SIGTERM')
    }
  }

  private async triggerInternal(fromQueue = false): Promise<TestStatusSnapshot> {
    if (this.pendingRun) {
      if (!fromQueue && !this.deferred) {
        this.store.enqueueRun()
        this.emitQueued()
        this.deferred = true
      }
      return this.pendingRun
    }

    if (!fromQueue) {
      this.store.enqueueRun()
      this.emitQueued()
    }

    const runId = this.generateRunId()
    const promise = this.executeRun(runId)
    this.pendingRun = promise

    try {
      return await promise
    } finally {
      this.pendingRun = undefined
      const shouldReplay = this.deferred
      this.deferred = false
      if (shouldReplay) {
        void this.triggerInternal(true)
      }
    }
  }

  private async executeRun(runId: string): Promise<TestStatusSnapshot> {
    this.cancelRequested = false
    await this.ensureArtifactDirectory()

    const startedAt = this.now()
    this.store.startRun(runId, startedAt)
    this.emitRunning()

    try {
      for (const module of this.modules) {
        if (this.cancelRequested) {
          throw new CancellationError()
        }

        const moduleStart = this.now()
        this.store.markModuleRunning(module.id, moduleStart)
        const result = await this.executeModule(module, runId, moduleStart)
        this.store.setModuleResult(result)

        if (result.status === 'failed') {
          if (result.cancelled) {
            throw new CancellationError()
          }
          const message = result.error ?? `module ${module.id} reported failures`
          throw new Error(message)
        }
      }

      const completedAt = this.now()
      this.store.completeRun(completedAt)
      const snapshot = this.store.snapshot()
      await this.persistSnapshot(snapshot, runId)
      this.emitCompleted(snapshot)
      return snapshot
    } catch (error) {
      const completedAt = this.now()
      const message = error instanceof Error ? error.message : String(error)
      this.store.failRun(message, completedAt)
      const snapshot = this.store.snapshot()
      await this.persistSnapshot(snapshot, runId)
      if (error instanceof CancellationError) {
        this.emitFailed(snapshot)
      } else {
        this.emitFailed(snapshot)
      }
      return snapshot
    } finally {
      this.cancelRequested = false
    }
  }

  private async executeModule(module: TestModuleDefinition, runId: string, startedAt: Date): Promise<ModuleState> {
    switch (module.type) {
      case 'go':
        return this.executeGoModule(module, runId, startedAt)
      case 'jest':
        return this.executeJestModule(module, startedAt)
      default:
        return this.executeGenericModule(module, startedAt)
    }
  }

  private async executeGoModule(module: TestModuleDefinition, runId: string, startedAt: Date): Promise<ModuleState> {
    const { command, args, profilePath } = this.prepareGoCommand(module, runId)
    const result = await this.runProcess(command, args, {
      cwd: module.cwd,
      env: module.env,
      timeoutMs: module.timeoutMs ?? DEFAULT_TIMEOUT_MS
    })

    const completedAt = this.now()
    const durationMs = completedAt.getTime() - startedAt.getTime()
    const goSummary = parseGoTestJson(result.stdout)

    let coverage = null
    if (profilePath && !result.timedOut && !result.cancelled && !result.error) {
      try {
        await fs.access(profilePath)
        const coverResult = await this.runProcess(this.goBinary, ['tool', 'cover', `-func=${profilePath}`], {
          cwd: module.cwd,
          env: module.env,
          timeoutMs: module.timeoutMs ?? DEFAULT_TIMEOUT_MS
        })
        if (!coverResult.error && !coverResult.timedOut && coverResult.code === 0) {
          coverage = parseGoCoverageReport(coverResult.stdout, profilePath)
        }
      } catch {
        coverage = null
      }
    }

    const status = this.resolveModuleStatus(result, goSummary.success)
    const failures = goSummary.failures
    const moduleState: ModuleState = {
      id: module.id,
      label: module.label,
      labels: module.labels,
      status,
      durationMs,
      summary: goSummary.summary,
      failures,
      error: this.resolveModuleError(result, failures),
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      coverage,
      rawOutput: result.stdout,
      timedOut: result.timedOut || undefined,
      cancelled: result.cancelled || undefined
    }

    if (status === 'passed') {
      moduleState.error = undefined
    } else if (!moduleState.error && result.stderr.trim().length > 0) {
      moduleState.error = result.stderr.trim()
    }

    return moduleState
  }

  private async executeJestModule(module: TestModuleDefinition, startedAt: Date): Promise<ModuleState> {
    const command = module.command
    const args = module.args ?? []
    const result = await this.runProcess(command, args, {
      cwd: module.cwd,
      env: module.env,
      timeoutMs: module.timeoutMs ?? DEFAULT_TIMEOUT_MS
    })

    const completedAt = this.now()
    const durationMs = completedAt.getTime() - startedAt.getTime()
    const jestSummary: JestParseResult = parseJestJson(result.stdout)

    const status = this.resolveModuleStatus(result, jestSummary.success)
    const failures = jestSummary.failures
    const moduleState: ModuleState = {
      id: module.id,
      label: module.label,
      labels: module.labels,
      status,
      durationMs,
      summary: jestSummary.summary,
      failures,
      error: this.resolveModuleError(result, failures),
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      coverage: null,
      rawOutput: result.stdout,
      timedOut: result.timedOut || undefined,
      cancelled: result.cancelled || undefined
    }

    if (typeof jestSummary.durationMs === 'number') {
      moduleState.durationMs = jestSummary.durationMs
    }

    if (status === 'passed') {
      moduleState.error = undefined
    } else if (!moduleState.error && result.stderr.trim().length > 0) {
      moduleState.error = result.stderr.trim()
    }

    return moduleState
  }

  private async executeGenericModule(module: TestModuleDefinition, startedAt: Date): Promise<ModuleState> {
    const result = await this.runProcess(module.command, module.args ?? [], {
      cwd: module.cwd,
      env: module.env,
      timeoutMs: module.timeoutMs ?? DEFAULT_TIMEOUT_MS
    })

    const completedAt = this.now()
    const durationMs = completedAt.getTime() - startedAt.getTime()
    const summary: TestSummary = {
      total: 0,
      passed: result.code === 0 ? 1 : 0,
      failed: result.code === 0 ? 0 : 1,
      skipped: 0
    }

    const status = this.resolveModuleStatus(result, result.code === 0)
    const moduleState: ModuleState = {
      id: module.id,
      label: module.label,
      labels: module.labels,
      status,
      durationMs,
      summary,
      failures: status === 'failed' ? [{ message: this.resolveModuleError(result, []) ?? 'command failed' }] : [],
      error: status === 'failed' ? this.resolveModuleError(result, []) ?? undefined : undefined,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      coverage: null,
      rawOutput: result.stdout,
      timedOut: result.timedOut || undefined,
      cancelled: result.cancelled || undefined
    }

    return moduleState
  }

  private resolveModuleStatus(result: RunProcessResult, success: boolean): 'passed' | 'failed' {
    if (result.cancelled) {
      return 'failed'
    }
    if (result.timedOut) {
      return 'failed'
    }
    if (result.error) {
      return 'failed'
    }
    return success && result.code === 0 ? 'passed' : 'failed'
  }

  private resolveModuleError(result: RunProcessResult, failures: ModuleState['failures'] = []): string | undefined {
    if (result.cancelled) {
      return 'run cancelled'
    }
    if (result.timedOut) {
      return 'command timed out'
    }
    if (result.error) {
      if ((result.error as NodeJS.ErrnoException).code === 'ENOENT') {
        return `command not found: ${(result.error as NodeJS.ErrnoException).path ?? result.error.message}`
      }
      return result.error.message
    }
    if (failures && failures.length > 0) {
      return failures.map(failure => failure.message).join('\n')
    }
    return undefined
  }

  private prepareGoCommand(module: TestModuleDefinition, runId: string): { command: string; args: string[]; profilePath?: string } {
    const command = module.command || this.goBinary
    const args = [...(module.args ?? [])]
    const mutableArgs = [...args]
    let testIndex = mutableArgs.indexOf('test')
    if (testIndex === -1) {
      mutableArgs.unshift('test')
      testIndex = 0
    }

    let insertIndex = testIndex + 1
    if (!mutableArgs.includes('-json')) {
      mutableArgs.splice(insertIndex, 0, '-json')
      insertIndex += 1
    }

    let profilePath: string | undefined
    if (module.coverage !== false) {
      const existingProfileIndex = mutableArgs.findIndex(arg => arg.startsWith('-coverprofile'))
      if (existingProfileIndex === -1) {
        profilePath = this.coverageProfilePath(module.id, runId)
        mutableArgs.splice(insertIndex, 0, `-coverprofile=${profilePath}`)
      } else {
        const existing = mutableArgs[existingProfileIndex]
        const parts = existing.split('=')
        if (parts.length === 2 && parts[1].length > 0) {
          profilePath = parts[1]
        } else {
          profilePath = this.coverageProfilePath(module.id, runId)
          mutableArgs[existingProfileIndex] = `-coverprofile=${profilePath}`
        }
      }
    }

    return {
      command,
      args: mutableArgs,
      profilePath
    }
  }

  private coverageProfilePath(moduleId: string, runId: string): string {
    return path.join(this.artifactDir, `${runId}-${moduleId}-cover.out`)
  }

  private async runProcess(command: string, args: string[], options: RunProcessOptions): Promise<RunProcessResult> {
    const spawnOptions: SpawnOptionsWithoutStdio = {
      cwd: options.cwd,
      env: options.env,
      stdio: 'pipe'
    }

    return await new Promise<RunProcessResult>((resolve) => {
      let resolved = false
      let stdout = ''
      let stderr = ''
      let timedOut = false
      let timeoutHandle: NodeJS.Timeout | undefined
      let spawnError: Error | undefined

      const child = this.spawnFn(command, args, spawnOptions)
      this.currentProcess = child

      const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
      if (timeoutMs > 0) {
        timeoutHandle = setTimeout(() => {
          timedOut = true
          child.kill('SIGKILL')
        }, timeoutMs)
      }

      child.stdout?.on('data', chunk => {
        stdout += chunk.toString()
      })

      child.stderr?.on('data', chunk => {
        stderr += chunk.toString()
      })

      const finalize = (code: number | null, signal: NodeJS.Signals | null) => {
        if (resolved) {
          return
        }
        resolved = true
        if (timeoutHandle) {
          clearTimeout(timeoutHandle)
        }
        if (this.currentProcess === child) {
          this.currentProcess = null
        }
        const cancelled = signal === 'SIGTERM' && this.cancelRequested && !timedOut
        resolve({
          code,
          signal,
          stdout,
          stderr,
          error: spawnError,
          timedOut,
          cancelled
        })
      }

      child.on('error', error => {
        spawnError = error
        finalize(null, null)
      })

      child.on('close', (code, signal) => {
        finalize(code, signal)
      })
    })
  }

  private async ensureArtifactDirectory(): Promise<void> {
    await fs.mkdir(this.artifactDir, { recursive: true })
  }

  private async persistSnapshot(snapshot: TestStatusSnapshot, runId: string): Promise<void> {
    const runPath = path.join(this.artifactDir, `${runId}.json`)
    const statusPath = path.join(this.artifactDir, 'status.json')
    const payload = JSON.stringify(snapshot, null, 2)
    await fs.writeFile(runPath, payload, 'utf8')
    await fs.writeFile(statusPath, payload, 'utf8')
  }

  private emitQueued(): void {
    this.emit('queued', this.store.snapshot())
  }

  private emitRunning(): void {
    this.emit('running', this.store.snapshot())
  }

  private emitCompleted(snapshot: TestStatusSnapshot): void {
    this.emit('completed', snapshot)
  }

  private emitFailed(snapshot: TestStatusSnapshot): void {
    this.emit('failed', snapshot)
  }

  private generateRunId(): string {
    return this.now().toISOString().replace(/[:.]/g, '-')
  }
}
