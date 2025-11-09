# Dashboard Integration Guide

This guide shows how to integrate the dashboard frontend with an Express.js backend server.

## Backend Server Setup

### 1. Install Dependencies

```bash
npm install express
```

### 2. Create Dashboard Server

Create a file `src/dashboard/server.ts`:

```typescript
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Serve static dashboard files
const dashboardPublicPath = path.join(__dirname, '../../dist/dashboard/public');
app.use('/dashboard', express.static(dashboardPublicPath));

// Dashboard API endpoints
const clients = new Set<Response>();
let currentState = {
  overallStatus: 'idle',
  isRunning: false,
  modules: [] as any[],
  coverageSummary: {
    average: 0,
    trend: 'stable'
  }
};

// SSE endpoint
app.get('/dashboard/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  clients.add(res);

  // Send initial state
  res.write(`event: status\n`);
  res.write(`data: ${JSON.stringify({
    status: currentState.overallStatus,
    isRunning: currentState.isRunning
  })}\n\n`);

  req.on('close', () => {
    clients.delete(res);
  });
});

// Get current status (polling fallback)
app.get('/dashboard/status', (req: Request, res: Response) => {
  res.json(currentState);
});

// Trigger test run
app.post('/dashboard/run', async (req: Request, res: Response) => {
  try {
    // Update state to running
    currentState.isRunning = true;
    currentState.overallStatus = 'running';
    
    broadcastEvent('status', {
      status: 'running',
      isRunning: true
    });

    // Simulate test execution
    setTimeout(async () => {
      await runTests();
    }, 100);

    res.json({ success: true, message: 'Tests started' });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Broadcast event to all SSE clients
function broadcastEvent(eventType: string, data: any) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach(client => {
    client.write(message);
  });
}

// Simulate test execution
async function runTests() {
  const modules = ['Auth', 'Database', 'API', 'Cache'];
  
  for (const moduleName of modules) {
    // Simulate module start
    broadcastEvent('module', {
      name: moduleName,
      status: 'running',
      lastRun: Date.now()
    });

    // Simulate test execution
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));

    // Random result
    const passed = Math.random() > 0.2;
    const coverage = Math.random() * 40 + 60; // 60-100%
    const duration = Math.floor(Math.random() * 500 + 100);

    broadcastEvent('module', {
      name: moduleName,
      status: passed ? 'passed' : 'failed',
      lastRun: Date.now(),
      duration,
      coverage,
      error: passed ? undefined : 'Test assertion failed',
      trend: Math.random() > 0.5 ? 'up' : 'stable'
    });

    // Update module in state
    const existingModule = currentState.modules.find(m => m.name === moduleName);
    if (existingModule) {
      Object.assign(existingModule, {
        status: passed ? 'passed' : 'failed',
        lastRun: Date.now(),
        duration,
        coverage
      });
    } else {
      currentState.modules.push({
        name: moduleName,
        status: passed ? 'passed' : 'failed',
        lastRun: Date.now(),
        duration,
        coverage
      });
    }
  }

  // Calculate coverage summary
  const avgCoverage = currentState.modules.reduce((sum, m) => sum + (m.coverage || 0), 0) 
    / currentState.modules.length;
  
  currentState.coverageSummary = {
    average: avgCoverage,
    trend: 'up'
  };

  broadcastEvent('coverage', currentState.coverageSummary);

  // Complete
  const allPassed = currentState.modules.every(m => m.status === 'passed');
  currentState.overallStatus = allPassed ? 'passed' : 'failed';
  currentState.isRunning = false;

  broadcastEvent('complete', {
    status: currentState.overallStatus
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Dashboard server running at http://localhost:${PORT}`);
  console.log(`Dashboard UI: http://localhost:${PORT}/dashboard/`);
});
```

### 3. Build and Run

```bash
# Build the project
npm run build

# Run the dashboard server
node dist/dashboard/server.js
```

### 4. Access Dashboard

Open your browser and navigate to:
```
http://localhost:3000/dashboard/
```

## Event Types

### Status Event
Sent when overall test status changes:
```javascript
{
  type: 'status',
  data: {
    status: 'running' | 'passed' | 'failed' | 'idle' | 'error',
    isRunning: boolean
  }
}
```

### Module Event
Sent when individual module status changes:
```javascript
{
  type: 'module',
  data: {
    name: string,
    status: 'running' | 'passed' | 'failed' | 'idle' | 'error',
    lastRun: number,      // timestamp
    duration: number,     // milliseconds
    coverage: number,     // percentage 0-100
    error?: string,       // error message if failed
    trend?: 'up' | 'down' | 'stable'
  }
}
```

### Coverage Event
Sent when coverage summary updates:
```javascript
{
  type: 'coverage',
  data: {
    average: number,      // percentage 0-100
    trend: 'up' | 'down' | 'stable'
  }
}
```

### Complete Event
Sent when test run completes:
```javascript
{
  type: 'complete',
  data: {
    status: 'passed' | 'failed' | 'error'
  }
}
```

## Production Considerations

### 1. Security

Add authentication middleware:

```typescript
import jwt from 'jsonwebtoken';

function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  jwt.verify(token, process.env.JWT_SECRET!, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  });
}

// Protect dashboard routes
app.use('/dashboard/run', authenticateToken);
```

### 2. CORS

If serving from different domain:

```typescript
import cors from 'cors';

app.use('/dashboard', cors({
  origin: process.env.DASHBOARD_ORIGIN || '*',
  credentials: true
}));
```

### 3. Rate Limiting

Prevent abuse:

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/dashboard/run', limiter);
```

### 4. Logging

Add request logging:

```typescript
import morgan from 'morgan';

app.use(morgan('combined'));
```

### 5. Error Handling

Global error handler:

```typescript
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});
```

## Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/

EXPOSE 3000

CMD ["node", "dist/dashboard/server.js"]
```

Build and run:

```bash
docker build -t dashboard .
docker run -p 3000:3000 dashboard
```

## Testing the Integration

Use curl to test the API:

```bash
# Check status
curl http://localhost:3000/dashboard/status

# Run tests
curl -X POST http://localhost:3000/dashboard/run

# Listen to SSE
curl -N http://localhost:3000/dashboard/events
```
