import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { HttpClient } from '../utils/http-client.js';
/**
 * 健康检查工具定义
 */
export declare const healthTool: Tool;
/**
 * 执行健康检查工具
 */
export declare function executeHealthTool(args: unknown, httpClient: HttpClient): Promise<string>;
//# sourceMappingURL=health.d.ts.map