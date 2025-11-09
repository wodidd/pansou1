import { TestStatus, TestResult, CoverageData } from './types.js';
export declare class TestStatusStore {
    private statuses;
    private cacheDirectory;
    constructor(cacheDirectory: string);
    initialize(): Promise<void>;
    createStatus(id: string, moduleIds: string[]): TestStatus;
    getStatus(id: string): TestStatus | undefined;
    getAllStatuses(): TestStatus[];
    updateStatus(id: string, updates: Partial<TestStatus>): TestStatus | undefined;
    updateModuleResult(id: string, moduleId: string, result: Partial<TestResult>): TestStatus | undefined;
    addCoverageData(id: string, coverageData: CoverageData): TestStatus | undefined;
    saveStatus(id: string): Promise<void>;
    loadStatus(id: string): Promise<TestStatus | undefined>;
    clearStatus(id: string): Promise<void>;
    clearAll(): Promise<void>;
    getMetrics(): {
        totalRuns: number;
        queuedRuns: number;
        runningRuns: number;
        completedRuns: number;
        failedRuns: number;
        averageCoverage: number;
    };
}
//# sourceMappingURL=TestStatusStore.d.ts.map