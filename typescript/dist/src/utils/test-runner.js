import { EventEmitter } from 'events';
/**
 * 测试运行器
 */
export class TestRunner extends EventEmitter {
    constructor(statusStore, config = {}) {
        super();
        this.isRunning = false;
        this.statusStore = statusStore;
        this.config = {
            timeout: config.timeout || 30000,
            retries: config.retries || 0,
            parallel: config.parallel || false
        };
        // 转发状态存储的事件
        this.statusStore.on('statusUpdated', (status) => {
            this.emit('statusUpdated', status);
        });
        this.statusStore.on('progressUpdated', (status) => {
            this.emit('progressUpdated', status);
        });
        this.statusStore.on('testStarted', (status) => {
            this.emit('testStarted', status);
        });
        this.statusStore.on('testCompleted', (status) => {
            this.emit('testCompleted', status);
        });
        this.statusStore.on('testFailed', (status) => {
            this.emit('testFailed', status);
        });
    }
    /**
     * 运行测试套件
     */
    async runTests(testCases) {
        if (this.isRunning) {
            throw new Error('测试已在运行中');
        }
        this.isRunning = true;
        const testId = this.generateTestId();
        try {
            this.statusStore.startTest(testId, testCases.length);
            const results = [];
            if (this.config.parallel) {
                // 并行运行测试
                const promises = testCases.map(testCase => this.runSingleTest(testCase));
                const parallelResults = await Promise.all(promises);
                results.push(...parallelResults);
            }
            else {
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
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.statusStore.failTest(errorMessage);
            throw error;
        }
        finally {
            this.isRunning = false;
        }
    }
    /**
     * 运行单个测试用例
     */
    async runSingleTest(testCase, attempt = 0) {
        const startTime = Date.now();
        try {
            const timeout = testCase.timeout || this.config.timeout;
            const result = await this.withTimeout(testCase.fn(), timeout);
            return {
                name: testCase.name,
                status: result ? 'passed' : 'failed',
                duration: Date.now() - startTime
            };
        }
        catch (error) {
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
    async withTimeout(promise, timeout) {
        return Promise.race([
            promise,
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`测试超时 (${timeout}ms)`)), timeout);
            })
        ]);
    }
    /**
     * 延迟函数
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * 生成测试ID
     */
    generateTestId() {
        return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * 获取当前状态
     */
    getStatus() {
        return this.statusStore.getSnapshot();
    }
    /**
     * 检查是否正在运行
     */
    isTestRunning() {
        return this.isRunning || this.statusStore.isRunning();
    }
    /**
     * 停止当前测试
     */
    stopTest() {
        if (this.isRunning) {
            this.isRunning = false;
            this.statusStore.failTest('测试被手动停止');
        }
    }
}
//# sourceMappingURL=test-runner.js.map