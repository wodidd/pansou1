import { Config } from './config.js';
import { CloudType, SourceType, ResultType } from './config.js';
/**
 * 搜索请求参数
 */
export interface SearchRequest {
    kw: string;
    channels?: string[];
    conc?: number;
    refresh?: boolean;
    res?: ResultType;
    src?: SourceType;
    plugins?: string[];
    cloud_types?: CloudType[];
    ext?: Record<string, any>;
}
/**
 * 网盘链接
 */
export interface Link {
    type: string;
    url: string;
    password: string;
}
/**
 * 搜索结果项
 */
export interface SearchResult {
    message_id: string;
    unique_id: string;
    channel: string;
    datetime: string;
    title: string;
    content: string;
    links: Link[];
    tags?: string[];
    images?: string[];
}
/**
 * 合并后的网盘链接
 */
export interface MergedLink {
    url: string;
    password: string;
    note: string;
    datetime: string;
    source?: string;
    images?: string[];
}
/**
 * 按网盘类型分组的合并链接
 */
export type MergedLinks = Record<string, MergedLink[]>;
/**
 * 搜索响应数据
 */
export interface SearchResponseData {
    total: number;
    results?: SearchResult[];
    merged_by_type?: MergedLinks;
}
/**
 * API响应格式
 */
export interface ApiResponse<T = any> {
    code: number;
    message: string;
    data?: T;
}
/**
 * 健康检查响应
 */
export interface HealthResponse {
    status: string;
    plugins_enabled: boolean;
    channels: string[];
    channels_count: number;
    plugin_count?: number;
    plugins?: string[];
}
/**
 * HTTP客户端类
 */
export declare class HttpClient {
    private client;
    private config;
    private silentMode;
    constructor(config: Config);
    /**
     * 搜索网盘资源
     */
    search(params: SearchRequest): Promise<SearchResponseData>;
    /**
     * 检查服务健康状态
     */
    checkHealth(): Promise<HealthResponse>;
    /**
     * 测试连接
     */
    testConnection(): Promise<boolean>;
    /**
     * 获取服务器URL
     */
    getServerUrl(): string;
    /**
     * 更新配置
     */
    updateConfig(newConfig: Partial<Config>): void;
    /**
     * 设置静默模式
     */
    setSilentMode(silent: boolean): void;
    /**
     * 获取静默模式状态
     */
    isSilentMode(): boolean;
}
/**
 * 创建HTTP客户端实例
 */
export declare function createHttpClient(config: Config): HttpClient;
//# sourceMappingURL=http-client.d.ts.map