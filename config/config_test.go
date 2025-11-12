package config

import (
    "os"
    "testing"

    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

// setupTestConfig sets up a test configuration with a temporary cache directory
func setupTestConfig(t *testing.T) func() {
    t.Helper()

    // Create temporary cache directory
    tempDir, err := os.MkdirTemp("", "pansou-test-cache-*")
    require.NoError(t, err)

    // Backup and set environment
    originalCachePath := os.Getenv("CACHE_PATH")
    os.Setenv("CACHE_PATH", tempDir)
    os.Setenv("CACHE_ENABLED", "true")

    // Initialize config
    Init()

    return func() {
        // Restore environment
        if originalCachePath != "" {
            os.Setenv("CACHE_PATH", originalCachePath)
        } else {
            os.Unsetenv("CACHE_PATH")
        }
        // Clean up temp directory
        os.RemoveAll(tempDir)
    }
}

func TestInit(t *testing.T) {
    // Setup test config
    cleanup := setupTestConfig(t)
    defer cleanup()

    // Verify config was initialized
    require.NotNil(t, AppConfig)
    assert.NotEmpty(t, AppConfig.Port)
    assert.NotEmpty(t, AppConfig.CachePath)
}

func TestGetDefaultChannels(t *testing.T) {
    tests := []struct {
        name     string
        envValue string
        expected []string
    }{
        {
            name:     "default channels when not set",
            envValue: "",
            expected: []string{"tgsearchers3"},
        },
        {
            name:     "single channel",
            envValue: "channel1",
            expected: []string{"channel1"},
        },
        {
            name:     "multiple channels",
            envValue: "channel1,channel2,channel3",
            expected: []string{"channel1", "channel2", "channel3"},
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Backup and set environment
            originalValue := os.Getenv("CHANNELS")
            if tt.envValue != "" {
                os.Setenv("CHANNELS", tt.envValue)
            } else {
                os.Unsetenv("CHANNELS")
            }
            defer func() {
                if originalValue != "" {
                    os.Setenv("CHANNELS", originalValue)
                } else {
                    os.Unsetenv("CHANNELS")
                }
            }()

            // Test the function
            result := getDefaultChannels()
            assert.Equal(t, tt.expected, result)
        })
    }
}

func TestGetPort(t *testing.T) {
    tests := []struct {
        name     string
        envValue string
        expected string
    }{
        {
            name:     "default port",
            envValue: "",
            expected: "8888",
        },
        {
            name:     "custom port",
            envValue: "9999",
            expected: "9999",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            if tt.envValue != "" {
                os.Setenv("PORT", tt.envValue)
                defer os.Unsetenv("PORT")
            } else {
                os.Unsetenv("PORT")
            }

            result := getPort()
            assert.Equal(t, tt.expected, result)
        })
    }
}

func TestGetCacheEnabled(t *testing.T) {
    tests := []struct {
        name     string
        envValue string
        expected bool
    }{
        {
            name:     "default enabled",
            envValue: "",
            expected: true,
        },
        {
            name:     "explicitly enabled with true",
            envValue: "true",
            expected: true,
        },
        {
            name:     "explicitly enabled with 1",
            envValue: "1",
            expected: true,
        },
        {
            name:     "disabled with false",
            envValue: "false",
            expected: false,
        },
        {
            name:     "disabled with 0",
            envValue: "0",
            expected: false,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            if tt.envValue != "" {
                os.Setenv("CACHE_ENABLED", tt.envValue)
                defer os.Unsetenv("CACHE_ENABLED")
            } else {
                os.Unsetenv("CACHE_ENABLED")
            }

            result := getCacheEnabled()
            assert.Equal(t, tt.expected, result)
        })
    }
}

func TestGetAsyncPluginEnabled(t *testing.T) {
    tests := []struct {
        name     string
        envValue string
        expected bool
    }{
        {
            name:     "default enabled",
            envValue: "",
            expected: true,
        },
        {
            name:     "disabled with false",
            envValue: "false",
            expected: false,
        },
        {
            name:     "disabled with 0",
            envValue: "0",
            expected: false,
        },
        {
            name:     "enabled with true",
            envValue: "true",
            expected: true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            if tt.envValue != "" {
                os.Setenv("ASYNC_PLUGIN_ENABLED", tt.envValue)
                defer os.Unsetenv("ASYNC_PLUGIN_ENABLED")
            } else {
                os.Unsetenv("ASYNC_PLUGIN_ENABLED")
            }

            result := getAsyncPluginEnabled()
            assert.Equal(t, tt.expected, result)
        })
    }
}

func TestGetEnabledPlugins(t *testing.T) {
    tests := []struct {
        name     string
        envSet   bool
        envValue string
        expected []string
    }{
        {
            name:     "not set returns nil",
            envSet:   false,
            envValue: "",
            expected: nil,
        },
        {
            name:     "empty string returns empty slice",
            envSet:   true,
            envValue: "",
            expected: []string{},
        },
        {
            name:     "single plugin",
            envSet:   true,
            envValue: "plugin1",
            expected: []string{"plugin1"},
        },
        {
            name:     "multiple plugins",
            envSet:   true,
            envValue: "plugin1,plugin2,plugin3",
            expected: []string{"plugin1", "plugin2", "plugin3"},
        },
        {
            name:     "plugins with spaces",
            envSet:   true,
            envValue: "plugin1, plugin2 , plugin3",
            expected: []string{"plugin1", "plugin2", "plugin3"},
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            if tt.envSet {
                os.Setenv("ENABLED_PLUGINS", tt.envValue)
                defer os.Unsetenv("ENABLED_PLUGINS")
            } else {
                os.Unsetenv("ENABLED_PLUGINS")
            }

            result := getEnabledPlugins()
            assert.Equal(t, tt.expected, result)
        })
    }
}

func TestUpdateDefaultConcurrency(t *testing.T) {
    // Setup test config
    cleanup := setupTestConfig(t)
    defer cleanup()

    // Unset CONCURRENCY env var to allow updates
    os.Unsetenv("CONCURRENCY")

    require.NotNil(t, AppConfig)

    // Test updating concurrency with plugins
    initialConcurrency := AppConfig.DefaultConcurrency
    UpdateDefaultConcurrency(10)
    
    // The new concurrency should be calculated based on channels + plugins + 10
    // With default setup, we expect it to change
    assert.NotEqual(t, initialConcurrency, AppConfig.DefaultConcurrency)

    // Test with 0 plugins (plugins disabled)
    UpdateDefaultConcurrency(0)
    expected := len(AppConfig.DefaultChannels) + 0 + 10
    assert.Equal(t, expected, AppConfig.DefaultConcurrency)
}

func TestGetDefaultConcurrency(t *testing.T) {
    tests := []struct {
        name        string
        envValue    string
        expectValid bool
    }{
        {
            name:        "with explicit concurrency",
            envValue:    "20",
            expectValid: true,
        },
        {
            name:        "without explicit concurrency",
            envValue:    "",
            expectValid: true,
        },
        {
            name:        "invalid concurrency falls back",
            envValue:    "invalid",
            expectValid: true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            if tt.envValue != "" {
                os.Setenv("CONCURRENCY", tt.envValue)
                defer os.Unsetenv("CONCURRENCY")
            } else {
                os.Unsetenv("CONCURRENCY")
            }

            result := getDefaultConcurrency()
            if tt.expectValid {
                assert.Greater(t, result, 0)
            }
        })
    }
}
