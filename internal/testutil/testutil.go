// Package testutil provides test utilities for the PanSou project.
//
// This package centralizes common test helpers including:
//   - Configuration initialization and cleanup (config.go)
//   - Temporary cache directory management (cache.go)
//   - Environment variable overrides (config.go)
//   - Plugin stubs and test fixtures (plugin.go)
//   - Sample SearchResult payloads (fixtures.go)
//   - Global state reset utilities (config.go, cache.go, plugin.go)
//
// Usage:
//
//	func TestMyFunction(t *testing.T) {
//	    // Setup test config with automatic cleanup
//	    _, cleanup := testutil.SetupTestConfig(t)
//	    defer cleanup()
//
//	    // Create test fixtures
//	    result := testutil.SampleSearchResult("test")
//
//	    // Your test code here...
//	}
package testutil
