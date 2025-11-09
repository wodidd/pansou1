import { promises as fs } from 'fs';
import { join } from 'path';
export class TestStatusStore {
    constructor(cacheDirectory) {
        this.statuses = new Map();
        this.cacheDirectory = cacheDirectory;
    }
    async initialize() {
        try {
            await fs.mkdir(this.cacheDirectory, { recursive: true });
        }
        catch (error) {
            console.error('Failed to create cache directory:', error);
        }
    }
    createStatus(id, moduleIds) {
        const status = {
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
    getStatus(id) {
        return this.statuses.get(id);
    }
    getAllStatuses() {
        return Array.from(this.statuses.values());
    }
    updateStatus(id, updates) {
        const status = this.statuses.get(id);
        if (!status)
            return undefined;
        Object.assign(status, updates);
        this.statuses.set(id, status);
        return status;
    }
    updateModuleResult(id, moduleId, result) {
        const status = this.statuses.get(id);
        if (!status)
            return undefined;
        const moduleIndex = status.modules.findIndex(m => m.moduleId === moduleId);
        if (moduleIndex === -1)
            return undefined;
        Object.assign(status.modules[moduleIndex], result);
        this.statuses.set(id, status);
        return status;
    }
    addCoverageData(id, coverageData) {
        const status = this.statuses.get(id);
        if (!status)
            return undefined;
        status.coverageData.push(coverageData);
        // Calculate overall coverage
        const totalLines = status.coverageData.reduce((sum, data) => sum + data.totalLines, 0);
        const coveredLines = status.coverageData.reduce((sum, data) => sum + data.coveredLines, 0);
        status.overallCoverage = totalLines > 0 ? (coveredLines / totalLines) * 100 : 0;
        this.statuses.set(id, status);
        return status;
    }
    async saveStatus(id) {
        const status = this.statuses.get(id);
        if (!status)
            return;
        try {
            const filePath = join(this.cacheDirectory, `test-status-${id}.json`);
            await fs.writeFile(filePath, JSON.stringify(status, null, 2));
        }
        catch (error) {
            console.error(`Failed to save status for ${id}:`, error);
        }
    }
    async loadStatus(id) {
        try {
            const filePath = join(this.cacheDirectory, `test-status-${id}.json`);
            const data = await fs.readFile(filePath, 'utf-8');
            const status = JSON.parse(data);
            // Convert date strings back to Date objects
            if (status.startTime)
                status.startTime = new Date(status.startTime);
            if (status.endTime)
                status.endTime = new Date(status.endTime);
            this.statuses.set(id, status);
            return status;
        }
        catch (error) {
            // File doesn't exist or is invalid
            return undefined;
        }
    }
    async clearStatus(id) {
        this.statuses.delete(id);
        try {
            const filePath = join(this.cacheDirectory, `test-status-${id}.json`);
            await fs.unlink(filePath);
        }
        catch (error) {
            // File doesn't exist, ignore
        }
    }
    async clearAll() {
        this.statuses.clear();
        try {
            const files = await fs.readdir(this.cacheDirectory);
            const statusFiles = files.filter(file => file.startsWith('test-status-') && file.endsWith('.json'));
            await Promise.all(statusFiles.map(file => fs.unlink(join(this.cacheDirectory, file))));
        }
        catch (error) {
            console.error('Failed to clear status files:', error);
        }
    }
    getMetrics() {
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
//# sourceMappingURL=TestStatusStore.js.map