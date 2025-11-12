package plugin

import (
    "net/http"
    "strings"
    "testing"
    "time"

    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"

    "pansou/model"
)

// Test stub plugin implementation - avoid circular dependency with testutil
type testStubPlugin struct {
    name             string
    priority         int
    searchFunc       func(keyword string, ext map[string]interface{}) ([]model.SearchResult, error)
    skipFilter       bool
}

func newTestStubPlugin(name string, priority int) *testStubPlugin {
    return &testStubPlugin{
        name:     name,
        priority: priority,
        searchFunc: func(keyword string, ext map[string]interface{}) ([]model.SearchResult, error) {
            return []model.SearchResult{}, nil
        },
    }
}

func (s *testStubPlugin) Name() string { return s.name }
func (s *testStubPlugin) Priority() int { return s.priority }
func (s *testStubPlugin) SkipServiceFilter() bool { return s.skipFilter }
func (s *testStubPlugin) SetMainCacheKey(key string) {}
func (s *testStubPlugin) SetCurrentKeyword(keyword string) {}

func (s *testStubPlugin) AsyncSearch(keyword string, searchFunc func(*http.Client, string, map[string]interface{}) ([]model.SearchResult, error), mainCacheKey string, ext map[string]interface{}) ([]model.SearchResult, error) {
    if s.searchFunc != nil {
        return s.searchFunc(keyword, ext)
    }
    return []model.SearchResult{}, nil
}

func (s *testStubPlugin) Search(keyword string, ext map[string]interface{}) ([]model.SearchResult, error) {
    if s.searchFunc != nil {
        return s.searchFunc(keyword, ext)
    }
    return []model.SearchResult{}, nil
}

// Sample test fixtures
func sampleSearchResult(title string) model.SearchResult {
    return model.SearchResult{
        MessageID: "test_msg_" + title,
        UniqueID:  "test_unique_" + title,
        Channel:   "test_channel",
        Datetime:  time.Now(),
        Title:     title,
        Content:   "Test content for " + title,
        Links: []model.Link{
            {Type: "baidu", URL: "https://pan.baidu.com/s/test", Password: "test"},
        },
        Tags: []string{"test"},
    }
}

func TestNewPluginManager(t *testing.T) {
    pm := NewPluginManager()
    
    assert.NotNil(t, pm)
    assert.Empty(t, pm.GetPlugins())
}

func TestPluginManagerRegisterPlugin(t *testing.T) {
    pm := NewPluginManager()
    stubPlugin := newTestStubPlugin("test_plugin", 1)
    
    pm.RegisterPlugin(stubPlugin)
    
    plugins := pm.GetPlugins()
    require.Len(t, plugins, 1)
    assert.Equal(t, "test_plugin", plugins[0].Name())
}

func TestPluginManagerWithMultiplePlugins(t *testing.T) {
    pm := NewPluginManager()
    plugin1 := newTestStubPlugin("plugin1", 1)
    plugin2 := newTestStubPlugin("plugin2", 2)
    plugin3 := newTestStubPlugin("plugin3", 3)
    
    pm.RegisterPlugin(plugin1)
    pm.RegisterPlugin(plugin2)
    pm.RegisterPlugin(plugin3)
    
    plugins := pm.GetPlugins()
    assert.Len(t, plugins, 3)
}

func TestFilterResultsByKeyword(t *testing.T) {
    results := []model.SearchResult{
        sampleSearchResult("Go Programming Tutorial"),
        sampleSearchResult("Python Guide"),
        sampleSearchResult("Go Advanced Patterns"),
        sampleSearchResult("JavaScript Basics"),
    }

    tests := []struct {
        name     string
        keyword  string
        expected int
    }{
        {
            name:     "empty keyword returns all",
            keyword:  "",
            expected: 4,
        },
        {
            name:     "single keyword match",
            keyword:  "Go",
            expected: 2,
        },
        {
            name:     "case insensitive match",
            keyword:  "go",
            expected: 2,
        },
        {
            name:     "multiple keywords",
            keyword:  "Go Programming",
            expected: 1,
        },
        {
            name:     "no match",
            keyword:  "Rust",
            expected: 0,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            filtered := FilterResultsByKeyword(results, tt.keyword)
            assert.Len(t, filtered, tt.expected)
        })
    }
}

