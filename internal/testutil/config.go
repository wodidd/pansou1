package testutil

import (
    "os"
    "path/filepath"
    "testing"

    "pansou/config"
)

// TestConfig holds test configuration state
type TestConfig struct {
    OriginalConfig *config.Config
    TempCacheDir   string
    EnvBackup      map[string]string
}

// SetupTestConfig initializes a test configuration with temporary directories
// and returns a cleanup function that should be deferred
func SetupTestConfig(t *testing.T) (*TestConfig, func()) {
    t.Helper()

    // Create temporary cache directory
    tempDir, err := os.MkdirTemp("", "pansou-test-cache-*")
    if err != nil {
        t.Fatalf("Failed to create temp cache dir: %v", err)
    }

    // Backup original config
    originalConfig := config.AppConfig

    // Backup environment variables
    envBackup := BackupEnv([]string{
        "CHANNELS",
        "CONCURRENCY",
        "PORT",
        "PROXY",
        "CACHE_ENABLED",
        "CACHE_PATH",
        "CACHE_MAX_SIZE",
        "CACHE_TTL",
        "PLUGIN_TIMEOUT",
        "ASYNC_PLUGIN_ENABLED",
        "ENABLED_PLUGINS",
        "ASYNC_RESPONSE_TIMEOUT",
        "AUTH_ENABLED",
    })

    // Set test-specific environment variables
    os.Setenv("CACHE_PATH", tempDir)
    os.Setenv("CACHE_ENABLED", "true")
    os.Setenv("PORT", "18888") // Use different port for tests
    os.Setenv("ASYNC_PLUGIN_ENABLED", "false") // Disable async plugins by default in tests
    os.Setenv("AUTH_ENABLED", "false") // Disable auth by default in tests

    // Initialize config with test settings
    config.Init()

    tc := &TestConfig{
        OriginalConfig: originalConfig,
        TempCacheDir:   tempDir,
        EnvBackup:      envBackup,
    }

    // Return cleanup function
    cleanup := func() {
        // Restore original config
        config.AppConfig = originalConfig

        // Restore environment variables
        RestoreEnv(envBackup)

        // Clean up temporary directory
        os.RemoveAll(tempDir)
    }

    return tc, cleanup
}

// WithCustomEnv sets custom environment variables for testing
// Returns a cleanup function that restores the original state
func WithCustomEnv(envVars map[string]string) func() {
    keys := keysFromMap(envVars)
    backup := BackupEnv(keys)

    // Set the new values
    for key, value := range envVars {
        os.Setenv(key, value)
    }

    return func() {
        // For each key we modified
        for _, key := range keys {
            if originalValue, existed := backup[key]; existed {
                // Restore original value
                os.Setenv(key, originalValue)
            } else {
                // Key didn't exist before, so unset it
                os.Unsetenv(key)
            }
        }
    }
}

// BackupEnv backs up environment variables
// Returns a map with keys that existed (with their values)
// Keys not in the returned map did not exist before
func BackupEnv(keys []string) map[string]string {
    backup := make(map[string]string)
    for _, key := range keys {
        if value, exists := os.LookupEnv(key); exists {
            backup[key] = value
        }
    }
    return backup
}

// RestoreEnv restores environment variables from backup
// Variables that were not in the backup (didn't exist before) are unset
func RestoreEnv(backup map[string]string) {
    // Collect all keys that were backed up (these existed before)
    backedUpKeys := make(map[string]bool)
    for key := range backup {
        backedUpKeys[key] = true
    }
    
    // Restore the backed up values
    for key, value := range backup {
        os.Setenv(key, value)
    }
}

// keysFromMap extracts keys from a map
func keysFromMap(m map[string]string) []string {
    keys := make([]string, 0, len(m))
    for key := range m {
        keys = append(keys, key)
    }
    return keys
}

// InitTestConfig is a convenience function that initializes config for testing
// without requiring a *testing.T parameter
func InitTestConfig(cacheDir string) {
    if cacheDir == "" {
        cacheDir = filepath.Join(os.TempDir(), "pansou-test-cache")
        os.MkdirAll(cacheDir, 0755)
    }
    
    os.Setenv("CACHE_PATH", cacheDir)
    os.Setenv("CACHE_ENABLED", "true")
    os.Setenv("ASYNC_PLUGIN_ENABLED", "false")
    
    config.Init()
}

// ResetGlobalConfig resets the global config to nil
func ResetGlobalConfig() {
    config.AppConfig = nil
}
