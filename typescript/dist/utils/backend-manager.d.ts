import { HttpClient } from './http-client.js';
import { Config } from './config.js';
/**
 * 后端服务管理器
 * 负责自动启动、停止和监控PanSou Go后端服务
 */
export declare class BackendManager {
    private process;
    private config;
    private httpClient;
    private shutdownTimeout;
    private isShuttingDown;
    private readonly SHUTDOWN_DELAY;
    private readonly STARTUP_TIMEOUT;
    private readonly HEALTH_CHECK_INTERVAL;
    private activityMonitor;
    constructor(config: Config, httpClient: HttpClient);
    /**
     * 检查后端服务是否正在运行
     */
    isBackendRunning(): Promise<boolean>;
    /**
     * 智能检测Docker容器状态
     */
    private detectDockerContainer;
    /**
     * 智能检测部署模式
     * @returns 'docker' | 'source' | 'unknown'
     */
    private detectDeploymentMode;
    /**
     * 查找Go可执行文件路径
     */
    private findGoExecutable;
    /**
     * 启动后端服务
     */
    startBackend(): Promise<boolean>;
    /**
     * 等待后端服务就绪
     */
    private waitForBackendReady;
    /**
     * 停止后端服务
     */
    stopBackend(): Promise<void>;
    /**
     * 延迟停止后端服务
     */
    scheduleShutdown(): void;
    /**
     * 取消计划的关闭
     */
    cancelShutdown(): void;
    /**
     * 获取后端服务状态
     */
    getStatus(): {
        processRunning: boolean;
        serviceReachable: boolean;
        pid?: number;
    };
    /**
     * 记录活动（重置空闲计时器）
     */
    recordActivity(): void;
    /**
     * 获取活动监控状态
     */
    getActivityStatus(): any;
    /**
     * 清理资源
     */
    cleanup(): Promise<void>;
}
/**
 * 创建后端管理器实例
 */
export declare function createBackendManager(config: Config, httpClient: HttpClient): BackendManager;
//# sourceMappingURL=backend-manager.d.ts.map