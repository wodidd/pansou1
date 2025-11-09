import { DashboardAPI } from './api.js';
import { DashboardRenderer } from './render.js';
import { subscribe, updateState } from './state.js';

class DashboardApp {
  private api: DashboardAPI;
  private renderer: DashboardRenderer;

  constructor() {
    this.api = new DashboardAPI();
    this.renderer = new DashboardRenderer('app');
    
    this.initialize();
  }

  private initialize(): void {
    subscribe((state) => {
      this.renderer.render(state);
    });

    window.addEventListener('run-tests', async () => {
      await this.handleRunTests();
    });

    window.addEventListener('beforeunload', () => {
      this.api.disconnect();
    });

    this.api.connect();
    
    this.renderer.render({
      overallStatus: 'idle',
      modules: [],
      lastUpdate: Date.now(),
      isRunning: false,
      coverageSummary: {
        average: 0,
        trend: 'stable'
      },
      history: []
    });
  }

  private async handleRunTests(): Promise<void> {
    try {
      updateState({ isRunning: true });
      
      await this.api.runTests();
      
      console.log('Tests triggered successfully');
    } catch (error) {
      console.error('Failed to run tests:', error);
      
      updateState({ 
        isRunning: false,
        overallStatus: 'error'
      });
      
      alert(`Failed to run tests: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new DashboardApp();
  });
} else {
  new DashboardApp();
}

export { DashboardApp };
