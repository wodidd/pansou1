import { DashboardRenderer } from '../render';
import { DashboardState } from '../state';

describe('DashboardRenderer', () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    container = document.getElementById('app')!;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should create a renderer instance', () => {
    const renderer = new DashboardRenderer('app');
    expect(renderer).toBeDefined();
  });

  it('should throw error if element not found', () => {
    expect(() => {
      new DashboardRenderer('non-existent');
    }).toThrow('Element with id "non-existent" not found');
  });

  it('should render initial state', () => {
    const renderer = new DashboardRenderer('app');
    const state: DashboardState = {
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

    renderer.render(state);

    expect(container.innerHTML).toContain('Test Dashboard');
    expect(container.innerHTML).toContain('IDLE');
    expect(container.innerHTML).toContain('Run Tests');
  });

  it('should render module cards', () => {
    const renderer = new DashboardRenderer('app');
    const state: DashboardState = {
      overallStatus: 'passed',
      modules: [
        {
          name: 'Test Module 1',
          status: 'passed',
          lastRun: Date.now(),
          duration: 150,
          coverage: 85.5
        },
        {
          name: 'Test Module 2',
          status: 'failed',
          lastRun: Date.now(),
          duration: 200,
          coverage: 60.0,
          error: 'Test failed'
        }
      ],
      lastUpdate: Date.now(),
      isRunning: false,
      coverageSummary: {
        average: 72.75,
        trend: 'up'
      },
      history: []
    };

    renderer.render(state);

    expect(container.innerHTML).toContain('Test Module 1');
    expect(container.innerHTML).toContain('Test Module 2');
    expect(container.innerHTML).toContain('85.5%');
    expect(container.innerHTML).toContain('60.0%');
    expect(container.innerHTML).toContain('Test failed');
  });

  it('should render running state with disabled button', () => {
    const renderer = new DashboardRenderer('app');
    const state: DashboardState = {
      overallStatus: 'running',
      modules: [],
      lastUpdate: Date.now(),
      isRunning: true,
      coverageSummary: {
        average: 0,
        trend: 'stable'
      },
      history: []
    };

    renderer.render(state);

    expect(container.innerHTML).toContain('RUNNING');
    expect(container.innerHTML).toContain('Running...');
    
    const button = container.querySelector('#run-tests-btn') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  it('should render coverage summary', () => {
    const renderer = new DashboardRenderer('app');
    const state: DashboardState = {
      overallStatus: 'passed',
      modules: [],
      lastUpdate: Date.now(),
      isRunning: false,
      coverageSummary: {
        average: 85.7,
        trend: 'up'
      },
      history: []
    };

    renderer.render(state);

    expect(container.innerHTML).toContain('85.7%');
    expect(container.innerHTML).toContain('Coverage');
  });

  it('should render historical sparkline', () => {
    const renderer = new DashboardRenderer('app');
    const state: DashboardState = {
      overallStatus: 'passed',
      modules: [],
      lastUpdate: Date.now(),
      isRunning: false,
      coverageSummary: {
        average: 75,
        trend: 'stable'
      },
      history: [
        { timestamp: Date.now() - 10000, coverage: 70, status: 'passed' },
        { timestamp: Date.now() - 5000, coverage: 72, status: 'passed' },
        { timestamp: Date.now(), coverage: 75, status: 'passed' }
      ]
    };

    renderer.render(state);

    expect(container.innerHTML).toContain('Coverage History');
    expect(container.querySelector('.sparkline')).toBeDefined();
  });

  it('should show empty message when no historical data', () => {
    const renderer = new DashboardRenderer('app');
    const state: DashboardState = {
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

    renderer.render(state);

    expect(container.innerHTML).toContain('No historical data yet');
  });

  it('should render error messages in module cards', () => {
    const renderer = new DashboardRenderer('app');
    const state: DashboardState = {
      overallStatus: 'error',
      modules: [
        {
          name: 'Failing Module',
          status: 'error',
          error: 'Connection timeout'
        }
      ],
      lastUpdate: Date.now(),
      isRunning: false,
      coverageSummary: {
        average: 0,
        trend: 'stable'
      },
      history: []
    };

    renderer.render(state);

    expect(container.innerHTML).toContain('Connection timeout');
  });

  it('should dispatch run-tests event on button click', () => {
    const renderer = new DashboardRenderer('app');
    const state: DashboardState = {
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

    let eventDispatched = false;
    window.addEventListener('run-tests', () => {
      eventDispatched = true;
    });

    renderer.render(state);

    const button = container.querySelector('#run-tests-btn') as HTMLButtonElement;
    button?.click();

    expect(eventDispatched).toBe(true);
  });
});
