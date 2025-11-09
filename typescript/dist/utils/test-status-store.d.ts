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
export declare class TestStatusStore extends EventEmitter {
    private currentStatus;
    /**
     * 获取当前状态快照
     */
    getSnapshot(): TestStatus;
    /**
     * 更新状态
     */
    updateStatus(update: Partial<TestStatus>): void;
    /**
     * 更新进度
     */
    updateProgress(current: number, total: number, message: string): void;
    /**
     * 开始新的测试
     */
    startTest(id: string, totalTests: number): void;
    /**
     * 完成测试
     */
    completeTest(results: TestResult[]): void;
    /**
     * 测试失败
     */
    failTest(error: string): void;
    /**
     * 重置状态
     */
    reset(): void;
    /**
     * 检查是否有正在运行的测试
     */
    isRunning(): boolean;
    /**
     * 获取当前测试ID
     */
    getCurrentTestId(): string;
}
//# sourceMappingURL=test-status-store.d.ts.map