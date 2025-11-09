#!/usr/bin/env node
/**
 * PanSou MCP服务器
 */
declare class PanSouMCPServer {
    private server;
    private httpClient;
    private backendManager;
    private config;
    private testStatusStore;
    private testRunner;
    private dashboardServer;
    constructor();
    /**
     * 设置请求处理器
     */
    private setupHandlers;
    /**
     * 获取插件资源
     */
    private getPluginsResource;
    /**
     * 获取频道资源
     */
    private getChannelsResource;
    /**
     * 获取网盘类型资源
     */
    private getCloudTypesResource;
    /**
     * 设置进程处理器
     */
    private setupProcessHandlers;
    /**
     * 启动服务器
     */
    start(): Promise<void>;
}
export { PanSouMCPServer };
//# sourceMappingURL=index.d.ts.map