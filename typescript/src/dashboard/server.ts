import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Server as HttpServer } from 'http';
import { TestRunner } from '../utils/test-runner.js';
import { TestStatusStore, TestStatus } from '../utils/test-status-store.js';
import { Config } from '../utils/config.js';

/**
 * 测试仪表板服务器
 */
export class DashboardServer {
  private app: express.Application;
  private server: HttpServer | null = null;
  private testRunner: TestRunner;
  private statusStore: TestStatusStore;
  private config: Config['testDashboard'];

  constructor(testRunner: TestRunner, statusStore: TestStatusStore, config: Config['testDashboard']) {
    this.testRunner = testRunner;
    this.statusStore = statusStore;
    this.config = config;
    
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * 设置中间件
   */
  private setupMiddleware(): void {
    // JSON解析中间件
    this.app.use(express.json());
    
    // CORS中间件（如果前端可能单独托管）
    this.app.use(cors({
      origin: true, // 允许所有来源，可以根据需要限制
      credentials: true
    }));
    
    // 请求日志中间件（仅在调试模式）
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      if (process.env.LOG_LEVEL === 'debug') {
        console.debug(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      }
      next();
    });
  }

  /**
   * 设置路由
   */
  private setupRoutes(): void {
    // 获取状态
    this.app.get('/dashboard/status', (req: Request, res: Response) => {
      try {
        const status = this.statusStore.getSnapshot();
        res.json({
          success: true,
          data: status
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : '获取状态失败'
        });
      }
    });

    // SSE事件流
    this.app.get('/dashboard/events', (req: Request, res: Response) => {
      // 设置SSE响应头
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // 发送初始连接消息
      res.write('data: {"type": "connected", "timestamp": "' + new Date().toISOString() + '"}\n\n');

      // 监听状态更新事件
      const onStatusUpdated = (status: TestStatus) => {
        res.write(`data: ${JSON.stringify({ type: 'statusUpdated', data: status, timestamp: new Date().toISOString() })}\n\n`);
      };

      const onProgressUpdated = (status: TestStatus) => {
        res.write(`data: ${JSON.stringify({ type: 'progressUpdated', data: status, timestamp: new Date().toISOString() })}\n\n`);
      };

      const onTestStarted = (status: TestStatus) => {
        res.write(`data: ${JSON.stringify({ type: 'testStarted', data: status, timestamp: new Date().toISOString() })}\n\n`);
      };

      const onTestCompleted = (status: TestStatus) => {
        res.write(`data: ${JSON.stringify({ type: 'testCompleted', data: status, timestamp: new Date().toISOString() })}\n\n`);
      };

      const onTestFailed = (status: TestStatus) => {
        res.write(`data: ${JSON.stringify({ type: 'testFailed', data: status, timestamp: new Date().toISOString() })}\n\n`);
      };

      // 注册事件监听器
      this.statusStore.on('statusUpdated', onStatusUpdated);
      this.statusStore.on('progressUpdated', onProgressUpdated);
      this.statusStore.on('testStarted', onTestStarted);
      this.statusStore.on('testCompleted', onTestCompleted);
      this.statusStore.on('testFailed', onTestFailed);

      // 处理客户端断开连接
      req.on('close', () => {
        this.statusStore.removeListener('statusUpdated', onStatusUpdated);
        this.statusStore.removeListener('progressUpdated', onProgressUpdated);
        this.statusStore.removeListener('testStarted', onTestStarted);
        this.statusStore.removeListener('testCompleted', onTestCompleted);
        this.statusStore.removeListener('testFailed', onTestFailed);
      });
    });

    // 手动触发测试运行
    this.app.post('/dashboard/run', async (req: Request, res: Response): Promise<void> => {
      try {
        // 检查是否已有测试在运行
        if (this.testRunner.isTestRunning()) {
          res.status(409).json({
            success: false,
            error: '测试已在运行中',
            data: {
              currentStatus: this.statusStore.getSnapshot()
            }
          });
          return;
        }

        // 创建示例测试用例（实际应用中应该从配置或其他地方获取）
        const testCases = [
          {
            name: '连接测试',
            fn: async () => {
              // 模拟连接测试
              await new Promise(resolve => setTimeout(resolve, 1000));
              return true;
            }
          },
          {
            name: '健康检查测试',
            fn: async () => {
              // 模拟健康检查测试
              await new Promise(resolve => setTimeout(resolve, 1500));
              return true;
            }
          },
          {
            name: '搜索功能测试',
            fn: async () => {
              // 模拟搜索功能测试
              await new Promise(resolve => setTimeout(resolve, 2000));
              return Math.random() > 0.1; // 90%成功率
            }
          }
        ];

        // 异步运行测试
        this.testRunner.runTests(testCases).catch(error => {
          console.error('测试运行失败:', error);
        });

        res.status(202).json({
          success: true,
          message: '测试已启动',
          data: {
            testId: this.statusStore.getSnapshot().id,
            testCount: testCases.length
          }
        });

      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : '启动测试失败'
        });
      }
    });

    // 静态资源服务
    if (this.config.staticPath) {
      this.app.use(express.static(this.config.staticPath));
    } else {
      // 默认提供简单的仪表板页面
      this.app.get('/', (req: Request, res: Response) => {
        res.send(this.getDefaultDashboardHTML());
      });
    }

    // 404处理
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: '接口不存在'
      });
    });
  }

  /**
   * 启动服务器
   */
  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.config.port, this.config.host, () => {
        console.error(`测试仪表板已启动: http://${this.config.host}:${this.config.port}`);
        resolve();
      });

      this.server.on('error', (error: Error) => {
        reject(error);
      });
    });
  }

  /**
   * 停止服务器
   */
  public async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          console.error('测试仪表板已停止');
          resolve();
        });
      });
    }
  }

  /**
   * 获取默认仪表板HTML
   */
  private getDefaultDashboardHTML(): string {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PanSou 测试仪表板</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .status-card { margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .status-running { border-left: 4px solid #ffc107; }
        .status-completed { border-left: 4px solid #28a745; }
        .status-failed { border-left: 4px solid #dc3545; }
        .status-idle { border-left: 4px solid #6c757d; }
        .progress { width: 100%; height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; margin: 10px 0; }
        .progress-bar { height: 100%; background: #007bff; transition: width 0.3s ease; }
        .btn { padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin: 5px; }
        .btn-primary { background: #007bff; color: white; }
        .btn:disabled { background: #6c757d; cursor: not-allowed; }
        .events { height: 300px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; background: #f8f9fa; }
        .event { margin-bottom: 5px; padding: 5px; border-radius: 3px; }
        .event-info { background: #d1ecf1; }
        .event-success { background: #d4edda; }
        .event-warning { background: #fff3cd; }
        .event-error { background: #f8d7da; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>PanSou 测试仪表板</h1>
            <p>实时监控测试状态和进度</p>
        </div>

        <div class="status-card" id="statusCard">
            <h3>测试状态</h3>
            <p><strong>ID:</strong> <span id="testId">-</span></p>
            <p><strong>状态:</strong> <span id="testStatus">空闲</span></p>
            <p><strong>进度:</strong> <span id="progressText">0/0</span></p>
            <div class="progress">
                <div class="progress-bar" id="progressBar" style="width: 0%"></div>
            </div>
            <p><strong>消息:</strong> <span id="progressMessage">等待开始测试</span></p>
            <p><strong>开始时间:</strong> <span id="startTime">-</span></p>
            <p><strong>结束时间:</strong> <span id="endTime">-</span></p>
        </div>

        <div class="status-card">
            <h3>测试结果</h3>
            <p><strong>通过:</strong> <span id="passedCount">0</span></p>
            <p><strong>失败:</strong> <span id="failedCount">0</span></p>
            <p><strong>总计:</strong> <span id="totalCount">0</span></p>
            <button class="btn btn-primary" id="runTestBtn" onclick="runTest()">运行测试</button>
        </div>

        <div class="status-card">
            <h3>事件日志</h3>
            <div class="events" id="events"></div>
        </div>
    </div>

    <script>
        let eventSource;

        function connectEvents() {
            eventSource = new EventSource('/dashboard/events');
            
            eventSource.onmessage = function(event) {
                const data = JSON.parse(event.data);
                addEvent(data.type, data);
                
                if (data.type === 'statusUpdated' || data.type === 'testStarted' || 
                    data.type === 'testCompleted' || data.type === 'testFailed') {
                    updateStatus(data.data);
                }
            };
            
            eventSource.onerror = function() {
                addEvent('error', { message: '连接断开，正在重试...' });
                setTimeout(connectEvents, 3000);
            };
        }

        function updateStatus(status) {
            document.getElementById('testId').textContent = status.id || '-';
            document.getElementById('testStatus').textContent = getStatusText(status.status);
            document.getElementById('progressText').textContent = \`\${status.progress.current}/\${status.progress.total}\`;
            document.getElementById('progressBar').style.width = \`\${(status.progress.current / status.progress.total) * 100}%\`;
            document.getElementById('progressMessage').textContent = status.progress.message;
            document.getElementById('startTime').textContent = status.startTime ? new Date(status.startTime).toLocaleString() : '-';
            document.getElementById('endTime').textContent = status.endTime ? new Date(status.endTime).toLocaleString() : '-';
            
            if (status.results) {
                document.getElementById('passedCount').textContent = status.results.passed;
                document.getElementById('failedCount').textContent = status.results.failed;
                document.getElementById('totalCount').textContent = status.results.total;
            }
            
            // 更新状态卡片样式
            const statusCard = document.getElementById('statusCard');
            statusCard.className = 'status-card status-' + status.status;
            
            // 更新按钮状态
            const runBtn = document.getElementById('runTestBtn');
            runBtn.disabled = status.status === 'running';
        }

        function getStatusText(status) {
            const statusMap = {
                'idle': '空闲',
                'running': '运行中',
                'completed': '已完成',
                'failed': '失败'
            };
            return statusMap[status] || status;
        }

        function addEvent(type, data) {
            const events = document.getElementById('events');
            const event = document.createElement('div');
            event.className = 'event event-' + (type === 'testFailed' ? 'error' : 'info');
            event.innerHTML = \`[\${new Date().toLocaleTimeString()}] \${type}: \${JSON.stringify(data)}\`;
            events.appendChild(event);
            events.scrollTop = events.scrollHeight;
        }

        async function runTest() {
            try {
                const response = await fetch('/dashboard/run', { method: 'POST' });
                const result = await response.json();
                
                if (response.ok) {
                    addEvent('info', { message: '测试已启动' });
                } else {
                    addEvent('error', { message: result.error });
                }
            } catch (error) {
                addEvent('error', { message: '请求失败: ' + error.message });
            }
        }

        // 初始化
        connectEvents();
        
        // 加载初始状态
        fetch('/dashboard/status')
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    updateStatus(result.data);
                }
            })
            .catch(error => {
                addEvent('error', { message: '加载状态失败: ' + error.message });
            });
    </script>
</body>
</html>
    `;
  }
}