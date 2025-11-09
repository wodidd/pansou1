# Dashboard Frontend

Browser-facing UI for monitoring test execution status, coverage, and module performance.

## Architecture

The dashboard frontend is built with TypeScript and compiles separately from the Node runtime. It consists of:

### Modules

- **`api.ts`**: Handles communication with the backend via Server-Sent Events (SSE) with automatic polling fallback
- **`state.ts`**: Manages application state with reactive subscriptions
- **`render.ts`**: Renders the UI based on current state
- **`main.ts`**: Entry point that wires everything together

### Features

- **Real-time Updates**: Connect via SSE to `/dashboard/events` for live status updates
- **Polling Fallback**: Automatically falls back to polling if SSE is unavailable
- **Overall Status**: Displays the current test execution status
- **Module Cards**: Show per-module information:
  - Name
  - Status chip (idle, running, passed, failed, error)
  - Last run time
  - Duration
  - Coverage percentage
  - Trend indicators (↑↓→)
  - Human-readable error messages
- **Coverage Summary**: Visual meter showing average coverage across all modules
- **Historical Sparkline**: SVG chart showing coverage trends over time (last 20 runs)
- **Manual Trigger**: "Run Tests" button that POSTs to `/dashboard/run`
- **Responsive Design**: Works on desktop and mobile devices
- **Graceful Degradation**: UI remains functional even if real-time updates fail

## Build Process

The dashboard is built using a separate TypeScript configuration:

```bash
npm run build
```

This runs three steps:
1. `build:server` - Compiles the server TypeScript (tsconfig.json)
2. `build:dashboard` - Compiles the frontend TypeScript (tsconfig.dashboard.json)
3. `build:copy` - Copies static assets and bundled JS to `dist/dashboard/public/`

### Output Structure

```
dist/
  dashboard/
    client/        # Intermediate build output
    public/        # Final assets for serving
      index.html
      styles.css
      main.js
      state.js
      render.js
      api.js
      *.js.map
```

## Configuration

### TypeScript Config (`tsconfig.dashboard.json`)

- **lib**: Includes `DOM` for browser APIs
- **outDir**: `dist/dashboard/client`
- **rootDir**: `src/dashboard/frontend`
- **module**: ES2020 with native ESM support

### Express Static Middleware

To serve the dashboard, add this to your Express server:

```typescript
import express from 'express';
import path from 'path';

app.use('/dashboard', express.static(path.join(__dirname, 'dashboard/public')));
```

Then visit: `http://localhost:PORT/dashboard/`

## API Endpoints

The frontend expects these endpoints:

### Server-Sent Events (SSE)
- **GET `/dashboard/events`**: Stream of status updates

Event types:
- `status`: Overall status changes
- `module`: Individual module updates
- `coverage`: Coverage summary updates
- `complete`: Test run completion

### HTTP API
- **POST `/dashboard/run`**: Trigger test execution
- **GET `/dashboard/status`**: Poll for current status (fallback)

## Testing

Run the test suite:

```bash
npm test
```

Tests use Jest with JSDOM to simulate a browser environment and verify:
- State management reactivity
- UI rendering with different states
- Event handling and subscriptions
- Coverage calculations and trends
- Historical snapshot management

## Development

To work on the dashboard frontend:

1. Make changes to files in `src/dashboard/frontend/`
2. Build: `npm run build`
3. Test: `npm test`
4. Serve via your Express server and visit `/dashboard/`

### File Organization

```
src/dashboard/
  frontend/
    api.ts          # SSE & HTTP client
    state.ts        # State management
    render.ts       # DOM rendering
    main.ts         # Entry point
    __tests__/
      state.test.ts
      render.test.ts

public/dashboard/
  index.html        # HTML template
  styles.css        # Stylesheet
```

## Styling

The dashboard uses a lightweight CSS design system with:
- CSS custom properties (variables)
- Responsive grid layout
- Status-based color coding
- Smooth transitions and animations
- Mobile-friendly breakpoints

Colors are semantic:
- Idle: Gray (#95a5a6)
- Running: Blue (#3498db) with pulse animation
- Passed: Green (#2ecc71)
- Failed: Red (#e74c3c)
- Error: Orange (#e67e22)

## Browser Support

The dashboard requires a modern browser with:
- ES2020 JavaScript support
- CSS Grid and Flexbox
- SVG rendering
- Optional: EventSource API (for SSE)

Tested on:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## License

MIT
