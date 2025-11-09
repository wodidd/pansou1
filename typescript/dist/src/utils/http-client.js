import axios from 'axios';
import { validateCloudTypes } from './config.js';
/**
 * HTTP客户端类
 */
export class HttpClient {
    constructor(config) {
        this.silentMode = false;
        this.config = config;
        this.client = axios.create({
            baseURL: config.serverUrl,
            timeout: config.requestTimeout,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'PanSou-MCP-Server/1.0.0'
            }
        });
        // 请求拦截器
        this.client.interceptors.request.use((config) => {
            if (this.config.logLevel === 'debug') {
                console.log(`[HTTP] 请求: ${config.method?.toUpperCase()} ${config.url}`);
                if (config.data) {
                    console.log(`[HTTP] 请求数据:`, config.data);
                }
            }
            return config;
        }, (error) => {
            console.error('[HTTP] 请求错误:', error);
            return Promise.reject(error);
        });
        // 响应拦截器
        this.client.interceptors.response.use((response) => {
            if (this.config.logLevel === 'debug') {
                console.log(`[HTTP] 响应: ${response.status} ${response.config.url}`);
            }
            return response;
        }, (error) => {
            if (!this.silentMode) {
                if (error.response) {
                    console.error(`[HTTP] 响应错误: ${error.response.status} ${error.response.statusText}`);
                    if (this.config.logLevel === 'debug') {
                        console.error('[HTTP] 错误详情:', error.response.data);
                    }
                }
                else if (error.request) {
                    console.error('[HTTP] 网络错误: 无法连接到服务器');
                }
                else {
                    console.error('[HTTP] 请求配置错误:', error.message);
                }
            }
            return Promise.reject(error);
        });
    }
    /**
     * 搜索网盘资源
     */
    async search(params) {
        try {
            // 参数验证
            if (!params.kw || params.kw.trim() === '') {
                throw new Error('搜索关键词不能为空');
            }
            // 设置默认值
            const requestData = {
                kw: params.kw.trim(),
                channels: params.channels || this.config.defaultChannels,
                conc: params.conc,
                refresh: params.refresh || false,
                res: params.res || 'merge',
                src: params.src || 'all',
                plugins: params.plugins || this.config.defaultPlugins,
                cloud_types: params.cloud_types ? validateCloudTypes(params.cloud_types.map(String)) : this.config.defaultCloudTypes,
                ext: params.ext || {}
            };
            // 清理空数组
            if (requestData.channels && requestData.channels.length === 0) {
                delete requestData.channels;
            }
            if (requestData.plugins && requestData.plugins.length === 0) {
                delete requestData.plugins;
            }
            if (requestData.cloud_types && requestData.cloud_types.length === 0) {
                delete requestData.cloud_types;
            }
            const response = await this.client.post('/api/search', requestData);
            // 兼容不同版本的响应格式：源码版本使用200，Docker版本使用0
            if (response.data.code !== 200 && response.data.code !== 0) {
                throw new Error(response.data.message || '搜索请求失败');
            }
            if (!response.data.data) {
                throw new Error('服务器返回数据为空');
            }
            return response.data.data;
        }
        catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response?.data?.message) {
                    throw new Error(`搜索失败: ${error.response.data.message}`);
                }
                else if (error.code === 'ECONNREFUSED') {
                    throw new Error(`无法连接到PanSou服务器 (${this.config.serverUrl})。请确保服务器正在运行。`);
                }
                else if (error.code === 'ETIMEDOUT') {
                    throw new Error('请求超时，请稍后重试');
                }
                else {
                    throw new Error(`网络错误: ${error.message}`);
                }
            }
            throw error;
        }
    }
    /**
     * 检查服务健康状态
     */
    async checkHealth() {
        try {
            const response = await this.client.get('/api/health');
            return response.data;
        }
        catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNREFUSED') {
                    throw new Error(`无法连接到PanSou服务器 (${this.config.serverUrl})。请确保服务器正在运行。`);
                }
                else if (error.code === 'ETIMEDOUT') {
                    throw new Error('健康检查超时');
                }
                else {
                    throw new Error(`健康检查失败: ${error.message}`);
                }
            }
            throw error;
        }
    }
    /**
     * 测试连接
     */
    async testConnection() {
        try {
            await this.checkHealth();
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * 获取服务器URL
     */
    getServerUrl() {
        return this.config.serverUrl;
    }
    /**
     * 更新配置
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        // 更新axios实例配置
        this.client.defaults.baseURL = this.config.serverUrl;
        this.client.defaults.timeout = this.config.requestTimeout;
    }
    /**
     * 设置静默模式
     */
    setSilentMode(silent) {
        this.silentMode = silent;
    }
    /**
     * 获取静默模式状态
     */
    isSilentMode() {
        return this.silentMode;
    }
}
/**
 * 创建HTTP客户端实例
 */
export function createHttpClient(config) {
    return new HttpClient(config);
}
//# sourceMappingURL=http-client.js.map