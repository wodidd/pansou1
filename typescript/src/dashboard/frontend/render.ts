import { DashboardState, ModuleStatus } from './state.js';

export class DashboardRenderer {
  private rootElement: HTMLElement;

  constructor(rootElementId: string) {
    const element = document.getElementById(rootElementId);
    if (!element) {
      throw new Error(`Element with id "${rootElementId}" not found`);
    }
    this.rootElement = element;
  }

  render(state: DashboardState): void {
    this.rootElement.innerHTML = `
      <div class="dashboard">
        <header class="dashboard-header">
          <h1>Test Dashboard</h1>
          ${this.renderOverallStatus(state)}
        </header>
        
        <div class="dashboard-content">
          <div class="coverage-section">
            ${this.renderCoverageSummary(state)}
            ${this.renderSparkline(state)}
          </div>
          
          <div class="modules-section">
            <h2>Modules</h2>
            <div class="modules-grid">
              ${state.modules.map(module => this.renderModuleCard(module)).join('')}
            </div>
          </div>
          
          <div class="actions-section">
            ${this.renderActions(state)}
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private renderOverallStatus(state: DashboardState): string {
    const statusClass = `status-${state.overallStatus}`;
    const statusText = state.overallStatus.toUpperCase();
    const timestamp = new Date(state.lastUpdate).toLocaleTimeString();

    return `
      <div class="overall-status ${statusClass}">
        <span class="status-badge">${statusText}</span>
        <span class="status-time">Last updated: ${timestamp}</span>
      </div>
    `;
  }

  private renderCoverageSummary(state: DashboardState): string {
    const coverage = state.coverageSummary.average;
    const trend = state.coverageSummary.trend;
    const trendIcon = this.getTrendIcon(trend);
    const coverageClass = this.getCoverageClass(coverage);

    return `
      <div class="coverage-summary">
        <h3>Coverage</h3>
        <div class="coverage-meter ${coverageClass}">
          <div class="coverage-bar" style="width: ${coverage}%"></div>
          <span class="coverage-value">${coverage.toFixed(1)}%</span>
        </div>
        <div class="coverage-trend">
          <span class="trend-icon">${trendIcon}</span>
          <span class="trend-text">${trend}</span>
        </div>
      </div>
    `;
  }

  private renderSparkline(state: DashboardState): string {
    if (state.history.length === 0) {
      return '<div class="sparkline-container"><div class="sparkline-empty">No historical data yet</div></div>';
    }

    const maxCoverage = Math.max(...state.history.map(h => h.coverage), 100);
    const points = state.history.map((snapshot, index) => {
      const x = (index / (state.history.length - 1)) * 100;
      const y = 100 - (snapshot.coverage / maxCoverage) * 100;
      return `${x},${y}`;
    }).join(' ');

    return `
      <div class="sparkline-container">
        <h4>Coverage History</h4>
        <svg class="sparkline" viewBox="0 0 100 30" preserveAspectRatio="none">
          <polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2" />
        </svg>
      </div>
    `;
  }

  private renderModuleCard(module: ModuleStatus): string {
    const statusClass = `status-${module.status}`;
    const lastRun = module.lastRun 
      ? new Date(module.lastRun).toLocaleTimeString()
      : 'Never';
    const duration = module.duration !== undefined
      ? `${module.duration}ms`
      : 'N/A';
    const coverage = module.coverage !== undefined
      ? `${module.coverage.toFixed(1)}%`
      : 'N/A';
    const trend = module.trend ? this.getTrendIcon(module.trend) : '';
    const error = module.error 
      ? `<div class="module-error">${this.escapeHtml(module.error)}</div>`
      : '';

    return `
      <div class="module-card ${statusClass}">
        <div class="module-header">
          <h3 class="module-name">${this.escapeHtml(module.name)}</h3>
          <span class="status-chip ${statusClass}">${module.status}</span>
        </div>
        <div class="module-details">
          <div class="detail-row">
            <span class="detail-label">Last Run:</span>
            <span class="detail-value">${lastRun}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Duration:</span>
            <span class="detail-value">${duration}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Coverage:</span>
            <span class="detail-value">
              ${coverage}
              ${trend ? `<span class="trend-indicator">${trend}</span>` : ''}
            </span>
          </div>
        </div>
        ${error}
      </div>
    `;
  }

  private renderActions(state: DashboardState): string {
    const buttonDisabled = state.isRunning ? 'disabled' : '';
    const buttonText = state.isRunning ? 'Running...' : 'Run Tests';
    const buttonClass = state.isRunning ? 'loading' : '';

    return `
      <button 
        id="run-tests-btn" 
        class="btn-primary ${buttonClass}" 
        ${buttonDisabled}
      >
        ${state.isRunning ? '<span class="spinner"></span>' : ''}
        ${buttonText}
      </button>
    `;
  }

  private attachEventListeners(): void {
    const runButton = document.getElementById('run-tests-btn');
    if (runButton) {
      runButton.addEventListener('click', () => {
        const event = new CustomEvent('run-tests');
        window.dispatchEvent(event);
      });
    }
  }

  private getTrendIcon(trend: 'up' | 'down' | 'stable'): string {
    switch (trend) {
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      case 'stable':
        return '→';
    }
  }

  private getCoverageClass(coverage: number): string {
    if (coverage >= 80) return 'coverage-high';
    if (coverage >= 60) return 'coverage-medium';
    return 'coverage-low';
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
