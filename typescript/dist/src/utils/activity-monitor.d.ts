/**
 * 活动监控器 - 跟踪MCP工具调用活动
 */
export declare class ActivityMonitor {
    private lastActivityTime;
    private idleTimeout;
    private enableIdleShutdown;
    private idleTimer;
    private onIdleCallback;
    constructor(idleTimeout?: number, enableIdleShutdown?: boolean);
    /**
     * 记录活动
     */
    recordActivity(): void;
    /**
     * 获取最后活动时间
     */
    getLastActivityTime(): number;
    /**
     * 获取空闲时间（毫秒）
     */
    getIdleTime(): number;
    /**
     * 检查是否空闲超时
     */
    isIdleTimeout(): boolean;
    /**
     * 设置空闲回调函数
     */
    setOnIdleCallback(callback: () => void): void;
    /**
     * 重置空闲计时器
     */
    private resetIdleTimer;
    /**
     * 停止监控
     */
    stop(): void;
    /**
     * 更新配置
     */
    updateConfig(idleTimeout: number, enableIdleShutdown: boolean): void;
    /**
     * 获取状态信息
     */
    getStatus(): {
        lastActivityTime: number;
        idleTime: number;
        idleTimeout: number;
        enableIdleShutdown: boolean;
        isIdleTimeout: boolean;
    };
}
/**
 * 获取全局活动监控器实例
 */
export declare function getActivityMonitor(): ActivityMonitor;
/**
 * 初始化全局活动监控器
 */
export declare function initializeActivityMonitor(idleTimeout: number, enableIdleShutdown: boolean): ActivityMonitor;
/**
 * 停止全局活动监控器
 */
export declare function stopActivityMonitor(): void;
//# sourceMappingURL=activity-monitor.d.ts.map