import { TestRunner } from '../utils/test-runner.js';
import { TestStatusStore } from '../utils/test-status-store.js';
import { Config } from '../utils/config.js';
/**
 * 测试仪表板服务器
 */
export declare class DashboardServer {
    private app;
    private server;
    private testRunner;
    private statusStore;
    private config;
    constructor(testRunner: TestRunner, statusStore: TestStatusStore, config: Config['testDashboard']);
    /**
     * 设置中间件
     */
    private setupMiddleware;
    /**
     * 设置路由
     */
    private setupRoutes;
    /**
     * 启动服务器
     */
    start(): Promise<void>;
    /**
     * 停止服务器
     */
    stop(): Promise<void>;
    /**
     * 获取默认仪表板HTML
     */
    private getDefaultDashboardHTML;
}
//# sourceMappingURL=server.d.ts.map