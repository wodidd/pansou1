import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { HttpClient } from '../utils/http-client.js';
import { Config } from '../utils/config.js';
/**
 * 启动后端服务工具定义
 */
export declare const startBackendTool: Tool;
/**
 * 执行启动后端服务工具
 */
export declare function executeStartBackendTool(args: unknown, httpClient?: HttpClient, config?: Config): Promise<string>;
//# sourceMappingURL=start-backend.d.ts.map