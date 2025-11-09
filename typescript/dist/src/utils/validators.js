import { z } from 'zod';
/**
 * 支持的网盘类型列表
 */
export const SUPPORTED_CLOUD_TYPES = [
    'baidu', // 百度网盘
    'aliyun', // 阿里云盘
    'quark', // 夸克网盘
    'tianyi', // 天翼云盘
    'uc', // UC网盘
    'mobile', // 移动云盘
    '115', // 115网盘
    'pikpak', // PikPak
    'xunlei', // 迅雷网盘
    '123', // 123网盘
    'magnet', // 磁力链接
    'ed2k', // 电驴链接
    'others' // 其他
];
/**
 * 支持的数据来源类型
 */
export const SOURCE_TYPES = ['all', 'tg', 'plugin'];
/**
 * 支持的结果类型
 */
export const RESULT_TYPES = ['all', 'results', 'merge'];
/**
 * 配置验证模式
 */
export const ConfigSchema = z.object({
    serverUrl: z.string().url().default('http://localhost:8888'),
    requestTimeout: z.number().positive().default(30000),
    maxResults: z.number().positive().default(100),
    maxConcurrentRequests: z.number().positive().default(5),
    enableCache: z.boolean().default(false),
    defaultChannels: z.array(z.string()).default([]),
    defaultPlugins: z.array(z.string()).default([]),
    defaultCloudTypes: z.array(z.enum(['baidu', 'aliyun', 'quark', 'tianyi', 'uc', 'mobile', '115', 'pikpak', 'xunlei', '123', 'magnet', 'ed2k', 'others'])).default([]),
    logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    // 后端服务自动管理配置
    autoStartBackend: z.boolean().default(true),
    backendShutdownDelay: z.number().positive().default(5000),
    backendStartupTimeout: z.number().positive().default(30000),
    // 空闲超时配置（毫秒）
    idleTimeout: z.number().positive().default(300000), // 默认5分钟
    enableIdleShutdown: z.boolean().default(true),
    // 项目根目录路径
    projectRootPath: z.string().optional(),
    // Docker部署模式（当设置为true时，不会尝试启动本地进程）
    dockerMode: z.boolean().default(false),
    // 测试仪表板配置
    testDashboard: z.object({
        enabled: z.boolean().default(false),
        host: z.string().default('localhost'),
        port: z.number().positive().default(3001),
        staticPath: z.string().optional(),
        autorun: z.boolean().default(false)
    }).default({})
});
/**
 * 验证网盘类型
 */
export function validateCloudTypes(cloudTypes) {
    const validTypes = [];
    const invalidTypes = [];
    for (const type of cloudTypes) {
        if (SUPPORTED_CLOUD_TYPES.includes(type)) {
            validTypes.push(type);
        }
        else {
            invalidTypes.push(type);
        }
    }
    if (invalidTypes.length > 0) {
        throw new Error(`不支持的网盘类型: ${invalidTypes.join(', ')}。支持的类型: ${SUPPORTED_CLOUD_TYPES.join(', ')}`);
    }
    return validTypes;
}
/**
 * 验证数据来源类型
 */
export function validateSourceType(sourceType) {
    if (!SOURCE_TYPES.includes(sourceType)) {
        throw new Error(`不支持的数据来源类型: ${sourceType}。支持的类型: ${SOURCE_TYPES.join(', ')}`);
    }
    return sourceType;
}
/**
 * 验证结果类型
 */
export function validateResultType(resultType) {
    if (!RESULT_TYPES.includes(resultType)) {
        throw new Error(`不支持的结果类型: ${resultType}。支持的类型: ${RESULT_TYPES.join(', ')}`);
    }
    return resultType;
}
//# sourceMappingURL=validators.js.map