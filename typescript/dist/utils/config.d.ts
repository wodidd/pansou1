import { z } from 'zod';
import { ConfigSchema } from './validators.js';
export type Config = z.infer<typeof ConfigSchema>;
/**
 * 从环境变量加载配置
 */
export declare function loadConfig(): Config;
export { SUPPORTED_CLOUD_TYPES, SOURCE_TYPES, RESULT_TYPES, type CloudType, type SourceType, type ResultType, validateCloudTypes, validateSourceType, validateResultType } from './validators.js';
//# sourceMappingURL=config.d.ts.map