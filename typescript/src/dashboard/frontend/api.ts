import { StateUpdateEvent, handleEvent } from './state.js';

export class DashboardAPI {
  private eventSource: EventSource | null = null;
  private pollingInterval: number | null = null;
  private readonly SSE_ENDPOINT = '/dashboard/events';
  private readonly POLLING_INTERVAL = 3000;
  private usePolling = false;

  connect(): void {
    if (this.supportsSSE() && !this.usePolling) {
      this.connectSSE();
    } else {
      this.startPolling();
    }
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  async runTests(): Promise<void> {
    const response = await fetch('/dashboard/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to run tests: ${response.statusText}`);
    }

    return response.json();
  }

  private supportsSSE(): boolean {
    return typeof EventSource !== 'undefined';
  }

  private connectSSE(): void {
    try {
      this.eventSource = new EventSource(this.SSE_ENDPOINT);

      this.eventSource.onopen = () => {
        console.log('SSE connection established');
        this.usePolling = false;
      };

      this.eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        this.eventSource?.close();
        this.eventSource = null;
        
        console.log('Falling back to polling...');
        this.usePolling = true;
        this.startPolling();
      };

      this.eventSource.addEventListener('status', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          handleEvent({
            type: 'status',
            data
          });
        } catch (error) {
          console.error('Error parsing status event:', error);
        }
      });

      this.eventSource.addEventListener('module', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          handleEvent({
            type: 'module',
            data
          });
        } catch (error) {
          console.error('Error parsing module event:', error);
        }
      });

      this.eventSource.addEventListener('coverage', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          handleEvent({
            type: 'coverage',
            data
          });
        } catch (error) {
          console.error('Error parsing coverage event:', error);
        }
      });

      this.eventSource.addEventListener('complete', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          handleEvent({
            type: 'complete',
            data
          });
        } catch (error) {
          console.error('Error parsing complete event:', error);
        }
      });
    } catch (error) {
      console.error('Failed to create EventSource:', error);
      this.usePolling = true;
      this.startPolling();
    }
  }

  private startPolling(): void {
    if (this.pollingInterval) {
      return;
    }

    this.poll();
    
    this.pollingInterval = window.setInterval(() => {
      this.poll();
    }, this.POLLING_INTERVAL);
  }

  private async poll(): Promise<void> {
    try {
      const response = await fetch('/dashboard/status');
      
      if (!response.ok) {
        console.error('Polling failed:', response.statusText);
        return;
      }

      const data = await response.json();
      
      if (data.overallStatus) {
        handleEvent({
          type: 'status',
          data: {
            status: data.overallStatus,
            isRunning: data.isRunning
          }
        });
      }

      if (data.modules && Array.isArray(data.modules)) {
        data.modules.forEach((module: any) => {
          handleEvent({
            type: 'module',
            data: module
          });
        });
      }

      if (data.coverageSummary) {
        handleEvent({
          type: 'coverage',
          data: data.coverageSummary
        });
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }
}
