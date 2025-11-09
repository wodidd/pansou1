import request from 'supertest';
import { TestStatusStore } from '../src/utils/test-status-store.js';
import { TestRunner } from '../src/utils/test-runner.js';
import { DashboardServer } from '../src/dashboard/server.js';
describe('Dashboard Server Integration Tests', () => {
    let statusStore;
    let testRunner;
    let dashboardServer;
    let server;
    beforeAll(async () => {
        // 创建测试组件
        statusStore = new TestStatusStore();
        testRunner = new TestRunner(statusStore);
        // 创建仪表板服务器配置
        const config = {
            enabled: true,
            host: 'localhost',
            port: 0, // 使用随机端口
            staticPath: undefined,
            autorun: false
        };
        dashboardServer = new DashboardServer(testRunner, statusStore, config);
        // 启动服务器
        await dashboardServer.start();
        // 获取实际的服务器实例以便测试
        server = dashboardServer.app;
    });
    afterAll(async () => {
        if (dashboardServer) {
            await dashboardServer.stop();
        }
    });
    describe('GET /dashboard/status', () => {
        it('should return current test status', async () => {
            const response = await request(server)
                .get('/dashboard/status')
                .expect(200);
            expect(response.body).toMatchObject({
                success: true,
                data: {
                    id: expect.any(String),
                    status: expect.any(String),
                    progress: {
                        current: expect.any(Number),
                        total: expect.any(Number),
                        message: expect.any(String)
                    }
                }
            });
        });
        it('should return idle status initially', async () => {
            const response = await request(server)
                .get('/dashboard/status')
                .expect(200);
            expect(response.body.data.status).toBe('idle');
            expect(response.body.data.progress.current).toBe(0);
            expect(response.body.data.progress.total).toBe(0);
        });
    });
    describe('GET /dashboard/events', () => {
        it('should establish SSE connection with correct headers', async () => {
            const response = await request(server)
                .get('/dashboard/events')
                .expect(200);
            expect(response.headers['content-type']).toBe('text/event-stream; charset=utf-8');
            expect(response.headers['cache-control']).toBe('no-cache');
            expect(response.headers['connection']).toBe('keep-alive');
        });
        it('should send initial connection message', async () => {
            // 由于SSE是流式的，我们需要手动测试
            return new Promise((resolve, reject) => {
                const req = request(server).get('/dashboard/events');
                req.end((err, res) => {
                    if (err)
                        return reject(err);
                    // 检查响应是否包含连接消息
                    expect(res.text).toContain('data: {"type":"connected"');
                    resolve(true);
                });
            });
        });
    });
    describe('POST /dashboard/run', () => {
        it('should start a new test run successfully', async () => {
            const response = await request(server)
                .post('/dashboard/run')
                .expect(202);
            expect(response.body).toMatchObject({
                success: true,
                message: '测试已启动',
                data: {
                    testId: expect.any(String),
                    testCount: expect.any(Number)
                }
            });
        });
        it('should return 409 when test is already running', async () => {
            // 第一次请求应该成功
            await request(server)
                .post('/dashboard/run')
                .expect(202);
            // 第二次请求应该返回409
            const response = await request(server)
                .post('/dashboard/run')
                .expect(409);
            expect(response.body).toMatchObject({
                success: false,
                error: '测试已在运行中',
                data: {
                    currentStatus: expect.any(Object)
                }
            });
        });
        it('should handle test completion and status updates', async () => {
            // 启动测试
            await request(server)
                .post('/dashboard/run')
                .expect(202);
            // 等待测试完成
            await new Promise(resolve => setTimeout(resolve, 5000));
            // 检查最终状态
            const response = await request(server)
                .get('/dashboard/status')
                .expect(200);
            expect(response.body.data.status).toMatch(/completed|failed/);
        });
    });
    describe('Static file serving', () => {
        it('should serve default dashboard HTML at root', async () => {
            const response = await request(server)
                .get('/')
                .expect(200);
            expect(response.text).toContain('PanSou 测试仪表板');
            expect(response.text).toContain('实时监控测试状态和进度');
        });
        it('should contain required JavaScript functionality', async () => {
            const response = await request(server)
                .get('/')
                .expect(200);
            expect(response.text).toContain('EventSource');
            expect(response.text).toContain('/dashboard/events');
            expect(response.text).toContain('/dashboard/status');
            expect(response.text).toContain('/dashboard/run');
        });
    });
    describe('Error handling', () => {
        it('should return 404 for unknown routes', async () => {
            const response = await request(server)
                .get('/unknown-route')
                .expect(404);
            expect(response.body).toMatchObject({
                success: false,
                error: '接口不存在'
            });
        });
        it('should handle malformed JSON gracefully', async () => {
            const response = await request(server)
                .post('/dashboard/run')
                .set('Content-Type', 'application/json')
                .send('invalid json')
                .expect(400);
        });
    });
    describe('CORS headers', () => {
        it('should include CORS headers', async () => {
            const response = await request(server)
                .get('/dashboard/status')
                .expect(200);
            expect(response.headers['access-control-allow-origin']).toBeDefined();
        });
        it('should handle OPTIONS requests', async () => {
            await request(server)
                .options('/dashboard/status')
                .expect(204);
        });
    });
    describe('Test runner integration', () => {
        it('should properly integrate with TestRunner', async () => {
            // 验证TestRunner是否正确集成
            expect(testRunner).toBeDefined();
            expect(statusStore).toBeDefined();
            // 初始状态应该是空闲
            expect(statusStore.isRunning()).toBe(false);
            // 启动测试
            await request(server)
                .post('/dashboard/run')
                .expect(202);
            // 测试应该正在运行
            expect(statusStore.isRunning()).toBe(true);
        });
        it('should emit events correctly', async () => {
            let eventReceived = false;
            statusStore.on('testStarted', () => {
                eventReceived = true;
            });
            // 启动测试
            await request(server)
                .post('/dashboard/run')
                .expect(202);
            // 等待事件
            await new Promise(resolve => setTimeout(resolve, 100));
            expect(eventReceived).toBe(true);
        });
    });
});
//# sourceMappingURL=dashboard.test.js.map