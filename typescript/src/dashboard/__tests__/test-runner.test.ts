import { EventEmitter } from 'events'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { PassThrough } from 'stream'
import type { ChildProcess, SpawnOptionsWithoutStdio } from 'child_process'

import { TestRunner } from '../test-runner.js'
import type { TestModuleDefinition } from '../types.js'

interface SpawnSpec {
  stdout?: string
  stderr?: string
  code?: number
  delayMs?: number
  error?: NodeJS.ErrnoException | Error
  onSpawn?: (command: string, args: string[], options: SpawnOptionsWithoutStdio) => void
}

type SpawnMock = ((command: string, args: string[], options: SpawnOptionsWithoutStdio) => ChildProcess) & {
  history: Array<{ command: string; args: string[] }>
}

class MockChildProcess extends EventEmitter {
  stdout: PassThrough
  stderr: PassThrough
  private readonly closeSpec: { code: number | null; signal: NodeJS.Signals | null }

  constructor(code: number | null, signal: NodeJS.Signals | null) {
    super()
    this.stdout = new PassThrough()
    this.stderr = new PassThrough()
    this.closeSpec = { code, signal }
  }

  kill(signal: NodeJS.Signals = 'SIGTERM'): boolean {
    this.emit('close', this.closeSpec.code, signal)
    return true
  }
}

function createSpawnMock(specs: SpawnSpec[]): SpawnMock {
  const queue = [...specs]
  const history: Array<{ command: string; args: string[] }> = []

  const fn = ((command: string, args: string[], options: SpawnOptionsWithoutStdio) => {
    history.push({ command, args: [...args] })
    const spec = queue.shift() ?? {}
    const child = new MockChildProcess(spec.code ?? 0, null)

    spec.onSpawn?.(command, args, options)

    process.nextTick(() => {
      if (spec.error) {
        child.emit('error', spec.error)
        child.stdout.end()
        child.stderr.end()
        return
      }

      if (spec.stdout) {
        child.stdout.write(spec.stdout)
      }
      child.stdout.end()

      if (spec.stderr) {
        child.stderr.write(spec.stderr)
      }
      child.stderr.end()

      const emitClose = () => child.emit('close', spec.code ?? 0, null)
      if (spec.delayMs && spec.delayMs > 0) {
        setTimeout(emitClose, spec.delayMs)
      } else {
        process.nextTick(emitClose)
      }
    })

    return child as unknown as ChildProcess
  }) as SpawnMock

  fn.history = history
  return fn
}

function createGoTestJson(): string {
  return [
    JSON.stringify({ Action: 'run', Package: 'example', Test: 'TestAlpha' }),
    JSON.stringify({ Action: 'pass', Package: 'example', Test: 'TestAlpha', Elapsed: 0.01 }),
    JSON.stringify({ Action: 'pass', Package: 'example', Elapsed: 0.02 })
  ].join('\n')
}

function createCoverageOutput(): string {
  return [
    'example/service.go:12: Example  80.0%',
    'total: (statements) 80.0%'
  ].join('\n')
}

function createIncrementingNow(startIso: string): () => Date {
  let counter = 0
  const base = new Date(startIso).getTime()
  return () => {
    const date = new Date(base + counter * 1000)
    counter += 1
    return date
  }
}

async function waitFor(condition: () => boolean, timeoutMs = 250): Promise<void> {
  const start = Date.now()
  return await new Promise<void>((resolve, reject) => {
    const tick = () => {
      if (condition()) {
        resolve()
        return
      }
      if (Date.now() - start >= timeoutMs) {
        reject(new Error('timed out waiting for condition'))
        return
      }
      setTimeout(tick, 5)
    }
    tick()
  })
}

describe('TestRunner', () => {
  function buildGoSpawnSpecs(): SpawnSpec[] {
    const goTest: SpawnSpec = {
      stdout: createGoTestJson(),
      code: 0,
      onSpawn: (_command, args) => {
        const profileArg = args.find(arg => arg.startsWith('-coverprofile='))
        if (profileArg) {
          const profilePath = profileArg.split('=')[1]
          if (profilePath) {
            fs.mkdirSync(path.dirname(profilePath), { recursive: true })
            fs.writeFileSync(profilePath, 'mode: set')
          }
        }
      }
    }

    const coverage: SpawnSpec = {
      stdout: createCoverageOutput(),
      code: 0,
      delayMs: 25
    }

    return [goTest, coverage]
  }

  function createModules(): TestModuleDefinition[] {
    return [
      {
        id: 'cache',
        command: 'go',
        args: ['test', './...'],
        type: 'go',
        label: 'Cache',
        coverage: true
      }
    ]
  }

  it('executes modules sequentially and collects coverage', async () => {
    const specs = buildGoSpawnSpecs()
    const spawn = createSpawnMock(specs)
    const artifactDir = path.join(os.tmpdir(), `dashboard-runner-${Date.now()}`)
    const runner = new TestRunner(createModules(), {
      spawnFn: spawn,
      artifactDir,
      now: createIncrementingNow('2024-04-01T00:00:00.000Z')
    })

    const snapshot = await runner.trigger()

    expect(snapshot.status).toBe('completed')
    expect(snapshot.modules.cache.status).toBe('passed')
    expect(snapshot.coverage.total).toBeCloseTo(80)
    expect(snapshot.coverage.modules.cache?.total).toBeCloseTo(80)
    expect(fs.existsSync(path.join(artifactDir, 'status.json'))).toBe(true)
    expect(spawn.history.length).toBe(2)
  })

  it('prevents concurrent runs and schedules follow-up runs when re-triggered', async () => {
    const specs = [...buildGoSpawnSpecs(), ...buildGoSpawnSpecs()]
    const spawn = createSpawnMock(specs)
    const artifactDir = path.join(os.tmpdir(), `dashboard-runner-${Date.now()}-${Math.random()}`)
    const runner = new TestRunner(createModules(), {
      spawnFn: spawn,
      artifactDir,
      now: createIncrementingNow('2024-05-01T00:00:00.000Z')
    })

    const completions: string[] = []
    runner.on('completed', snapshot => {
      completions.push(snapshot.runId ?? '')
    })

    const first = runner.trigger()
    await waitFor(() => runner.status.status === 'running')

    runner.trigger()
    expect(runner.status.queueSize).toBe(1)

    await first
    await waitFor(() => completions.length === 2)

    expect(completions.length).toBe(2)
    expect(spawn.history.length).toBe(4)
    const finalSnapshot = runner.status
    expect(finalSnapshot.queueSize).toBe(0)
  })
})
