import { TestStatus, TestResult, CoverageData } from './types.js';
import { promises as fs } from 'fs';
import { join } from 'path';

export class TestStatusStore {
  private statuses: Map<string, TestStatus> = new Map();
  private cacheDirectory: string;

  constructor(cacheDirectory: string) {
    this.cacheDirectory = cacheDirectory;
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDirectory, { recursive: true });
    } catch (error) {
      console.error('Failed to create cache directory:', error);
    }
  }

  createStatus(id: string, moduleIds: string[]): TestStatus {
    const status: TestStatus = {
      id,
      status: 'queued',
      modules: moduleIds.map(moduleId => ({
        moduleId,
        status: 'skipped',
        duration: 0,
        passCount: 0,
        failCount: 0,
        skipCount: 0,
      })),
      coverageData: [],
    };

    this.statuses.set(id, status);
    return status;
  }

  getStatus(id: string): TestStatus | undefined {
    return this.statuses.get(id);
  }

  getAllStatuses(): TestStatus[] {
    return Array.from(this.statuses.values());
  }

  updateStatus(id: string, updates: Partial<TestStatus>): TestStatus | undefined {
    const status = this.statuses.get(id);
    if (!status) return undefined;

    Object.assign(status, updates);
    this.statuses.set(id, status);
    return status;
  }

  updateModuleResult(id: string, moduleId: string, result: Partial<TestResult>): TestStatus | undefined {
    const status = this.statuses.get(id);
    if (!status) return undefined;

    const moduleIndex = status.modules.findIndex(m => m.moduleId === moduleId);
    if (moduleIndex === -1) return undefined;

    Object.assign(status.modules[moduleIndex], result);
    this.statuses.set(id, status);
    return status;
  }

  addCoverageData(id: string, coverageData: CoverageData): TestStatus | undefined {
    const status = this.statuses.get(id);
    if (!status) return undefined;

    status.coverageData.push(coverageData);
    
    // Calculate overall coverage
    const totalLines = status.coverageData.reduce((sum, data) => sum + data.totalLines, 0);
    const coveredLines = status.coverageData.reduce((sum, data) => sum + data.coveredLines, 0);
    status.overallCoverage = totalLines > 0 ? (coveredLines / totalLines) * 100 : 0;

    this.statuses.set(id, status);
    return status;
  }

  async saveStatus(id: string): Promise<void> {
    const status = this.statuses.get(id);
    if (!status) return;

    try {
      const filePath = join(this.cacheDirectory, `test-status-${id}.json`);
      await fs.writeFile(filePath, JSON.stringify(status, null, 2));
    } catch (error) {
      console.error(`Failed to save status for ${id}:`, error);
    }
  }

  async loadStatus(id: string): Promise<TestStatus | undefined> {
    try {
      const filePath = join(this.cacheDirectory, `test-status-${id}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      const status = JSON.parse(data) as TestStatus;
      
      // Convert date strings back to Date objects
      if (status.startTime) status.startTime = new Date(status.startTime);
      if (status.endTime) status.endTime = new Date(status.endTime);
      
      this.statuses.set(id, status);
      return status;
    } catch (error) {
      // File doesn't exist or is invalid
      return undefined;
    }
  }

  async clearStatus(id: string): Promise<void> {
    this.statuses.delete(id);
    
    try {
      const filePath = join(this.cacheDirectory, `test-status-${id}.json`);
      await fs.unlink(filePath);
    } catch (error) {
      // File doesn't exist, ignore
    }
  }

  async clearAll(): Promise<void> {
    this.statuses.clear();
    
    try {
      const files = await fs.readdir(this.cacheDirectory);
      const statusFiles = files.filter(file => file.startsWith('test-status-') && file.endsWith('.json'));
      
      await Promise.all(
        statusFiles.map(file => fs.unlink(join(this.cacheDirectory, file)))
      );
    } catch (error) {
      console.error('Failed to clear status files:', error);
    }
  }

  getMetrics(): {
    totalRuns: number;
    queuedRuns: number;
    runningRuns: number;
    completedRuns: number;
    failedRuns: number;
    averageCoverage: number;
  } {
    const statuses = this.getAllStatuses();
    
    const totalRuns = statuses.length;
    const queuedRuns = statuses.filter(s => s.status === 'queued').length;
    const runningRuns = statuses.filter(s => s.status === 'running').length;
    const completedRuns = statuses.filter(s => s.status === 'completed').length;
    const failedRuns = statuses.filter(s => s.status === 'failed').length;
    
    const completedStatuses = statuses.filter(s => s.status === 'completed' && s.overallCoverage !== undefined);
    const averageCoverage = completedStatuses.length > 0
      ? completedStatuses.reduce((sum, s) => sum + (s.overallCoverage || 0), 0) / completedStatuses.length
      : 0;

    return {
      totalRuns,
      queuedRuns,
      runningRuns,
      completedRuns,
      failedRuns,
      averageCoverage,
    };
  }
}