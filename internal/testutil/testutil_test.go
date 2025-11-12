package testutil

import (
    "os"
    "testing"

    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"

    "pansou/model"
)

// TestSetupTestConfig verifies that test config setup works correctly
func TestSetupTestConfig(t *testing.T) {
    tc, cleanup := SetupTestConfig(t)
    defer cleanup()

    assert.NotNil(t, tc)
    assert.NotEmpty(t, tc.TempCacheDir)
    assert.DirExists(t, tc.TempCacheDir)
}

// TestSampleSearchResult verifies sample fixture creation
func TestSampleSearchResult(t *testing.T) {
    result := SampleSearchResult("Test Title")

    assert.Equal(t, "Test Title", result.Title)
    assert.Equal(t, "test_channel", result.Channel)
    assert.NotEmpty(t, result.Links)
    assert.False(t, result.Datetime.IsZero())
}

// TestSampleSearchResults verifies batch fixture creation
func TestSampleSearchResults(t *testing.T) {
    results := SampleSearchResults(5)

    require.Len(t, results, 5)
    for i, result := range results {
        assert.NotEmpty(t, result.Title)
        assert.NotEmpty(t, result.UniqueID)
        // Verify each result has a unique title
        if i > 0 {
            assert.NotEqual(t, results[i-1].Title, result.Title)
        }
    }
}

// TestStubPlugin verifies stub plugin functionality
func TestStubPlugin(t *testing.T) {
    plugin := NewStubPlugin("test_plugin", 1)

    assert.Equal(t, "test_plugin", plugin.Name())
    assert.Equal(t, 1, plugin.Priority())
    assert.False(t, plugin.SkipServiceFilter())

    // Test with custom settings
    customPlugin := NewStubPlugin("custom", 2).
        WithSkipServiceFilter(true)

    assert.True(t, customPlugin.SkipServiceFilter())
}

// TestCreateTestPluginManager verifies plugin manager creation
func TestCreateTestPluginManager(t *testing.T) {
    plugin1 := NewStubPlugin("plugin1", 1)
    plugin2 := NewStubPlugin("plugin2", 2)

    pm := CreateTestPluginManager(t, plugin1, plugin2)

    plugins := pm.GetPlugins()
    require.Len(t, plugins, 2)
}

// TestSampleLinks verifies link fixture creation
func TestSampleLinks(t *testing.T) {
    tests := []struct {
        name     string
        linkFunc func() model.Link
        linkType string
    }{
        {"Baidu", SampleBaiduLink, "baidu"},
        {"Aliyun", SampleAliyunLink, "aliyun"},
        {"Quark", SampleQuarkLink, "quark"},
        {"Magnet", SampleMagnetLink, "magnet"},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            link := tt.linkFunc()
            assert.Equal(t, tt.linkType, link.Type)
            assert.NotEmpty(t, link.URL)
        })
    }
}

// TestWithCustomEnv verifies environment variable management
func TestWithCustomEnv(t *testing.T) {
    // Set a test value
    testKey := "TEST_VAR_12345"
    testValue := "test_value"

    // Ensure the key doesn't exist before the test
    os.Unsetenv(testKey)

    restore := WithCustomEnv(map[string]string{
        testKey: testValue,
    })

    // Verify it was set
    assert.Equal(t, testValue, os.Getenv(testKey))

    // Call restore and verify it was cleared
    restore()
    
    // Check that the key was unset
    _, exists := os.LookupEnv(testKey)
    assert.False(t, exists, "Environment variable should be unset after restore")
}

// TestSampleSearchResponse verifies response fixture creation
func TestSampleSearchResponse(t *testing.T) {
    resp := SampleSearchResponse(3)

    assert.Equal(t, 3, resp.Total)
    assert.Len(t, resp.Results, 3)
}

// TestSampleSearchResponseWithMerged verifies merged response creation
func TestSampleSearchResponseWithMerged(t *testing.T) {
    resp := SampleSearchResponseWithMerged()

    assert.Equal(t, 3, resp.Total)
    assert.NotNil(t, resp.MergedByType)
    assert.Contains(t, resp.MergedByType, "baidu")
    assert.Contains(t, resp.MergedByType, "aliyun")
    assert.Len(t, resp.MergedByType["baidu"], 2)
    assert.Len(t, resp.MergedByType["aliyun"], 1)
}
