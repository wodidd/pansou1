import { EventEmitter } from 'events';
import { TestModule, TestStatus, TestRunnerConfig, TestRunnerEvent } from './types.js';
export declare class TestRunner extends EventEmitter {
    private store;
    private config;
    private runningRuns;
    private queuedRuns;
    constructor(config: TestRunnerConfig);
    initialize(): Promise<void>;
    on(event: string, listener: (data: TestRunnerEvent) => void): this;
    runTests(modules: TestModule[]): Promise<TestStatus>;
    private executeModules;
    private executeModule;
    private parseTestOutput;
    private parseGoTestOutput;
    private parseJestOutput;
    private parseBasicOutput;
    private parseCoverage;
    private parseModuleCoverage;
    private parseGoCoverageOutput;
    cancelRun(runId: string): Promise<boolean>;
    getStatus(runId: string): TestStatus | undefined;
    getAllStatuses(): TestStatus[];
    getMetrics(): {
        totalRuns: number;
        queuedRuns: number;
        runningRuns: number;
        completedRuns: number;
        failedRuns: number;
        averageCoverage: number;
    };
    private generateRunId;
    checkToolchains(): Promise<{
        go: boolean;
        node: boolean;
        jest: boolean;
    }>;
}
//# sourceMappingURL=TestRunner.d.ts.map