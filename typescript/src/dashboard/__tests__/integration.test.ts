import { TestRunner } from '../TestRunner';
import { TestStatusStore } from '../TestStatusStore';
import { TestModule, TestRunnerEvent } from '../types';
import { promises as fs } from 'fs';
import { join } from 'path';

describe('Dashboard Integration Tests', () => {
  let testRunner: TestRunner;
  let store: TestStatusStore;
  let cacheDir: string;

  beforeEach(async () => {
    cacheDir = join(process.cwd(), '.test-cache', `integration-${Date.now()}`);
    
    testRunner = new TestRunner({
      cacheDirectory: cacheDir,
      defaultTimeout: 10000,
      maxConcurrentRuns: 1,
      enableCoverage: true,
    });

    store = new TestStatusStore(cacheDir);
    await store.initialize();
    await testRunner.initialize();
  });

  afterEach(async () => {
    await store.clearAll();
    try {
      await fs.rm(cacheDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('complete test workflow', () => {
    it('should execute a complete test run lifecycle', async () => {
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

      // Create test modules that use simple shell commands
      const modules: TestModule[] = [
        {
          id: 'shell-test',
          name: 'Shell Command Test',
          command: 'echo "PASS test1" && echo "PASS test2"',
          workingDirectory: '/tmp',
          labels: ['shell', 'basic'],
        },
        {
          id: 'failing-test',
          name: 'Failing Test',
          command: 'echo "FAIL test1" && exit 1',
          workingDirectory: '/tmp',
          labels: ['shell', 'failure'],
          timeout: 2000,
        },
      ];

      const finalStatus = await testRunner.runTests(modules);

      // Verify final status
      expect(finalStatus.status).toBe('failed'); // Should fail due to second module
      expect(finalStatus.modules).toHaveLength(2);
      expect(finalStatus.modules[0].status).toBe('passed');
      expect(finalStatus.modules[1].status).toBe('failed');
      expect(finalStatus.duration).toBeGreaterThan(0);

      // Verify events were emitted
      expect(events.length).toBeGreaterThan(0);
      const eventTypes = events.map(e => e.type);
      expect(eventTypes).toContain('queued');
      expect(eventTypes).toContain('started');
      expect(eventTypes).toContain('moduleStarted');
      expect(eventTypes).toContain('moduleCompleted');
      expect(eventTypes).toContain('failed');

      // Verify status persistence
      const savedStatus = await store.loadStatus(finalStatus.id);
      expect(savedStatus).toEqual(finalStatus);
    });

    it('should handle successful run with all modules passing', async () => {
      const modules: TestModule[] = [
        {
          id: 'success-1',
          name: 'Success Test 1',
          command: 'echo "All tests passed ✓"',
          workingDirectory: '/tmp',
          labels: ['success'],
        },
        {
          id: 'success-2',
          name: 'Success Test 2',
          command: 'echo "PASS: All good"',
          workingDirectory: '/tmp',
          labels: ['success'],
        },
      ];

      const finalStatus = await testRunner.runTests(modules);

      expect(finalStatus.status).toBe('completed');
      expect(finalStatus.modules.every(m => m.status === 'passed')).toBe(true);
      expect(finalStatus.error).toBeUndefined();
    });

    it('should handle timeout scenarios', async () => {
      const modules: TestModule[] = [
        {
          id: 'timeout-test',
          name: 'Timeout Test',
          command: 'sleep 20', // Sleep longer than timeout
          workingDirectory: '/tmp',
          labels: ['timeout'],
          timeout: 1000, // 1 second timeout
        },
      ];

      const finalStatus = await testRunner.runTests(modules);

      expect(finalStatus.status).toBe('failed');
      expect(finalStatus.modules[0].status).toBe('timeout');
      expect(finalStatus.modules[0].error).toContain('timed out');
    });
  });

  describe('coverage aggregation', () => {
    it('should aggregate coverage data correctly', async () => {
      // Create a mock coverage file
      const tempDir = join(cacheDir, 'temp');
      await fs.mkdir(tempDir, { recursive: true });
      
      const mockCoverageOutput = `mode: atomic
example.go:10:10 ExampleFunc 100.0%
example.go:20:10 AnotherFunc 50.0%
total: statements 75.0% of statements`;

      await fs.writeFile(join(tempDir, 'cover.out'), mockCoverageOutput);

      const modules: TestModule[] = [
        {
          id: 'coverage-test',
          name: 'Coverage Test',
          command: 'echo "PASS test"',
          workingDirectory: tempDir,
          labels: ['coverage'],
        },
      ];

      // Mock the go tool cover command
      const { spawn: originalSpawn } = await import('child_process');
      const childProcessModule = await import('child_process');
      
      (childProcessModule.spawn as jest.Mock) = jest.fn((cmd: string, args: string[]) => {
        if (cmd === 'go' && args.includes('-func')) {
          const mockProcess = {
            stdout: {
              on: (event: string, callback: Function) => {
                if (event === 'data') {
                  callback(mockCoverageOutput);
                }
              },
            },
            on: (event: string, callback: Function) => {
              if (event === 'close') {
                callback(0);
              }
            },
          };
          return mockProcess;
        }
        return originalSpawn(cmd, args);
      });

      try {
        const finalStatus = await testRunner.runTests(modules);

        expect(finalStatus.coverageData).toHaveLength(1);
        expect(finalStatus.coverageData[0].moduleId).toBe('coverage-test');
        expect(finalStatus.coverageData[0].percentage).toBe(75);
        expect(finalStatus.overallCoverage).toBe(75);
      } finally {
        (childProcessModule.spawn as jest.Mock) = originalSpawn;
      }
    });
  });

  describe('state transitions', () => {
    it('should properly transition through all states', async () => {
      const events: TestRunnerEvent[] = [];
      testRunner.on((event: TestRunnerEvent) => {
        events.push(event);
      });

      const modules: TestModule[] = [
        {
          id: 'state-test',
          name: 'State Test',
          command: 'echo "PASS test"',
          workingDirectory: '/tmp',
          labels: ['state'],
        },
      ];

      const finalStatus = await testRunner.runTests(modules);

      // Verify state progression
      const stateProgression = [
        'queued',
        'running',
        'completed'
      ];

      events.forEach(event => {
        if (event.type === 'queued') {
          const status = testRunner.getStatus(event.runId);
          expect(status?.status).toBe('queued');
        } else if (event.type === 'started') {
          const status = testRunner.getStatus(event.runId);
          expect(status?.status).toBe('running');
        } else if (event.type === 'completed') {
          const status = testRunner.getStatus(event.runId);
          expect(status?.status).toBe('completed');
        }
      });

      expect(finalStatus.status).toBe('completed');
    });
  });

  describe('metrics calculation', () => {
    it('should calculate accurate metrics across multiple runs', async () => {
      // Run multiple tests
      const successfulModules: TestModule[] = [
        {
          id: 'success',
          name: 'Success Test',
          command: 'echo "PASS test"',
          workingDirectory: '/tmp',
          labels: ['success'],
        },
      ];

      const failingModules: TestModule[] = [
        {
          id: 'failure',
          name: 'Failure Test',
          command: 'exit 1',
          workingDirectory: '/tmp',
          labels: ['failure'],
        },
      ];

      // Execute runs
      await testRunner.runTests(successfulModules);
      await testRunner.runTests(failingModules);

      const metrics = testRunner.getMetrics();

      expect(metrics.totalRuns).toBe(2);
      expect(metrics.completedRuns).toBe(1);
      expect(metrics.failedRuns).toBe(1);
      expect(metrics.runningRuns).toBe(0);
      expect(metrics.queuedRuns).toBe(0);
    });
  });

  describe('error handling and recovery', () => {
    it('should handle missing commands gracefully', async () => {
      const modules: TestModule[] = [
        {
          id: 'missing-cmd',
          name: 'Missing Command Test',
          command: 'nonexistent-command-12345',
          workingDirectory: '/tmp',
          labels: ['error'],
        },
      ];

      const finalStatus = await testRunner.runTests(modules);

      expect(finalStatus.status).toBe('failed');
      expect(finalStatus.modules[0].status).toBe('failed');
      expect(finalStatus.modules[0].error).toBeDefined();
    });

    it('should handle invalid working directories', async () => {
      const modules: TestModule[] = [
        {
          id: 'invalid-dir',
          name: 'Invalid Directory Test',
          command: 'echo "test"',
          workingDirectory: '/nonexistent/directory/path/12345',
          labels: ['error'],
        },
      ];

      // This should handle the error gracefully
      const finalStatus = await testRunner.runTests(modules);

      expect(finalStatus.status).toBe('failed');
    });
  });
});