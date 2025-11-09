import { EventEmitter } from 'events';
/**
 * 测试状态存储
 */
export class TestStatusStore extends EventEmitter {
    constructor() {
        super(...arguments);
        this.currentStatus = {
            id: '',
            status: 'idle',
            progress: {
                current: 0,
                total: 0,
                message: '等待开始测试'
            }
        };
    }
    /**
     * 获取当前状态快照
     */
    getSnapshot() {
        return { ...this.currentStatus };
    }
    /**
     * 更新状态
     */
    updateStatus(update) {
        this.currentStatus = { ...this.currentStatus, ...update };
        this.emit('statusUpdated', this.currentStatus);
    }
    /**
     * 更新进度
     */
    updateProgress(current, total, message) {
        this.currentStatus.progress = { current, total, message };
        this.emit('progressUpdated', this.currentStatus);
    }
    /**
     * 开始新的测试
     */
    startTest(id, totalTests) {
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
    completeTest(results) {
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
    failTest(error) {
        this.currentStatus.status = 'failed';
        this.currentStatus.endTime = new Date();
        this.currentStatus.error = error;
        this.currentStatus.progress.message = `测试失败: ${error}`;
        this.emit('testFailed', this.currentStatus);
    }
    /**
     * 重置状态
     */
    reset() {
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
    isRunning() {
        return this.currentStatus.status === 'running';
    }
    /**
     * 获取当前测试ID
     */
    getCurrentTestId() {
        return this.currentStatus.id;
    }
}
//# sourceMappingURL=test-status-store.js.map