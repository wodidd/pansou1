# Contributing to PanSou

Thank you for your interest in contributing to PanSou! This document provides guidelines and instructions for contributing to the project.

## Development Setup

### Prerequisites

- Go 1.18 or higher
- Git

### Setting Up Your Development Environment

1. Fork the repository on GitHub
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/pansou.git
   cd pansou
   ```

3. Install dependencies:
   ```bash
   go mod download
   ```

4. Run the application locally:
   ```bash
   go run main.go
   ```

## Running Tests

PanSou uses Go's built-in testing framework along with the `testify` assertion library.

### Running All Tests

To run all tests in the project:

```bash
go test ./...
```

### Running Tests with Verbose Output

```bash
go test -v ./...
```

### Running Tests with Coverage

```bash
go test -cover ./...
```

To generate a detailed coverage report:

```bash
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

### Running Tests for a Specific Package

```bash
go test ./internal/testutil
go test ./service
go test ./plugin
```

## Test Utilities

The project provides a comprehensive test utility package at `internal/testutil` to help write clean, isolated tests.

### Available Test Helpers

#### Configuration Helpers

```go
import "pansou/internal/testutil"

func TestMyFunction(t *testing.T) {
    // Setup test config with automatic cleanup
    tc, cleanup := testutil.SetupTestConfig(t)
    defer cleanup()
    
    // Your test code here
}
```

The `SetupTestConfig` function:
- Creates temporary cache directories
- Backs up environment variables
- Initializes config with test-specific settings
- Returns a cleanup function to restore state

#### Custom Environment Variables

```go
func TestWithCustomEnv(t *testing.T) {
    restore := testutil.WithCustomEnv(map[string]string{
        "CACHE_ENABLED": "true",
        "PORT": "19999",
    })
    defer restore()
    
    // Test code with custom environment
}
```

#### Sample Fixtures

The testutil package provides various fixture factories:

```go
// Create a single search result
result := testutil.SampleSearchResult("My Test Title")

// Create multiple search results
results := testutil.SampleSearchResults(10)

// Create specific link types
baiduLink := testutil.SampleBaiduLink()
aliyunLink := testutil.SampleAliyunLink()
magnetLink := testutil.SampleMagnetLink()

// Create search responses
response := testutil.SampleSearchResponse(5)
mergedResponse := testutil.SampleSearchResponseWithMerged()
```

#### Plugin Stubs

For testing plugin-related functionality:

```go
func TestPluginSearch(t *testing.T) {
    // Create stub plugins
    plugin1 := testutil.NewStubPlugin("test_plugin", 1).
        WithSearchFunc(func(keyword string, ext map[string]interface{}) ([]model.SearchResult, error) {
            return testutil.SampleSearchResults(3), nil
        })
    
    // Create plugin manager with test plugins
    pm := testutil.CreateTestPluginManager(t, plugin1)
    
    // Test code using plugin manager
}
```

#### Cache Helpers

```go
func TestCaching(t *testing.T) {
    cache, cleanup := testutil.SetupTestCache(t)
    defer cleanup()
    
    // Test code using cache
}
```

### Writing Tests

#### Test Structure

Follow this general structure for tests:

```go
func TestFunctionName(t *testing.T) {
    // Setup
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

#### Table-Driven Tests

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

#### Handling Global State

The testutil package provides utilities to manage global state:

```go
func TestWithGlobalState(t *testing.T) {
    // Setup cleans up global config
    tc, cleanup := testutil.SetupTestConfig(t)
    defer cleanup()
    
    // Reset plugin registry if needed
    testutil.ResetPluginRegistry()
    
    // Reset cache state if needed
    testutil.ResetGlobalCache()
    
    // Your test code
}
```

### Test Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Always use `defer` to ensure cleanup functions are called
3. **Descriptive Names**: Use clear, descriptive test names that explain what is being tested
4. **Use Fixtures**: Leverage testutil fixtures instead of creating test data manually
5. **Test Edge Cases**: Include tests for error conditions and edge cases
6. **Avoid External Dependencies**: Use stubs and mocks instead of real external services

## Code Style

- Follow standard Go formatting (use `gofmt` or `go fmt`)
- Use meaningful variable and function names
- Add comments for exported functions and types
- Keep functions focused and reasonably sized

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes and add tests
3. Ensure all tests pass: `go test ./...`
4. Commit your changes with clear, descriptive commit messages
5. Push to your fork and create a pull request
6. Wait for review and address any feedback

## Continuous Integration

The project uses GitHub Actions for CI. On each pull request:
- Tests are run across all packages
- Code is built to ensure compilation succeeds
- Docker images are built (for main branch merges)

You can view CI results in the "Actions" tab of the repository.

## Getting Help

If you have questions or need help:
- Open an issue on GitHub
- Check existing issues for similar questions
- Review the documentation in the `docs/` directory

Thank you for contributing to PanSou!
