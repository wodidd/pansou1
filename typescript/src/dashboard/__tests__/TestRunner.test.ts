import { TestRunner } from '../TestRunner';
import { TestModule, TestRunnerEvent } from '../types';
import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

// Mock child_process
jest.mock('child_process');
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

// Mock fs
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    access: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue('{}'),
    readdir: jest.fn().mockResolvedValue([]),
    unlink: jest.fn().mockResolvedValue(undefined),
    rm: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('TestRunner', () => {
  let testRunner: TestRunner;
  let mockChildProcess: any;
  let cacheDir: string;

  beforeEach(async () => {
    cacheDir = `/tmp/test-cache-${Date.now()}`;
    testRunner = new TestRunner({
      cacheDirectory: cacheDir,
      defaultTimeout: 5000,
      maxConcurrentRuns: 2,
      enableCoverage: true,
    });

    await testRunner.initialize();

    // Mock child process
    mockChildProcess = {
      stdout: {
        on: jest.fn(),
      },
      stderr: {
        on: jest.fn(),
      },
      on: jest.fn(),
      kill: jest.fn(),
      killed: false,
    };

    mockSpawn.mockReturnValue(mockChildProcess);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('parseGoTestOutput', () => {
    it('should parse Go test JSON output correctly', () => {
      const goTestOutput = `{"Time":"2023-01-01T00:00:00Z","Action":"run","Package":"./test","Test":"TestExample"}
{"Time":"2023-01-01T00:00:01Z","Action":"pass","Package":"./test","Test":"TestExample","Elapsed":0.1}
{"Time":"2023-01-01T00:00:02Z","Action":"run","Package":"./test","Test":"TestFailed"}
{"Time":"2023-01-01T00:00:03Z","Action":"fail","Package":"./test","Test":"TestFailed","Elapsed":0.2,"Output":"test failed: assertion error"}
{"Time":"2023-01-01T00:00:04Z","Action":"skip","Package":"./test","Test":"TestSkipped"}`;

      // Access private method through type assertion
      const result = (testRunner as any).parseGoTestOutput('module1', goTestOutput, 3000);

      expect(result).toEqual({
        moduleId: 'module1',
        status: 'failed',
        duration: 3000,
        passCount: 1,
        failCount: 1,
        skipCount: 1,
        error: 'test failed: assertion error',
      });
    });

    it('should handle empty Go test output', () => {
      const result = (testRunner as any).parseGoTestOutput('module1', '', 1000);

      expect(result).toEqual({
        moduleId: 'module1',
        status: 'passed',
        duration: 1000,
        passCount: 0,
        failCount: 0,
        skipCount: 0,
      });
    });
  });

  describe('parseJestOutput', () => {
    it('should parse Jest JSON output correctly', () => {
      const jestOutput = JSON.stringify({
        numPassingTests: 5,
        numFailingTests: 2,
        numPendingTests: 1,
        numTotalTests: 8,
        startTime: 1672531200000,
        endTime: 1672531300000,
      });

      const result = (testRunner as any).parseJestOutput('module1', jestOutput, 10000);

      expect(result).toEqual({
        moduleId: 'module1',
        status: 'failed',
        duration: 10000,
        passCount: 5,
        failCount: 2,
        skipCount: 1,
      });
    });

    it('should handle invalid Jest JSON', () => {
      const result = (testRunner as any).parseJestOutput('module1', 'invalid json', 1000);

      expect(result).toEqual({
        moduleId: 'module1',
        status: 'failed',
        duration: 1000,
        passCount: 0,
        failCount: 1,
        skipCount: 0,
        error: 'Failed to parse Jest output',
      });
    });
  });

  describe('parseBasicOutput', () => {
    it('should parse basic test output with regex', () => {
      const stdout = 'PASS Test1\nPASS Test2\nFAIL Test3\nSKIP Test4';
      const stderr = 'Error details';
      const exitCode = 1;

      const result = (testRunner as any).parseBasicOutput('module1', stdout, stderr, exitCode, 2000);

      expect(result).toEqual({
        moduleId: 'module1',
        status: 'failed',
        duration: 2000,
        passCount: 2,
        failCount: 1,
        skipCount: 1,
        error: 'Error details',
      });
    });

    it('should handle successful basic output', () => {
      const stdout = 'All tests passed ✓';
      const stderr = '';
      const exitCode = 0;

      const result = (testRunner as any).parseBasicOutput('module1', stdout, stderr, exitCode, 1500);

      expect(result.status).toBe('passed');
      expect(result.passCount).toBe(1);
      expect(result.failCount).toBe(0);
    });
  });

  describe('parseGoCoverageOutput', () => {
    it('should parse go tool cover output', () => {
      const coverOutput = `mode: atomic
example.go:10:10 ExampleFunc 100.0%
example.go:20:10 AnotherFunc 50.0%
total: statements 80.0% of statements`;

      const result = (testRunner as any).parseGoCoverageOutput('module1', coverOutput);

      expect(result.moduleId).toBe('module1');
      expect(result.percentage).toBe(80);
      expect(result.totalLines).toBeGreaterThan(0);
      expect(result.coveredLines).toBeGreaterThan(0);
    });

    it('should handle coverage output without total line', () => {
      const coverOutput = `mode: atomic
example.go:10:10 ExampleFunc 100.0%`;

      const result = (testRunner as any).parseGoCoverageOutput('module1', coverOutput);

      expect(result.moduleId).toBe('module1');
      expect(result.percentage).toBe(0);
      expect(result.totalLines).toBe(0);
      expect(result.coveredLines).toBe(0);
    });
  });

  describe('event emission', () => {
    it('should emit events during test run', async () => {
      const events: TestRunnerEvent[] = [];
      testRunner.on('test:queued', (event: TestRunnerEvent) => {
        events.push(event);
      });
      testRunner.on('test:started', (event: TestRunnerEvent) => {
        events.push(event);
      });
      testRunner.on('test:moduleStarted', (event: TestRunnerEvent) => {
        events.push(event);
      });
      testRunner.on('test:moduleCompleted', (event: TestRunnerEvent) => {
        events.push(event);
      });
      testRunner.on('test:completed', (event: TestRunnerEvent) => {
        events.push(event);
      });
      testRunner.on('test:failed', (event: TestRunnerEvent) => {
        events.push(event);
      });
      testRunner.on('test:cancelled', (event: TestRunnerEvent) => {
        events.push(event);
      });

      // Mock successful module execution
      mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          jest.useFakeTimers();
          jest.advanceTimersByTime(100);
          callback(0);
        }
      });

      mockChildProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          callback('');
        }
      });

      const modules: TestModule[] = [
        {
          id: 'module1',
          name: 'Test Module 1',
          command: 'echo "test"',
          workingDirectory: '/tmp',
          labels: ['test'],
        },
      ];

      await testRunner.runTests(modules);

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('queued');
      expect(events.some(e => e.type === 'started')).toBe(true);
      expect(events.some(e => e.type === 'moduleStarted')).toBe(true);
      expect(events.some(e => e.type === 'moduleCompleted')).toBe(true);
      expect(events.some(e => e.type === 'completed')).toBe(true);
    });
  });

  describe('concurrency control', () => {
    it('should prevent concurrent runs beyond limit', async () => {
      // Mock a long-running process
      mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          callback(0);
        }
      });

      const modules: TestModule[] = [
        {
          id: 'module1',
          name: 'Test Module 1',
          command: 'sleep 10',
          workingDirectory: '/tmp',
          labels: ['test'],
        },
      ];

      // Start first run
      const firstRun = testRunner.runTests(modules);

      // Try to start second run immediately
      const secondRunPromise = testRunner.runTests(modules);

      await expect(secondRunPromise).rejects.toThrow('Maximum concurrent runs');
      
      // Cancel the first run to clean up
      await testRunner.cancelRun((await firstRun).id);
    });
  });

  describe('checkToolchains', () => {
    it('should check toolchain availability', async () => {
      // Mock successful command execution
      mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          callback(0);
        }
      });

      const result = await testRunner.checkToolchains();

      expect(result).toHaveProperty('go');
      expect(result).toHaveProperty('node');
      expect(result).toHaveProperty('jest');
      expect(typeof result.go).toBe('boolean');
      expect(typeof result.node).toBe('boolean');
      expect(typeof result.jest).toBe('boolean');
    });
  });

  describe('run cancellation', () => {
    it('should cancel a running test', async () => {
      // Mock a long-running process
      mockChildProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          callback(0);
        }
      });

      const modules: TestModule[] = [
        {
          id: 'module1',
          name: 'Test Module 1',
          command: 'sleep 10',
          workingDirectory: '/tmp',
          labels: ['test'],
        },
      ];

      // Start a run
      const runPromise = testRunner.runTests(modules);
      const status = await testRunner.getStatus((await runPromise).id);

      // Cancel the run
      const cancelled = await testRunner.cancelRun(status!.id);

      expect(cancelled).toBe(true);
      
      const finalStatus = testRunner.getStatus(status!.id);
      expect(finalStatus?.status).toBe('cancelled');
    });
  });
});