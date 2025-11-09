import { TestStatusStore } from '../TestStatusStore.js';
import { TestStatus, CoverageData } from '../types.js';
import { promises as fs } from 'fs';
import { join } from 'path';

describe('TestStatusStore', () => {
  let store: TestStatusStore;
  let cacheDir: string;

  beforeEach(async () => {
    cacheDir = join(process.cwd(), '.test-cache', `store-test-${Date.now()}`);
    store = new TestStatusStore(cacheDir);
    await store.initialize();
  });

  afterEach(async () => {
    await store.clearAll();
    try {
      await fs.rm(cacheDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('createStatus', () => {
    it('should create a new status with queued state', () => {
      const moduleIds = ['module1', 'module2'];
      const status = store.createStatus('test-run-1', moduleIds);

      expect(status.id).toBe('test-run-1');
      expect(status.status).toBe('queued');
      expect(status.modules).toHaveLength(2);
      expect(status.modules[0].moduleId).toBe('module1');
      expect(status.modules[0].status).toBe('skipped');
      expect(status.coverageData).toEqual([]);
    });
  });

  describe('updateStatus', () => {
    it('should update status fields', () => {
      const status = store.createStatus('test-run-1', ['module1']);
      const updated = store.updateStatus('test-run-1', { 
        status: 'running',
        startTime: new Date('2023-01-01T00:00:00Z')
      });

      expect(updated?.status).toBe('running');
      expect(updated?.startTime).toEqual(new Date('2023-01-01T00:00:00Z'));
    });

    it('should return undefined for non-existent status', () => {
      const updated = store.updateStatus('non-existent', { status: 'running' });
      expect(updated).toBeUndefined();
    });
  });

  describe('updateModuleResult', () => {
    it('should update module result', () => {
      const status = store.createStatus('test-run-1', ['module1']);
      const updated = store.updateModuleResult('test-run-1', 'module1', {
        status: 'passed',
        passCount: 5,
        failCount: 0,
        skipCount: 0,
        duration: 1000,
      });

      expect(updated?.modules[0].status).toBe('passed');
      expect(updated?.modules[0].passCount).toBe(5);
    });

    it('should return undefined for non-existent module', () => {
      store.createStatus('test-run-1', ['module1']);
      const updated = store.updateModuleResult('test-run-1', 'non-existent', {
        status: 'passed',
        passCount: 5,
        failCount: 0,
        skipCount: 0,
        duration: 1000,
      });

      expect(updated).toBeUndefined();
    });
  });

  describe('addCoverageData', () => {
    it('should add coverage data and calculate overall coverage', () => {
      const status = store.createStatus('test-run-1', ['module1', 'module2']);
      
      const coverage1: CoverageData = {
        moduleId: 'module1',
        totalLines: 100,
        coveredLines: 80,
        percentage: 80,
        functions: { total: 10, covered: 8 }
      };

      const coverage2: CoverageData = {
        moduleId: 'module2',
        totalLines: 50,
        coveredLines: 25,
        percentage: 50,
        functions: { total: 5, covered: 2 }
      };

      store.addCoverageData('test-run-1', coverage1);
      let updated = store.getStatus('test-run-1');
      expect(updated?.coverageData).toHaveLength(1);
      expect(updated?.overallCoverage).toBe(80);

      store.addCoverageData('test-run-1', coverage2);
      updated = store.getStatus('test-run-1');
      expect(updated?.coverageData).toHaveLength(2);
      expect(updated?.overallCoverage).toBe(70); // (80 + 25) / (100 + 50) * 100
    });
  });

  describe('persistence', () => {
    it('should save and load status', async () => {
      const originalStatus = store.createStatus('test-run-1', ['module1']);
      store.updateStatus('test-run-1', { 
        status: 'completed',
        startTime: new Date('2023-01-01T00:00:00Z'),
        endTime: new Date('2023-01-01T00:01:00Z')
      });

      await store.saveStatus('test-run-1');

      // Create new store instance
      const newStore = new TestStatusStore(cacheDir);
      await newStore.initialize();
      
      const loadedStatus = await newStore.loadStatus('test-run-1');
      
      expect(loadedStatus?.id).toBe(originalStatus.id);
      expect(loadedStatus?.status).toBe('completed');
      expect(loadedStatus?.startTime).toEqual(new Date('2023-01-01T00:00:00Z'));
      expect(loadedStatus?.endTime).toEqual(new Date('2023-01-01T00:01:00Z'));
    });

    it('should return undefined for non-existent file', async () => {
      const loaded = await store.loadStatus('non-existent');
      expect(loaded).toBeUndefined();
    });
  });

  describe('getMetrics', () => {
    it('should calculate correct metrics', () => {
      // Create different status types
      store.createStatus('run-1', ['module1']);
      store.updateStatus('run-1', { status: 'queued' });

      store.createStatus('run-2', ['module2']);
      store.updateStatus('run-2', { status: 'running' });

      store.createStatus('run-3', ['module3']);
      store.updateStatus('run-3', { status: 'completed', overallCoverage: 80 });

      store.createStatus('run-4', ['module4']);
      store.updateStatus('run-4', { status: 'completed', overallCoverage: 60 });

      store.createStatus('run-5', ['module5']);
      store.updateStatus('run-5', { status: 'failed' });

      const metrics = store.getMetrics();

      expect(metrics.totalRuns).toBe(5);
      expect(metrics.queuedRuns).toBe(1);
      expect(metrics.runningRuns).toBe(1);
      expect(metrics.completedRuns).toBe(2);
      expect(metrics.failedRuns).toBe(1);
      expect(metrics.averageCoverage).toBe(70); // (80 + 60) / 2
    });
  });
});