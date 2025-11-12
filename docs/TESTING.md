# Testing Guide

## Overview

This document provides comprehensive guidance on testing the PanSou project. The project uses Go's built-in testing framework combined with the `testify` assertion library to ensure code quality and reliability.

## Test Infrastructure

### Test Utilities Package (`internal/testutil`)

The project provides a centralized test utilities package that helps write clean, isolated tests. This package includes:

- **Configuration Helpers**: Functions to set up test configurations with temporary directories
- **Environment Management**: Utilities to backup and restore environment variables
- **Test Fixtures**: Pre-built sample data structures for common test scenarios
- **Plugin Stubs**: Mock implementations of plugin interfaces for testing
- **Cache Helpers**: Functions to create isolated test cache instances

### Key Components

#### 1. Configuration Helpers

```go
// Create isolated test config with automatic cleanup
tc, cleanup := testutil.SetupTestConfig(t)
defer cleanup()
```

Features:
- Creates temporary cache directories
- Backs up existing environment variables
- Initializes config with test-specific settings
- Provides cleanup function to restore state

#### 2. Environment Variable Management

```go
// Set custom environment variables for a test
restore := testutil.WithCustomEnv(map[string]string{
    "CACHE_ENABLED": "true",
    "PORT": "19999",
})
defer restore()
```

#### 3. Test Fixtures

Sample data generators for common test scenarios:

```go
// Single search result
result := testutil.SampleSearchResult("Test Title")

// Multiple results
results := testutil.SampleSearchResults(10)

// Specific link types
baiduLink := testutil.SampleBaiduLink()
aliyunLink := testutil.SampleAliyunLink()
magnetLink := testutil.SampleMagnetLink()

// Complete responses
response := testutil.SampleSearchResponse(5)
mergedResponse := testutil.SampleSearchResponseWithMerged()
```

#### 4. Plugin Stubs

Mock plugin implementations for testing:

```go
// Create a stub plugin
plugin := testutil.NewStubPlugin("test_plugin", 1)

// With custom search function
plugin = testutil.NewStubPlugin("custom", 1).
    WithSearchFunc(func(keyword string, ext map[string]interface{}) ([]model.SearchResult, error) {
        return testutil.SampleSearchResults(3), nil
    })

// Create test plugin manager
pm := testutil.CreateTestPluginManager(t, plugin1, plugin2)
```

## Running Tests

### All Tests

```bash
go test ./...
```

### Specific Package

```bash
go test ./config
go test ./plugin
go test ./model
```

### With Verbose Output

```bash
go test -v ./...
```

### With Coverage

```bash
# Generate coverage report
go test -cover ./...

# Detailed coverage analysis
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

### With Race Detection

```bash
go test -race ./...
```

## Test Structure Guidelines

### Basic Test Pattern

```go
func TestFunctionName(t *testing.T) {
    // Setup (optional)
    tc, cleanup := testutil.SetupTestConfig(t)
    defer cleanup()
    
    // Arrange - prepare test data
    input := "test input"
    expected := "expected output"
    
    // Act - execute the code under test
    result := FunctionName(input)
    
    // Assert - verify the results
    assert.Equal(t, expected, result)
}
```

### Table-Driven Tests

For testing multiple scenarios:

```go
func TestMultipleScenarios(t *testing.T) {
    tests := []struct {
        name     string
        input    string
        expected string
    }{
        {"scenario1", "input1", "output1"},
        {"scenario2", "input2", "output2"},
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := FunctionName(tt.input)
            assert.Equal(t, tt.expected, result)
        })
    }
}
```

## Global State Management

The project has several pieces of global state that need careful handling in tests:

### 1. Config Global State

```go
// config.AppConfig is a package-level variable
func TestWithConfig(t *testing.T) {
    // Use setupTestConfig to manage global config
    tc, cleanup := testutil.SetupTestConfig(t)
    defer cleanup()
    
    // Test code here
}
```

### 2. Plugin Registry

The plugin package maintains a global registry. Tests should:
- Use isolated plugin managers instead of the global registry
- Create new plugin managers for each test

```go
func TestWithPlugins(t *testing.T) {
    pm := plugin.NewPluginManager()
    // Register test-specific plugins
}
```

### 3. Cache Instances

Cache instances can be global. Tests should:
- Create isolated cache instances using testutil
- Clean up cache directories after tests

```go
func TestWithCache(t *testing.T) {
    cache, cleanup := testutil.SetupTestCache(t)
    defer cleanup()
    
    // Test code here
}
```

## Best Practices

1. **Test Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Always use `defer` to ensure cleanup functions are called
3. **Descriptive Names**: Use clear test names that explain what is being tested
4. **Use Test Helpers**: Leverage testutil fixtures instead of creating test data manually
5. **Test Edge Cases**: Include tests for error conditions and boundary cases
6. **Avoid External Dependencies**: Use stubs and mocks instead of real external services
7. **Fast Tests**: Keep tests fast by using in-memory structures where possible

## Continuous Integration

The project uses GitHub Actions for CI. The test workflow:

- Runs on: Push to main/develop, Pull requests
- Tests across multiple Go versions (1.18-1.23)
- Executes: `go vet`, `go test -race`
- Generates coverage reports

See `.github/workflows/test.yml` for details.

## Troubleshooting

### Import Cycles

If you encounter import cycle errors with testutil:
- Don't import testutil from packages it depends on (config, plugin, model)
- Instead, create local test helpers in the test file
- See `config/config_test.go` and `plugin/plugin_test.go` for examples

### Global State Issues

If tests interfere with each other:
- Ensure proper cleanup with defer statements
- Use isolated instances (new plugin managers, temporary cache dirs)
- Consider using sub-tests with `t.Run()` for better isolation

### Flaky Tests

If tests pass/fail inconsistently:
- Check for time-dependent code (use fixed times in tests)
- Look for race conditions (run with `-race` flag)
- Ensure proper cleanup of goroutines and resources

## Contributing Tests

When adding new features:

1. Write tests alongside the feature code
2. Aim for good coverage of both success and error paths
3. Add test fixtures to testutil if they're reusable
4. Update this documentation if adding new test patterns
5. Ensure all tests pass before submitting PR: `go test ./...`

## Further Reading

- [CONTRIBUTING.md](../CONTRIBUTING.md) - General contribution guidelines
- [Go Testing Documentation](https://golang.org/pkg/testing/)
- [Testify Documentation](https://github.com/stretchr/testify)
