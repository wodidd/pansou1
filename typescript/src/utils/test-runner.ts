import { EventEmitter } from 'events';
import { TestStatusStore, TestResult, TestStatus } from './test-status-store.js';

/**
 * 测试运行器配置
 */
export interface TestRunnerConfig {
  timeout?: number; // 测试超时时间（毫秒）
  retries?: number; // 重试次数
  parallel?: boolean; // 是否并行运行
}

/**
 * 测试用例接口
 */
export interface TestCase {
  name: string;
  fn: () => Promise<boolean>;
  timeout?: number;
}

/**
 * 测试运行器
 */
export class TestRunner extends EventEmitter {
  private statusStore: TestStatusStore;
  private config: Required<TestRunnerConfig>;
  private isRunning: boolean = false;

  constructor(statusStore: TestStatusStore, config: TestRunnerConfig = {}) {
    super();
    this.statusStore = statusStore;
    this.config = {
      timeout: config.timeout || 30000,
      retries: config.retries || 0,
      parallel: config.parallel || false
    };

    // 转发状态存储的事件
    this.statusStore.on('statusUpdated', (status: TestStatus) => {
      this.emit('statusUpdated', status);
    });

    this.statusStore.on('progressUpdated', (status: TestStatus) => {
      this.emit('progressUpdated', status);
    });

    this.statusStore.on('testStarted', (status: TestStatus) => {
      this.emit('testStarted', status);
    });

    this.statusStore.on('testCompleted', (status: TestStatus) => {
      this.emit('testCompleted', status);
    });

    this.statusStore.on('testFailed', (status: TestStatus) => {
      this.emit('testFailed', status);
    });
  }

  /**
   * 运行测试套件
   */
  public async runTests(testCases: TestCase[]): Promise<TestResult[]> {
    if (this.isRunning) {
      throw new Error('测试已在运行中');
    }

    this.isRunning = true;
    const testId = this.generateTestId();
    
    try {
      this.statusStore.startTest(testId, testCases.length);
      
      const results: TestResult[] = [];
      
      if (this.config.parallel) {
        // 并行运行测试
        const promises = testCases.map(testCase => 
          this.runSingleTest(testCase)
        );
        const parallelResults = await Promise.all(promises);
        results.push(...parallelResults);
      } else {
        // 串行运行测试
        for (let i = 0; i < testCases.length; i++) {
          const testCase = testCases[i];
          this.statusStore.updateProgress(i, testCases.length, `运行测试: ${testCase.name}`);
          
          const result = await this.runSingleTest(testCase);
          results.push(result);
        }
      }
      
      this.statusStore.completeTest(results);
      return results;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.statusStore.failTest(errorMessage);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 运行单个测试用例
   */
  private async runSingleTest(testCase: TestCase, attempt: number = 0): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const timeout = testCase.timeout || this.config.timeout;
      const result = await this.withTimeout(testCase.fn(), timeout);
      
      return {
        name: testCase.name,
        status: result ? 'passed' : 'failed',
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      if (attempt < this.config.retries) {
        // 重试
        await this.delay(1000); // 等待1秒后重试
        return this.runSingleTest(testCase, attempt + 1);
      }
      
      return {
        name: testCase.name,
        status: 'failed',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 带超时的Promise执行
   */
  private async withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`测试超时 (${timeout}ms)`)), timeout);
      })
    ]);
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 生成测试ID
   */
  private generateTestId(): string {
    return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取当前状态
   */
  public getStatus(): TestStatus {
    return this.statusStore.getSnapshot();
  }

  /**
   * 检查是否正在运行
   */
  public isTestRunning(): boolean {
    return this.isRunning || this.statusStore.isRunning();
  }

  /**
   * 停止当前测试
   */
  public stopTest(): void {
    if (this.isRunning) {
      this.isRunning = false;
      this.statusStore.failTest('测试被手动停止');
    }
  }
}