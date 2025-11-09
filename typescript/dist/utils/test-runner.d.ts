import { EventEmitter } from 'events';
import { TestStatusStore, TestResult, TestStatus } from './test-status-store.js';
/**
 * 测试运行器配置
 */
export interface TestRunnerConfig {
    timeout?: number;
    retries?: number;
    parallel?: boolean;
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
export declare class TestRunner extends EventEmitter {
    private statusStore;
    private config;
    private isRunning;
    constructor(statusStore: TestStatusStore, config?: TestRunnerConfig);
    /**
     * 运行测试套件
     */
    runTests(testCases: TestCase[]): Promise<TestResult[]>;
    /**
     * 运行单个测试用例
     */
    private runSingleTest;
    /**
     * 带超时的Promise执行
     */
    private withTimeout;
    /**
     * 延迟函数
     */
    private delay;
    /**
     * 生成测试ID
     */
    private generateTestId;
    /**
     * 获取当前状态
     */
    getStatus(): TestStatus;
    /**
     * 检查是否正在运行
     */
    isTestRunning(): boolean;
    /**
     * 停止当前测试
     */
    stopTest(): void;
}
//# sourceMappingURL=test-runner.d.ts.map