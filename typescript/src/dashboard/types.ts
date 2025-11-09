export interface TestModule {
  id: string;
  name: string;
  command: string;
  workingDirectory: string;
  labels: string[];
  timeout?: number;
}

export interface TestResult {
  moduleId: string;
  status: 'passed' | 'failed' | 'skipped' | 'timeout';
  duration: number;
  passCount: number;
  failCount: number;
  skipCount: number;
  coverage?: number;
  error?: string;
  output?: string[];
}

export interface CoverageData {
  moduleId: string;
  totalLines: number;
  coveredLines: number;
  percentage: number;
  functions: {
    total: number;
    covered: number;
  };
}

export interface TestStatus {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  modules: TestResult[];
  overallCoverage?: number;
  coverageData: CoverageData[];
  error?: string;
}

export interface TestRunnerConfig {
  cacheDirectory: string;
  defaultTimeout: number;
  maxConcurrentRuns: number;
  enableCoverage: boolean;
}

export type TestRunnerEvent = 
  | { type: 'queued'; runId: string }
  | { type: 'started'; runId: string; modules: TestModule[] }
  | { type: 'moduleStarted'; runId: string; moduleId: string }
  | { type: 'moduleCompleted'; runId: string; moduleId: string; result: TestResult }
  | { type: 'completed'; runId: string; status: TestStatus }
  | { type: 'failed'; runId: string; error: string; status: TestStatus }
  | { type: 'cancelled'; runId: string; status: TestStatus };

export interface GoTestEvent {
  Time: string;
  Action: 'run' | 'pause' | 'cont' | 'pass' | 'fail' | 'skip' | 'output';
  Package: string;
  Test?: string;
  Output?: string;
  Elapsed?: number;
}

export interface JestTestResult {
  numPassingTests: number;
  numFailingTests: number;
  numPendingTests: number;
  numTotalTests: number;
  startTime: number;
  endTime: number;
  coverageMap?: {
    data?: Record<string, any>;
  };
}