func TestFilterResultsByKeywordContent(t *testing.T) {
    // Create results with specific content
    result1 := sampleSearchResult("Title")
    result1.Content = "This contains the keyword Docker in content"
    
    result2 := sampleSearchResult("Docker Tutorial")
    result2.Content = "Different content"
    
    result3 := sampleSearchResult("Unrelated")
    result3.Content = "No match here"
    
    results := []model.SearchResult{result1, result2, result3}
    
    // Filter by keyword that appears in either title or content
    filtered := FilterResultsByKeyword(results, "Docker")
    
    assert.Len(t, filtered, 2)
    
    // Verify the correct results are returned
    foundInTitle := false
    foundInContent := false
    for _, r := range filtered {
        if strings.Contains(r.Title, "Docker") {
            foundInTitle = true
        }
        if strings.Contains(r.Content, "Docker") {
            foundInContent = true
        }
    }
    
    assert.True(t, foundInTitle)
    assert.True(t, foundInContent)
}

func TestFilterResultsByMultipleKeywords(t *testing.T) {
    result1 := sampleSearchResult("Go Programming")
    result1.Content = "Advanced Tutorial"
    
    result2 := sampleSearchResult("Go Advanced")
    result2.Content = "Programming Guide"
    
    result3 := sampleSearchResult("Python")
    result3.Content = "Basic Tutorial"
    
    results := []model.SearchResult{result1, result2, result3}
    
    // Both "Go" and "Advanced" must be present
    filtered := FilterResultsByKeyword(results, "Go Advanced")
    
    assert.Len(t, filtered, 2)
    
    // Verify each result contains both keywords somewhere
    for _, r := range filtered {
        titleLower := strings.ToLower(r.Title)
        contentLower := strings.ToLower(r.Content)
        combined := titleLower + " " + contentLower
        
        assert.True(t, strings.Contains(combined, "go"))
        assert.True(t, strings.Contains(combined, "advanced"))
    }
}

func TestStubPluginBasics(t *testing.T) {
    plugin := newTestStubPlugin("test", 5)
    
    assert.Equal(t, "test", plugin.Name())
    assert.Equal(t, 5, plugin.Priority())
    assert.False(t, plugin.SkipServiceFilter())
    
    // Test SetMainCacheKey and SetCurrentKeyword don't panic
    plugin.SetMainCacheKey("test_cache_key")
    plugin.SetCurrentKeyword("test keyword")
}

func TestStubPluginWithCustomSearchFunc(t *testing.T) {
    expectedResults := []model.SearchResult{
        sampleSearchResult("Result 1"),
        sampleSearchResult("Result 2"),
        sampleSearchResult("Result 3"),
    }
    
    plugin := newTestStubPlugin("custom", 1)
    plugin.searchFunc = func(keyword string, ext map[string]interface{}) ([]model.SearchResult, error) {
        return expectedResults, nil
    }
    
    results, err := plugin.Search("test", nil)
    
    assert.NoError(t, err)
    assert.Len(t, results, 3)
}

func TestStubPluginWithSkipFilter(t *testing.T) {
    plugin := newTestStubPlugin("skip_test", 1)
    plugin.skipFilter = true
    
    assert.True(t, plugin.SkipServiceFilter())
}

func TestCreateTestPluginManager(t *testing.T) {
    plugin1 := newTestStubPlugin("p1", 1)
    plugin2 := newTestStubPlugin("p2", 2)
    
    pm := NewPluginManager()
    pm.RegisterPlugin(plugin1)
    pm.RegisterPlugin(plugin2)
    
    plugins := pm.GetPlugins()
    assert.Len(t, plugins, 2)
}

func TestRegisterGlobalPluginsWithFilter(t *testing.T) {
    // Note: This test works with the actual global registry
    // In a real scenario, we'd want to backup and restore the registry
    
    tests := []struct {
        name           string
        enabledPlugins []string
        description    string
    }{
        {
            name:           "nil plugins",
            enabledPlugins: nil,
            description:    "should not register any plugins",
        },
        {
            name:           "empty plugins",
            enabledPlugins: []string{},
            description:    "should not register any plugins",
        },
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            pm := NewPluginManager()
            pm.RegisterGlobalPluginsWithFilter(tt.enabledPlugins)
            
            // With nil or empty filter, no plugins should be registered
            plugins := pm.GetPlugins()
            assert.Empty(t, plugins)
        })
    }
}
