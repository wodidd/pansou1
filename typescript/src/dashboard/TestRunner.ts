import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { 
  TestModule, 
  TestResult, 
  TestStatus, 
  TestRunnerConfig, 
  TestRunnerEvent, 
  GoTestEvent, 
  JestTestResult,
  CoverageData 
} from './types.js';
import { TestStatusStore } from './TestStatusStore.js';

export class TestRunner extends EventEmitter {
  private store: TestStatusStore;
  private config: TestRunnerConfig;
  private runningRuns: Set<string> = new Set();
  private queuedRuns: Map<string, { modules: TestModule[]; resolve: (status: TestStatus) => void; reject: (error: Error) => void }> = new Map();

  constructor(config: TestRunnerConfig) {
    super();
    this.config = config;
    this.store = new TestStatusStore(config.cacheDirectory);
  }

  async initialize(): Promise<void> {
    await this.store.initialize();
  }

  on(event: string, listener: (data: TestRunnerEvent) => void): this {
    return super.on(event, listener);
  }

  async runTests(modules: TestModule[]): Promise<TestStatus> {
    const runId = this.generateRunId();
    
    // Check if already running maximum concurrent runs
    if (this.runningRuns.size >= this.config.maxConcurrentRuns) {
      throw new Error(`Maximum concurrent runs (${this.config.maxConcurrentRuns}) exceeded`);
    }

    // Create status
    const status = this.store.createStatus(runId, modules.map(m => m.id));
    this.store.updateStatus(runId, { status: 'queued' });
    
    // Emit queued event
    this.emit('test:queued', { type: 'queued', runId } as TestRunnerEvent);
    
    // Save initial status
    await this.store.saveStatus(runId);
    
    // Add to running runs
    this.runningRuns.add(runId);
    
    try {
      return await this.executeModules(runId, modules);
    } finally {
      this.runningRuns.delete(runId);
    }
  }

  private async executeModules(runId: string, modules: TestModule[]): Promise<TestStatus> {
    // Update status to running
    this.store.updateStatus(runId, { 
      status: 'running', 
      startTime: new Date() 
    });
    
    this.emit('test:started', { type: 'started', runId, modules } as TestRunnerEvent);
    await this.store.saveStatus(runId);

    let hasFailures = false;
    let overallError: string | undefined;

    // Execute modules sequentially
    for (const module of modules) {
      try {
        this.emit('test:moduleStarted', { type: 'moduleStarted', runId, moduleId: module.id } as TestRunnerEvent);
        
        const result = await this.executeModule(runId, module);
        
        this.store.updateModuleResult(runId, module.id, result);
        
        if (result.status === 'failed') {
          hasFailures = true;
        }
        
        this.emit('test:moduleCompleted', { type: 'moduleCompleted', runId, moduleId: module.id, result } as TestRunnerEvent);
        
        // Save status after each module
        await this.store.saveStatus(runId);
        
      } catch (error) {
        hasFailures = true;
        overallError = error instanceof Error ? error.message : String(error);
        
        this.store.updateModuleResult(runId, module.id, {
          status: 'failed',
          error: overallError,
          duration: 0,
          passCount: 0,
          failCount: 1,
          skipCount: 0,
        });
        
        break; // Stop on first module failure
      }
    }

    // Calculate final status
    const endTime = new Date();
    const startTime = this.store.getStatus(runId)?.startTime;
    const duration = startTime ? endTime.getTime() - startTime.getTime() : 0;

    const finalStatus = this.store.updateStatus(runId, {
      status: hasFailures ? 'failed' : 'completed',
      endTime,
      duration,
      error: overallError,
    });

    if (!finalStatus) {
      throw new Error('Failed to retrieve final status');
    }

    // Parse coverage if enabled
    if (this.config.enableCoverage) {
      await this.parseCoverage(runId, modules);
    }

    await this.store.saveStatus(runId);

    if (hasFailures) {
      this.emit('test:failed', { type: 'failed', runId, error: overallError || 'Unknown error', status: finalStatus } as TestRunnerEvent);
    } else {
      this.emit('test:completed', { type: 'completed', runId, status: finalStatus } as TestRunnerEvent);
    }

    return finalStatus;
  }

