import { EventEmitter } from 'events';

/**
 * 测试状态接口
 */
export interface TestStatus {
  id: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  progress: {
    current: number;
    total: number;
    message: string;
  };
  results?: {
    passed: number;
    failed: number;
    total: number;
    details: TestResult[];
  };
  error?: string;
}

/**
 * 测试结果接口
 */
export interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

/**
 * 测试状态存储
 */
export class TestStatusStore extends EventEmitter {
  private currentStatus: TestStatus = {
    id: '',
    status: 'idle',
    progress: {
      current: 0,
      total: 0,
      message: '等待开始测试'
    }
  };

  /**
   * 获取当前状态快照
   */
  public getSnapshot(): TestStatus {
    return { ...this.currentStatus };
  }

  /**
   * 更新状态
   */
  public updateStatus(update: Partial<TestStatus>): void {
    this.currentStatus = { ...this.currentStatus, ...update };
    this.emit('statusUpdated', this.currentStatus);
  }

  /**
   * 更新进度
   */
  public updateProgress(current: number, total: number, message: string): void {
    this.currentStatus.progress = { current, total, message };
    this.emit('progressUpdated', this.currentStatus);
  }

  /**
   * 开始新的测试
   */
  public startTest(id: string, totalTests: number): void {
    this.currentStatus = {
      id,
      status: 'running',
      startTime: new Date(),
      progress: {
        current: 0,
        total: totalTests,
        message: '测试开始'
      },
      results: {
        passed: 0,
        failed: 0,
        total: totalTests,
        details: []
      }
    };
    this.emit('testStarted', this.currentStatus);
  }

  /**
   * 完成测试
   */
  public completeTest(results: TestResult[]): void {
    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    
    this.currentStatus.status = 'completed';
    this.currentStatus.endTime = new Date();
    this.currentStatus.progress.current = this.currentStatus.progress.total;
    this.currentStatus.progress.message = '测试完成';
    this.currentStatus.results = {
      passed,
      failed,
      total: results.length,
      details: results
    };
    
    this.emit('testCompleted', this.currentStatus);
  }

  /**
   * 测试失败
   */
  public failTest(error: string): void {
    this.currentStatus.status = 'failed';
    this.currentStatus.endTime = new Date();
    this.currentStatus.error = error;
    this.currentStatus.progress.message = `测试失败: ${error}`;
    
    this.emit('testFailed', this.currentStatus);
  }

  /**
   * 重置状态
   */
  public reset(): void {
    this.currentStatus = {
      id: '',
      status: 'idle',
      progress: {
        current: 0,
        total: 0,
        message: '等待开始测试'
      }
    };
    this.emit('statusReset', this.currentStatus);
  }

  /**
   * 检查是否有正在运行的测试
   */
  public isRunning(): boolean {
    return this.currentStatus.status === 'running';
  }

  /**
   * 获取当前测试ID
   */
  public getCurrentTestId(): string {
    return this.currentStatus.id;
  }
}