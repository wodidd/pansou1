package testutil

import (
    "os"
    "testing"

    "pansou/service"
    "pansou/util/cache"
)

// SetupTestCache creates a test cache instance with a temporary directory
func SetupTestCache(t *testing.T) (*cache.EnhancedTwoLevelCache, func()) {
    t.Helper()

    // Create temporary cache directory
    tempDir, err := os.MkdirTemp("", "pansou-test-cache-*")
    if err != nil {
        t.Fatalf("Failed to create temp cache dir: %v", err)
    }

    // Save original cache path
    originalPath := os.Getenv("CACHE_PATH")

    // Set test cache path
    os.Setenv("CACHE_PATH", tempDir)
    os.Setenv("CACHE_ENABLED", "true")

    // Create cache instance
    testCache, err := cache.NewEnhancedTwoLevelCache()
    if err != nil {
        os.RemoveAll(tempDir)
        t.Fatalf("Failed to create test cache: %v", err)
    }

    cleanup := func() {
        // Clear cache
        if testCache != nil {
            testCache.Clear()
        }

        // Restore original cache path
        if originalPath != "" {
            os.Setenv("CACHE_PATH", originalPath)
        } else {
            os.Unsetenv("CACHE_PATH")
        }

        // Remove temporary directory
        os.RemoveAll(tempDir)
    }

    return testCache, cleanup
}

// ResetGlobalCache resets global cache instances in the service package
// This is necessary to ensure tests don't interfere with each other
func ResetGlobalCache() {
    // Note: The service package uses package-level variables for cache
    // We document that tests should avoid relying on global cache state
    // and instead use isolated cache instances

    // Reset the global cache write manager
    service.SetGlobalCacheWriteManager(nil)
}

// CreateTestCacheManager creates a test cache write manager
func CreateTestCacheManager() (*cache.DelayedBatchWriteManager, error) {
    // Create with default settings for testing
    return cache.NewDelayedBatchWriteManager()
}
