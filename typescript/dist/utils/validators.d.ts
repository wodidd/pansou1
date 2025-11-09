import { z } from 'zod';
/**
 * 支持的网盘类型列表
 */
export declare const SUPPORTED_CLOUD_TYPES: readonly ["baidu", "aliyun", "quark", "tianyi", "uc", "mobile", "115", "pikpak", "xunlei", "123", "magnet", "ed2k", "others"];
export type CloudType = typeof SUPPORTED_CLOUD_TYPES[number];
/**
 * 支持的数据来源类型
 */
export declare const SOURCE_TYPES: readonly ["all", "tg", "plugin"];
export type SourceType = typeof SOURCE_TYPES[number];
/**
 * 支持的结果类型
 */
export declare const RESULT_TYPES: readonly ["all", "results", "merge"];
export type ResultType = typeof RESULT_TYPES[number];
/**
 * 配置验证模式
 */
export declare const ConfigSchema: z.ZodObject<{
    serverUrl: z.ZodDefault<z.ZodString>;
    requestTimeout: z.ZodDefault<z.ZodNumber>;
    maxResults: z.ZodDefault<z.ZodNumber>;
    maxConcurrentRequests: z.ZodDefault<z.ZodNumber>;
    enableCache: z.ZodDefault<z.ZodBoolean>;
    defaultChannels: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    defaultPlugins: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    defaultCloudTypes: z.ZodDefault<z.ZodArray<z.ZodEnum<["baidu", "aliyun", "quark", "tianyi", "uc", "mobile", "115", "pikpak", "xunlei", "123", "magnet", "ed2k", "others"]>, "many">>;
    logLevel: z.ZodDefault<z.ZodEnum<["error", "warn", "info", "debug"]>>;
    autoStartBackend: z.ZodDefault<z.ZodBoolean>;
    backendShutdownDelay: z.ZodDefault<z.ZodNumber>;
    backendStartupTimeout: z.ZodDefault<z.ZodNumber>;
    idleTimeout: z.ZodDefault<z.ZodNumber>;
    enableIdleShutdown: z.ZodDefault<z.ZodBoolean>;
    projectRootPath: z.ZodOptional<z.ZodString>;
    dockerMode: z.ZodDefault<z.ZodBoolean>;
    testDashboard: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        host: z.ZodDefault<z.ZodString>;
        port: z.ZodDefault<z.ZodNumber>;
        staticPath: z.ZodOptional<z.ZodString>;
        autorun: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        host: string;
        port: number;
        autorun: boolean;
        staticPath?: string | undefined;
    }, {
        enabled?: boolean | undefined;
        host?: string | undefined;
        port?: number | undefined;
        staticPath?: string | undefined;
        autorun?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    serverUrl: string;
    requestTimeout: number;
    maxResults: number;
    maxConcurrentRequests: number;
    enableCache: boolean;
    defaultChannels: string[];
    defaultPlugins: string[];
    defaultCloudTypes: ("baidu" | "aliyun" | "quark" | "tianyi" | "uc" | "mobile" | "115" | "pikpak" | "xunlei" | "123" | "magnet" | "ed2k" | "others")[];
    logLevel: "error" | "warn" | "info" | "debug";
    autoStartBackend: boolean;
    backendShutdownDelay: number;
    backendStartupTimeout: number;
    idleTimeout: number;
    enableIdleShutdown: boolean;
    dockerMode: boolean;
    testDashboard: {
        enabled: boolean;
        host: string;
        port: number;
        autorun: boolean;
        staticPath?: string | undefined;
    };
    projectRootPath?: string | undefined;
}, {
    serverUrl?: string | undefined;
    requestTimeout?: number | undefined;
    maxResults?: number | undefined;
    maxConcurrentRequests?: number | undefined;
    enableCache?: boolean | undefined;
    defaultChannels?: string[] | undefined;
    defaultPlugins?: string[] | undefined;
    defaultCloudTypes?: ("baidu" | "aliyun" | "quark" | "tianyi" | "uc" | "mobile" | "115" | "pikpak" | "xunlei" | "123" | "magnet" | "ed2k" | "others")[] | undefined;
    logLevel?: "error" | "warn" | "info" | "debug" | undefined;
    autoStartBackend?: boolean | undefined;
    backendShutdownDelay?: number | undefined;
    backendStartupTimeout?: number | undefined;
    idleTimeout?: number | undefined;
    enableIdleShutdown?: boolean | undefined;
    projectRootPath?: string | undefined;
    dockerMode?: boolean | undefined;
    testDashboard?: {
        enabled?: boolean | undefined;
        host?: string | undefined;
        port?: number | undefined;
        staticPath?: string | undefined;
        autorun?: boolean | undefined;
    } | undefined;
}>;
/**
 * 验证网盘类型
 */
export declare function validateCloudTypes(cloudTypes: string[]): CloudType[];
/**
 * 验证数据来源类型
 */
export declare function validateSourceType(sourceType: string): SourceType;
/**
 * 验证结果类型
 */
export declare function validateResultType(resultType: string): ResultType;
//# sourceMappingURL=validators.d.ts.map