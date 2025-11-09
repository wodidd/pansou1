# Changelog

All notable changes to the PanSou project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### Test Dashboard Module (TypeScript)
- **Test Orchestration System**: New `typescript/src/dashboard/` module for managing automated test execution across Go and Jest test suites
  - `TestRunner` class: Sequential test module execution with event-driven status updates
  - `TestStatusStore` class: Centralized state management with immutable snapshots
  - Parser utilities for Go test JSON output (`-json` flag) and Jest JSON output
  - Coverage aggregation from Go modules via `go tool cover`

- **New TypeScript Dependencies**:
  - `jest` (^29.0.0): JavaScript testing framework
  - `@types/jest` (^29.5.14): TypeScript types for Jest
  - `ts-jest` (^29.0.0): TypeScript preprocessor for Jest

- **Test Configuration Files**:
  - `typescript/jest.config.ts`: Jest configuration for dashboard unit tests
  - `typescript/tsconfig.test.json`: TypeScript configuration for test environment

- **Dashboard Features**:
  - Real-time test status tracking via `TestStatusSnapshot` interface
  - Event emission for test lifecycle (`queued`, `running`, `completed`, `failed`)
  - Automatic test queuing to prevent concurrent runs
  - Graceful cancellation with cleanup
  - Artifact persistence (test results, coverage profiles, raw output)
  - Configurable timeouts (default: 15 minutes per module)
  - Support for Go tests, Jest tests, and generic command execution

- **Environment Variables** (for dashboard):
  - `TEST_ARTIFACT_DIR`: Directory for test artifacts and coverage reports
  - `GO_BINARY`: Path to Go binary for running tests
  - `NODE_ENV`: Node environment mode (development/test/production)

- **Documentation**:
  - New `typescript/README.md` with comprehensive dashboard documentation
  - Added "测试仪表板" (Test Dashboard) section to main `README.md`
  - Updated `mcp-config.json` with dashboard environment variable examples
  - Inline code comments throughout dashboard modules for maintainability

- **API Interfaces**:
  - `TestStatusSnapshot`: Complete test run state snapshot (exposed via `/dashboard/status` endpoint pattern)
  - `ModuleState`: Individual test module state with results and coverage
  - `TestModuleDefinition`: Configuration interface for defining test modules
  - `ModuleCoverageSummary`: Coverage aggregation with per-package breakdown

### Changed

- Updated `.gitignore` to exclude test artifacts and coverage files
- Enhanced `mcp-config.json` comments to include dashboard configuration examples

## [1.0.0] - Previous Release

Initial release of PanSou with:
- High-performance netdisk search API
- TG channel and plugin-based searching
- Two-level caching system
- MCP server integration
- JWT authentication support
- Multi-netdisk type support
