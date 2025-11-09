import {
  getState,
  subscribe,
  updateState,
  updateModule,
  handleEvent,
  StateUpdateEvent,
  DashboardState,
  ModuleStatus
} from '../state';

describe('State Management', () => {
  beforeEach(() => {
    updateState({
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
  });

  it('should return initial state', () => {
    const state = getState();
    expect(state).toBeDefined();
    expect(state.overallStatus).toBeDefined();
    expect(state.modules).toBeInstanceOf(Array);
  });

  it('should update overall status', () => {
    updateState({ overallStatus: 'running' });
    const state = getState();
    expect(state.overallStatus).toBe('running');
  });

  it('should notify subscribers on state update', () => {
    const mockListener = jest.fn();
    const unsubscribe = subscribe(mockListener);

    updateState({ overallStatus: 'passed' });

    expect(mockListener).toHaveBeenCalled();
    expect(mockListener).toHaveBeenCalledWith(expect.objectContaining({
      overallStatus: 'passed'
    }));

    unsubscribe();
  });

  it('should add new module', () => {
    updateModule('TestModule', {
      status: 'passed',
      coverage: 85
    });

    const state = getState();
    const module = state.modules.find(m => m.name === 'TestModule');

    expect(module).toBeDefined();
    expect(module?.status).toBe('passed');
    expect(module?.coverage).toBe(85);
  });

  it('should update existing module', () => {
    updateModule('TestModule', {
      status: 'running',
      coverage: 80
    });

    updateModule('TestModule', {
      status: 'passed',
      coverage: 90
    });

    const state = getState();
    const modules = state.modules.filter(m => m.name === 'TestModule');

    expect(modules.length).toBe(1);
    expect(modules[0].status).toBe('passed');
    expect(modules[0].coverage).toBe(90);
  });

  it('should handle status event', () => {
    const event: StateUpdateEvent = {
      type: 'status',
      data: {
        status: 'running',
        isRunning: true
      }
    };

    handleEvent(event);

    const state = getState();
    expect(state.overallStatus).toBe('running');
    expect(state.isRunning).toBe(true);
  });

  it('should handle module event', () => {
    const event: StateUpdateEvent = {
      type: 'module',
      data: {
        name: 'NewModule',
        status: 'passed',
        lastRun: Date.now(),
        duration: 100,
        coverage: 75
      }
    };

    handleEvent(event);

    const state = getState();
    const module = state.modules.find(m => m.name === 'NewModule');

    expect(module).toBeDefined();
    expect(module?.status).toBe('passed');
    expect(module?.coverage).toBe(75);
  });

  it('should handle coverage event', () => {
    const event: StateUpdateEvent = {
      type: 'coverage',
      data: {
        average: 82.5,
        trend: 'up'
      }
    };

    handleEvent(event);

    const state = getState();
    expect(state.coverageSummary.average).toBe(82.5);
    expect(state.coverageSummary.trend).toBe('up');
  });

  it('should handle complete event and add historical snapshot', () => {
    const event: StateUpdateEvent = {
      type: 'complete',
      data: {
        status: 'passed'
      }
    };

    const initialHistoryLength = getState().history.length;
    
    handleEvent(event);

    const state = getState();
    expect(state.overallStatus).toBe('passed');
    expect(state.isRunning).toBe(false);
    expect(state.history.length).toBe(initialHistoryLength + 1);
  });

  it('should calculate coverage summary from modules', () => {
    updateModule('Module1', {
      status: 'passed',
      coverage: 80
    });

    updateModule('Module2', {
      status: 'passed',
      coverage: 90
    });

    const state = getState();
    expect(state.coverageSummary.average).toBe(85);
  });

  it('should determine coverage trend', () => {
    updateState({
      coverageSummary: {
        average: 70,
        trend: 'stable'
      }
    });

    updateModule('Module1', {
      status: 'passed',
      coverage: 90
    });

    const state = getState();
    expect(state.coverageSummary.average).toBe(90);
    expect(state.coverageSummary.trend).toBe('up');
  });

  it('should limit history to 20 snapshots', () => {
    for (let i = 0; i < 25; i++) {
      handleEvent({
        type: 'complete',
        data: { status: 'passed' }
      });
    }

    const state = getState();
    expect(state.history.length).toBeLessThanOrEqual(20);
  });

  it('should unsubscribe listener', () => {
    const mockListener = jest.fn();
    const unsubscribe = subscribe(mockListener);

    updateState({ overallStatus: 'running' });
    expect(mockListener).toHaveBeenCalledTimes(1);

    unsubscribe();

    updateState({ overallStatus: 'passed' });
    expect(mockListener).toHaveBeenCalledTimes(1);
  });
});
