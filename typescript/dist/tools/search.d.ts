import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { HttpClient } from '../utils/http-client.js';
/**
 * 搜索工具参数验证模式
 */
declare const SearchToolArgsSchema: z.ZodObject<{
    keyword: z.ZodString;
    channels: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    plugins: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    cloud_types: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    source_type: z.ZodDefault<z.ZodOptional<z.ZodEnum<["all", "tg", "plugin"]>>>;
    force_refresh: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    result_type: z.ZodDefault<z.ZodOptional<z.ZodEnum<["all", "results", "merge"]>>>;
    concurrency: z.ZodOptional<z.ZodNumber>;
    ext_params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    keyword: string;
    source_type: "all" | "tg" | "plugin";
    force_refresh: boolean;
    result_type: "all" | "results" | "merge";
    channels?: string[] | undefined;
    plugins?: string[] | undefined;
    cloud_types?: string[] | undefined;
    concurrency?: number | undefined;
    ext_params?: Record<string, any> | undefined;
}, {
    keyword: string;
    channels?: string[] | undefined;
    plugins?: string[] | undefined;
    cloud_types?: string[] | undefined;
    source_type?: "all" | "tg" | "plugin" | undefined;
    force_refresh?: boolean | undefined;
    result_type?: "all" | "results" | "merge" | undefined;
    concurrency?: number | undefined;
    ext_params?: Record<string, any> | undefined;
}>;
export type SearchToolArgs = z.infer<typeof SearchToolArgsSchema>;
/**
 * 搜索工具定义
 */
export declare const searchTool: Tool;
/**
 * 执行搜索工具
 */
export declare function executeSearchTool(args: unknown, httpClient: HttpClient): Promise<string>;
export {};
//# sourceMappingURL=search.d.ts.map