  private async executeModule(runId: string, module: TestModule): Promise<TestResult> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let child: ChildProcess;
      let timeoutId: NodeJS.Timeout;

      const timeout = module.timeout || this.config.defaultTimeout;

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (child && !child.killed) {
          child.kill('SIGTERM');
        }
      };

      // Set up timeout
      timeoutId = setTimeout(() => {
        cleanup();
        resolve({
          moduleId: module.id,
          status: 'timeout',
          duration: timeout,
          passCount: 0,
          failCount: 0,
          skipCount: 0,
          error: `Command timed out after ${timeout}ms`,
        });
      }, timeout);

      try {
        // Check if command exists
        const [command, ...args] = module.command.split(' ');
        
        child = spawn(command, args, {
          cwd: module.workingDirectory,
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true,
        });

        let stdout = '';
        let stderr = '';
        let output: string[] = [];

        child.stdout?.on('data', (data) => {
          const chunk = data.toString();
          stdout += chunk;
          output.push(chunk);
        });

        child.stderr?.on('data', (data) => {
          const chunk = data.toString();
          stderr += chunk;
          output.push(chunk);
        });

        child.on('close', async (code) => {
          cleanup();
          
          const duration = Date.now() - startTime;
          
          try {
            const result = await this.parseTestOutput(module, stdout, stderr, code || 0, duration);
            resolve(result);
          } catch (parseError) {
            resolve({
              moduleId: module.id,
              status: code === 0 ? 'passed' : 'failed',
              duration,
              passCount: 0,
              failCount: code === 0 ? 0 : 1,
              skipCount: 0,
              error: parseError instanceof Error ? parseError.message : String(parseError),
              output,
            });
          }
        });

        child.on('error', (error) => {
          cleanup();
          reject(error);
        });

      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }

  private async parseTestOutput(module: TestModule, stdout: string, stderr: string, exitCode: number, duration: number): Promise<TestResult> {
    // Try to parse as Go test JSON output
    if (module.command.includes('go test') && stdout.includes('"Time"')) {
      return this.parseGoTestOutput(module.id, stdout, duration);
    }
    
    // Try to parse as Jest JSON output
    if (module.command.includes('jest') || stdout.includes('"numPassingTests"')) {
      return this.parseJestOutput(module.id, stdout, duration);
    }
    
    // Fallback to basic parsing
    return this.parseBasicOutput(module.id, stdout, stderr, exitCode, duration);
  }

  private parseGoTestOutput(moduleId: string, output: string, duration: number): TestResult {
    const lines = output.split('\n').filter(line => line.trim());
    let passCount = 0;
    let failCount = 0;
    let skipCount = 0;
    let error: string | undefined;

    for (const line of lines) {
      try {
        const event = JSON.parse(line) as GoTestEvent;
        
        switch (event.Action) {
          case 'pass':
            passCount++;
            break;
          case 'fail':
            failCount++;
            if (event.Output) {
              error = (error || '') + event.Output;
            }
            break;
          case 'skip':
            skipCount++;
            break;
        }
      } catch {
        // Ignore non-JSON lines
      }
    }

    return {
      moduleId,
      status: failCount > 0 ? 'failed' : 'passed',
      duration,
      passCount,
      failCount,
      skipCount,
      error,
    };
  }

  private parseJestOutput(moduleId: string, output: string, duration: number): TestResult {
    try {
      const jestResult = JSON.parse(output) as JestTestResult;
      
      return {
        moduleId,
        status: jestResult.numFailingTests > 0 ? 'failed' : 'passed',
        duration,
        passCount: jestResult.numPassingTests,
        failCount: jestResult.numFailingTests,
        skipCount: jestResult.numPendingTests,
      };
    } catch {
      // Fallback if JSON parsing fails
      return {
        moduleId,
        status: 'failed',
        duration,
        passCount: 0,
        failCount: 1,
        skipCount: 0,
        error: 'Failed to parse Jest output',
      };
    }
  }

  private parseBasicOutput(moduleId: string, stdout: string, stderr: string, exitCode: number, duration: number): TestResult {
    // Simple regex-based test counting
    const passMatches = stdout.match(/PASS|✓|passed/gi) || [];
    const failMatches = stdout.match(/FAIL|✗|failed/gi) || [];
    const skipMatches = stdout.match(/SKIP|skipped/gi) || [];

    return {
      moduleId,
      status: exitCode === 0 ? 'passed' : 'failed',
      duration,
      passCount: passMatches.length,
      failCount: failMatches.length,
      skipCount: skipMatches.length,
      error: exitCode !== 0 ? stderr || undefined : undefined,
    };
  }

  private async parseCoverage(runId: string, modules: TestModule[]): Promise<void> {
    for (const module of modules) {
      try {
        const coverageData = await this.parseModuleCoverage(module);
        if (coverageData) {
          this.store.addCoverageData(runId, coverageData);
        }
      } catch (error) {
        console.error(`Failed to parse coverage for module ${module.id}:`, error);
      }
    }
  }

  private async parseModuleCoverage(module: TestModule): Promise<CoverageData | null> {
    const coverFile = join(module.workingDirectory, 'cover.out');
    
    try {
      // Check if coverage file exists
      await fs.access(coverFile);
      
      // Parse coverage using go tool cover
      const { spawn } = await import('child_process');
      
      return new Promise((resolve, reject) => {
        const child = spawn('go', ['tool', 'cover', '-func', coverFile], {
          cwd: module.workingDirectory,
        });
        
        let output = '';
        
        child.stdout?.on('data', (data) => {
          output += data.toString();
        });
        
        child.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`go tool cover failed with code ${code}`));
            return;
          }
          
          try {
            const coverageData = this.parseGoCoverageOutput(module.id, output);
            resolve(coverageData);
          } catch (error) {
            reject(error);
          }
        });
        
        child.on('error', reject);
      });
    } catch {
      // Coverage file doesn't exist or go tool not available
      return null;
    }
  }

  private parseGoCoverageOutput(moduleId: string, output: string): CoverageData {
    const lines = output.split('\n');
    let totalLines = 0;
    let coveredLines = 0;
    
    for (const line of lines) {
      if (line.includes('total:')) {
        const match = line.match(/(\d+\.\d+)% of statements/);
        if (match) {
          const percentage = parseFloat(match[1]);
          // Extract the raw numbers from the line before this one
          const prevLine = lines[lines.indexOf(line) - 1];
          const numberMatch = prevLine.match(/(\d+)\s+(\d+)/);
          if (numberMatch) {
            totalLines = parseInt(numberMatch[1]);
            coveredLines = Math.round((percentage / 100) * totalLines);
          }
          break;
        }
      }
    }
    
    return {
      moduleId,
      totalLines,
      coveredLines,
      percentage: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
      functions: {
        total: 0,
        covered: 0,
      },
    };
  }

  async cancelRun(runId: string): Promise<boolean> {
    const status = this.store.getStatus(runId);
    if (!status || status.status === 'completed' || status.status === 'failed') {
      return false;
    }
    
    this.store.updateStatus(runId, { status: 'cancelled', endTime: new Date() });
    this.runningRuns.delete(runId);
    
    const updatedStatus = this.store.getStatus(runId);
    if (updatedStatus) {
      this.emit('test:cancelled', { type: 'cancelled', runId, status: updatedStatus } as TestRunnerEvent);
    }
    
    await this.store.saveStatus(runId);
    return true;
  }

  getStatus(runId: string): TestStatus | undefined {
    return this.store.getStatus(runId);
  }

  getAllStatuses(): TestStatus[] {
    return this.store.getAllStatuses();
  }

  getMetrics() {
    return this.store.getMetrics();
  }

  private generateRunId(): string {
    return `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async checkToolchains(): Promise<{ go: boolean; node: boolean; jest: boolean }> {
    const checkCommand = async (command: string): Promise<boolean> => {
      return new Promise((resolve) => {
        const child = spawn(command, ['--version'], { shell: true });
        child.on('close', (code) => resolve(code === 0));
        child.on('error', () => resolve(false));
      });
    };

    const [go, node, jest] = await Promise.all([
      checkCommand('go'),
      checkCommand('node'),
      checkCommand('jest'),
    ]);

    return { go, node, jest };
  }
}