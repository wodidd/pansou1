export interface ModuleStatus {
  name: string;
  status: 'idle' | 'running' | 'passed' | 'failed' | 'error';
  lastRun?: number;
  duration?: number;
  coverage?: number;
  error?: string;
  trend?: 'up' | 'down' | 'stable';
}

export interface DashboardState {
  overallStatus: 'idle' | 'running' | 'passed' | 'failed' | 'error';
  modules: ModuleStatus[];
  lastUpdate: number;
  isRunning: boolean;
  coverageSummary: {
    average: number;
    trend: 'up' | 'down' | 'stable';
  };
  history: HistoricalSnapshot[];
}

export interface HistoricalSnapshot {
  timestamp: number;
  coverage: number;
  status: string;
}

export interface StateUpdateEvent {
  type: 'status' | 'module' | 'coverage' | 'complete';
  data: any;
}

let currentState: DashboardState = {
  overallStatus: 'idle',
  modules: [],
  lastUpdate: Date.now(),
  isRunning: false,
  coverageSummary: {
    average: 0,
    trend: 'stable'
  },
  history: []
};

const listeners: Array<(state: DashboardState) => void> = [];

export function getState(): DashboardState {
  return { ...currentState };
}

export function subscribe(listener: (state: DashboardState) => void): () => void {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
}

export function updateState(updates: Partial<DashboardState>): void {
  currentState = {
    ...currentState,
    ...updates,
    lastUpdate: Date.now()
  };
  notifyListeners();
}

export function updateModule(moduleName: string, updates: Partial<ModuleStatus>): void {
  const moduleIndex = currentState.modules.findIndex(m => m.name === moduleName);
  
  if (moduleIndex === -1) {
    currentState.modules.push({
      name: moduleName,
      status: 'idle',
      ...updates
    });
  } else {
    currentState.modules[moduleIndex] = {
      ...currentState.modules[moduleIndex],
      ...updates
    };
  }
  
  updateCoverageSummary();
  currentState.lastUpdate = Date.now();
  notifyListeners();
}

export function handleEvent(event: StateUpdateEvent): void {
  switch (event.type) {
    case 'status':
      updateState({
        overallStatus: event.data.status,
        isRunning: event.data.isRunning ?? currentState.isRunning
      });
      break;
      
    case 'module':
      updateModule(event.data.name, {
        status: event.data.status,
        lastRun: event.data.lastRun,
        duration: event.data.duration,
        coverage: event.data.coverage,
        error: event.data.error,
        trend: event.data.trend
      });
      break;
      
    case 'coverage':
      updateState({
        coverageSummary: {
          average: event.data.average,
          trend: event.data.trend
        }
      });
      break;
      
    case 'complete':
      updateState({
        overallStatus: event.data.status,
        isRunning: false
      });
      addHistoricalSnapshot();
      break;
  }
}

function updateCoverageSummary(): void {
  const modulesWithCoverage = currentState.modules.filter(m => m.coverage !== undefined);
  
  if (modulesWithCoverage.length === 0) {
    currentState.coverageSummary.average = 0;
    return;
  }
  
  const total = modulesWithCoverage.reduce((sum, m) => sum + (m.coverage || 0), 0);
  const newAverage = total / modulesWithCoverage.length;
  
  const oldAverage = currentState.coverageSummary.average;
  currentState.coverageSummary.average = newAverage;
  
  if (Math.abs(newAverage - oldAverage) < 1) {
    currentState.coverageSummary.trend = 'stable';
  } else if (newAverage > oldAverage) {
    currentState.coverageSummary.trend = 'up';
  } else {
    currentState.coverageSummary.trend = 'down';
  }
}

function addHistoricalSnapshot(): void {
  const snapshot: HistoricalSnapshot = {
    timestamp: Date.now(),
    coverage: currentState.coverageSummary.average,
    status: currentState.overallStatus
  };
  
  currentState.history.push(snapshot);
  
  if (currentState.history.length > 20) {
    currentState.history.shift();
  }
}

function notifyListeners(): void {
  const state = getState();
  listeners.forEach(listener => listener(state));
}
