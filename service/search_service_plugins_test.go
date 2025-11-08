package service

import (
    "fmt"
    "net/http"
    "testing"
    "time"

    "pansou/model"
    "pansou/plugin"
)

// StubAsyncPlugin is a test implementation of AsyncSearchPlugin
type StubAsyncPlugin struct {
    name           string
    priority       int
    skipFilter     bool
    results        []model.SearchResult
    searchError    error
    asyncSearchErr error
}

// NewStubAsyncPlugin creates a new stub plugin for testing
func NewStubAsyncPlugin(name string, priority int, skipFilter bool, results []model.SearchResult) *StubAsyncPlugin {
    return &StubAsyncPlugin{
        name:       name,
        priority:   priority,
        skipFilter: skipFilter,
        results:    results,
    }
}

// WithError sets the error to be returned by Search and AsyncSearch
func (p *StubAsyncPlugin) WithError(err error) *StubAsyncPlugin {
    p.searchError = err
    p.asyncSearchErr = err
    return p
}

// WithAsyncSearchError sets the error to be returned only by AsyncSearch
func (p *StubAsyncPlugin) WithAsyncSearchError(err error) *StubAsyncPlugin {
    p.asyncSearchErr = err
    return p
}

// Name returns the plugin name
func (p *StubAsyncPlugin) Name() string {
    return p.name
}

// Priority returns the plugin priority
func (p *StubAsyncPlugin) Priority() int {
    return p.priority
}

// AsyncSearch implements the AsyncSearchPlugin interface
func (p *StubAsyncPlugin) AsyncSearch(keyword string, searchFunc func(*http.Client, string, map[string]interface{}) ([]model.SearchResult, error), mainCacheKey string, ext map[string]interface{}) ([]model.SearchResult, error) {
    if p.asyncSearchErr != nil {
        return nil, p.asyncSearchErr
    }
    
    // For testing, we can either use provided results or call the search function
    if len(p.results) > 0 {
        return p.results, nil
    }
    
    // Call the provided search function if no predefined results
    if searchFunc != nil {
        return searchFunc(&http.Client{}, keyword, ext)
    }
    
    return []model.SearchResult{}, nil
}

// SetMainCacheKey sets the main cache key (no-op for stub)
func (p *StubAsyncPlugin) SetMainCacheKey(key string) {
    // No-op for testing
}

// SetCurrentKeyword sets the current keyword (no-op for stub)
func (p *StubAsyncPlugin) SetCurrentKeyword(keyword string) {
    // No-op for testing
}

// Search implements the Search method
func (p *StubAsyncPlugin) Search(keyword string, ext map[string]interface{}) ([]model.SearchResult, error) {
    if p.searchError != nil {
        return nil, p.searchError
    }
    return p.results, nil
}

// SkipServiceFilter returns whether to skip service layer filtering
func (p *StubAsyncPlugin) SkipServiceFilter() bool {
    return p.skipFilter
}

// TestPluginManager tests the plugin manager functionality
func TestPluginManager(t *testing.T) {
    WithTestState(t, func() {

    t.Run("NewPluginManager creates empty manager", func(t *testing.T) {
        pm := plugin.NewPluginManager()
        if pm == nil {
            t.Fatal("NewPluginManager() returned nil")
        }
        
        plugins := pm.GetPlugins()
        if len(plugins) != 0 {
            t.Errorf("Expected 0 plugins, got %d", len(plugins))
        }
    })

    t.Run("RegisterPlugin adds plugin to manager", func(t *testing.T) {
        pm := plugin.NewPluginManager()
        stubPlugin := NewStubAsyncPlugin("test-plugin", 1, false, []model.SearchResult{})
        
        pm.RegisterPlugin(stubPlugin)
        
        plugins := pm.GetPlugins()
        if len(plugins) != 1 {
            t.Errorf("Expected 1 plugin, got %d", len(plugins))
        }
        
        if plugins[0].Name() != "test-plugin" {
            t.Errorf("Expected plugin name 'test-plugin', got '%s'", plugins[0].Name())
        }
    })

    t.Run("RegisterAllGlobalPlugins registers all global plugins", func(t *testing.T) {
        // Register some global plugins
        stub1 := NewStubAsyncPlugin("global-plugin-1", 1, false, []model.SearchResult{})
        stub2 := NewStubAsyncPlugin("global-plugin-2", 2, false, []model.SearchResult{})

        plugin.RegisterGlobalPlugin(stub1)
        plugin.RegisterGlobalPlugin(stub2)

        pm := plugin.NewPluginManager()
        pm.RegisterAllGlobalPlugins()

        plugins := pm.GetPlugins()
        if len(plugins) != 2 {
            t.Errorf("Expected 2 plugins, got %d", len(plugins))
        }
    })

    t.Run("RegisterGlobalPluginsWithFilter filters plugins", func(t *testing.T) {
        // Register some global plugins
        stub1 := NewStubAsyncPlugin("enabled-plugin", 1, false, []model.SearchResult{})
        stub2 := NewStubAsyncPlugin("disabled-plugin", 2, false, []model.SearchResult{})
        
        plugin.RegisterGlobalPlugin(stub1)
        plugin.RegisterGlobalPlugin(stub2)
        
        pm := plugin.NewPluginManager()
        pm.RegisterGlobalPluginsWithFilter([]string{"enabled-plugin"})
        
        plugins := pm.GetPlugins()
        if len(plugins) != 1 {
            t.Errorf("Expected 1 plugin, got %d", len(plugins))
        }
        
        if plugins[0].Name() != "enabled-plugin" {
            t.Errorf("Expected plugin name 'enabled-plugin', got '%s'", plugins[0].Name())
        }
    })
    })
}

// TestFilterResultsByKeyword tests the global FilterResultsByKeyword function
func TestFilterResultsByKeyword(t *testing.T) {
    now := time.Now()
    
    // Helper to create test results
    createResult := func(title, content string) model.SearchResult {
        return model.SearchResult{
            Title:     title,
            Content:   content,
            Datetime:  now,
            Links:     []model.Link{{URL: "https://example.com/test"}},
        }
    }

    tests := []struct {
        name     string
        results  []model.SearchResult
        keyword  string
        expected []model.SearchResult
    }{
        {
            name:     "Empty keyword returns all results",
            results:  []model.SearchResult{createResult("Test Movie", "Content")},
            keyword:  "",
            expected: []model.SearchResult{createResult("Test Movie", "Content")},
        },
        {
            name:     "Keyword matches title",
            results:  []model.SearchResult{createResult("Action Movie", "Content")},
            keyword:  "action",
            expected: []model.SearchResult{createResult("Action Movie", "Content")},
        },
        {
            name:     "Keyword matches content",
            results:  []model.SearchResult{createResult("Movie Title", "action movie content")},
            keyword:  "action",
            expected: []model.SearchResult{createResult("Movie Title", "action movie content")},
        },
        {
            name:     "Keyword matches neither title nor content",
            results:  []model.SearchResult{createResult("Comedy Movie", "funny content")},
            keyword:  "action",
            expected: []model.SearchResult{},
        },
        {
            name: "Multiple keywords - all must match",
            results: []model.SearchResult{
                createResult("Action Movie", "thriller content"),
                createResult("Action Thriller Movie", "movie content"),
                createResult("Comedy Movie", "funny content"),
            },
            keyword: "action movie",
            expected: []model.SearchResult{
                createResult("Action Movie", "thriller content"),
                createResult("Action Thriller Movie", "movie content"),
            },
        },
        {
            name: "Case insensitive matching",
            results: []model.SearchResult{
                createResult("ACTION Movie", "Content"),
                createResult("Action MOVIE", "Content"),
            },
            keyword: "action movie",
            expected: []model.SearchResult{
                createResult("ACTION Movie", "Content"),
                createResult("Action MOVIE", "Content"),
            },
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := plugin.FilterResultsByKeyword(tt.results, tt.keyword)
            
            if len(result) != len(tt.expected) {
                t.Errorf("FilterResultsByKeyword() returned %d results, expected %d", len(result), len(tt.expected))
                return
            }
            
            for i, expectedResult := range tt.expected {
                if result[i].Title != expectedResult.Title {
                    t.Errorf("FilterResultsByKeyword()[%d].Title = %v, want %v", i, result[i].Title, expectedResult.Title)
                }
            }
        })
    }
}

// TestSearchServiceWithStubPlugins tests the SearchService with stub plugins
func TestSearchServiceWithStubPlugins(t *testing.T) {
    WithTestState(t, func() {

    now := time.Now()
    
    // Helper to create test search results
    createPluginResult := func(pluginName, title string, linkType string) model.SearchResult {
        return model.SearchResult{
            UniqueID: pluginName + "-123",
            Title:    title,
            Content:  "test content for " + title,
            Datetime: now,
            Links:    []model.Link{{URL: "https://example.com/" + title, Type: linkType}},
        }
    }

    t.Run("SearchService with plugin source only", func(t *testing.T) {
        // Create stub plugins
        stubResults := []model.SearchResult{
            createPluginResult("testplugin", "Movie合集", "baidu"),
            createPluginResult("testplugin", "Regular Movie", "aliyun"),
        }
        
        stubPlugin := NewStubAsyncPlugin("testplugin", 1, false, stubResults)
        
        // Create plugin manager and register stub plugin
        pm := plugin.NewPluginManager()
        pm.RegisterPlugin(stubPlugin)
        
        // Create search service
        ss := NewSearchService(pm)
        
        // Test search with plugin source
        response, err := ss.Search("movie", []string{}, 1, false, "all", "plugin", []string{"testplugin"}, []string{}, map[string]interface{}{})
        
        if err != nil {
            t.Fatalf("Search() returned error: %v", err)
        }
        
        // Should have merged links
        if response.MergedByType == nil {
            t.Error("Expected MergedByType to be populated")
        }
        
        // Check that cloud types filtering works
        responseFiltered, err := ss.Search("movie", []string{}, 1, false, "all", "plugin", []string{"testplugin"}, []string{"baidu"}, map[string]interface{}{})
        
        if err != nil {
            t.Fatalf("Filtered Search() returned error: %v", err)
        }
        
        // Should only have baidu links
        if responseFiltered.MergedByType["baidu"] == nil || len(responseFiltered.MergedByType["baidu"]) == 0 {
            t.Error("Expected baidu links in filtered response")
        }
        
        if responseFiltered.MergedByType["aliyun"] != nil && len(responseFiltered.MergedByType["aliyun"]) > 0 {
            t.Error("Did not expect aliyun links in filtered response")
        }
    })

    t.Run("SearchService with resultType combinations", func(t *testing.T) {
        // Create stub plugin
        stubResults := []model.SearchResult{
            createPluginResult("testplugin", "Movie合集", "baidu"),
        }
        
        stubPlugin := NewStubAsyncPlugin("testplugin", 1, false, stubResults)
        
        pm := plugin.NewPluginManager()
        pm.RegisterPlugin(stubPlugin)
        
        ss := NewSearchService(pm)
        
        // Test different result types
        t.Run("resultType=all", func(t *testing.T) {
            response, err := ss.Search("movie", []string{}, 1, false, "all", "plugin", []string{"testplugin"}, []string{}, map[string]interface{}{})
            
            if err != nil {
                t.Fatalf("Search() returned error: %v", err)
            }
            
            if response.Results == nil {
                t.Error("Expected Results to be populated for resultType=all")
            }
            
            if response.MergedByType == nil {
                t.Error("Expected MergedByType to be populated for resultType=all")
            }
        })
        
        t.Run("resultType=results", func(t *testing.T) {
            response, err := ss.Search("movie", []string{}, 1, false, "results", "plugin", []string{"testplugin"}, []string{}, map[string]interface{}{})
            
            if err != nil {
                t.Fatalf("Search() returned error: %v", err)
            }
            
            if response.Results == nil {
                t.Error("Expected Results to be populated for resultType=results")
            }
            
            if response.MergedByType != nil && len(response.MergedByType) > 0 {
                t.Error("Expected MergedByType to be empty for resultType=results")
            }
        })
        
        t.Run("resultType=merged_by_type", func(t *testing.T) {
            response, err := ss.Search("movie", []string{}, 1, false, "merged_by_type", "plugin", []string{"testplugin"}, []string{}, map[string]interface{}{})
            
            if err != nil {
                t.Fatalf("Search() returned error: %v", err)
            }
            
            if response.Results != nil && len(response.Results) > 0 {
                t.Error("Expected Results to be empty for resultType=merged_by_type")
            }
            
            if response.MergedByType == nil {
                t.Error("Expected MergedByType to be populated for resultType=merged_by_type")
            }
        })
    })

    t.Run("SearchService with plugin selection by name", func(t *testing.T) {
        // Create multiple stub plugins
        stub1 := NewStubAsyncPlugin("plugin1", 1, false, []model.SearchResult{
            createPluginResult("plugin1", "Movie from plugin1", "baidu"),
        })
        
        stub2 := NewStubAsyncPlugin("plugin2", 2, false, []model.SearchResult{
            createPluginResult("plugin2", "Movie from plugin2", "aliyun"),
        })
        
        pm := plugin.NewPluginManager()
        pm.RegisterPlugin(stub1)
        pm.RegisterPlugin(stub2)
        
        ss := NewSearchService(pm)
        
        // Test searching with specific plugin
        response, err := ss.Search("movie", []string{}, 1, false, "all", "plugin", []string{"plugin1"}, []string{}, map[string]interface{}{})
        
        if err != nil {
            t.Fatalf("Search() returned error: %v", err)
        }
        
        // Should only have results from plugin1
        if response.MergedByType["baidu"] == nil || len(response.MergedByType["baidu"]) == 0 {
            t.Error("Expected baidu links from plugin1")
        }
        
        if response.MergedByType["aliyun"] != nil && len(response.MergedByType["aliyun"]) > 0 {
            t.Error("Did not expect aliyun links from plugin2 when only plugin1 was requested")
        }
    })

    t.Run("SearchService with concurrency handling", func(t *testing.T) {
        // Create multiple stub plugins to test concurrency
        var plugins []*StubAsyncPlugin
        for i := 0; i < 5; i++ {
            pluginName := fmt.Sprintf("concurrent-plugin-%d", i)
            results := []model.SearchResult{
                createPluginResult(pluginName, fmt.Sprintf("Movie %d", i), "baidu"),
            }
            plugins = append(plugins, NewStubAsyncPlugin(pluginName, 1, false, results))
        }
        
        pm := plugin.NewPluginManager()
        for _, p := range plugins {
            pm.RegisterPlugin(p)
        }
        
        ss := NewSearchService(pm)
        
        // Test with different concurrency levels
        for concurrency := 1; concurrency <= 3; concurrency++ {
            // Use unique keyword for each concurrency level to avoid cache interference
            keyword := fmt.Sprintf("movie-concurrency-%d", concurrency)
            response, err := ss.Search(keyword, []string{}, concurrency, false, "all", "plugin", nil, []string{}, map[string]interface{}{})
            
            if err != nil {
                t.Fatalf("Search() with concurrency %d returned error: %v", concurrency, err)
            }
            
            // Should have results from all plugins
            if response.MergedByType["baidu"] == nil {
                t.Errorf("Expected baidu links for concurrency %d", concurrency)
            }
            
            expectedCount := 5 // 5 plugins
            actualCount := len(response.MergedByType["baidu"])
            if actualCount != expectedCount {
                t.Errorf("Expected %d links for concurrency %d, got %d", expectedCount, concurrency, actualCount)
            }
        }
    })
    })
}

// TestGlobalStateIsolation tests that global state is properly isolated
func TestGlobalStateIsolation(t *testing.T) {
    WithTestState(t, func() {
        // This test verifies that running tests in different orders doesn't affect results
        // by running the same test logic multiple times
        
        for i := 0; i < 3; i++ {
            t.Run(fmt.Sprintf("IsolationTest_%d", i), func(t *testing.T) {
                // Create a unique plugin for this iteration
                pluginName := fmt.Sprintf("isolation-test-%d", i)
                stubPlugin := NewStubAsyncPlugin(pluginName, 1, false, []model.SearchResult{
                    {
                        UniqueID: pluginName + "-123",
                        Title:    fmt.Sprintf("Test Movie %d", i),
                        Datetime:  time.Now(),
                        Links:     []model.Link{{URL: "https://example.com/test", Type: "baidu"}},
                    },
                })
                
                pm := plugin.NewPluginManager()
                pm.RegisterPlugin(stubPlugin)
                
                ss := NewSearchService(pm)
                
                // Use unique keyword for each iteration to avoid cache interference
                keyword := fmt.Sprintf("test-isolation-%d", i)
                response, err := ss.Search(keyword, []string{}, 1, false, "all", "plugin", []string{pluginName}, []string{}, map[string]interface{}{})
                
                if err != nil {
                    t.Fatalf("Search() returned error: %v", err)
                }
                
                // Verify we get exactly what we expect for this iteration
                if response.MergedByType["baidu"] == nil || len(response.MergedByType["baidu"]) != 1 {
                    t.Errorf("Expected 1 baidu link for iteration %d, got %d", i, len(response.MergedByType["baidu"]))
                }
                
                if len(response.MergedByType["baidu"]) > 0 && response.MergedByType["baidu"][0].Note != fmt.Sprintf("Test Movie %d", i) {
                    t.Errorf("Expected note 'Test Movie %d' for iteration %d, got '%s'", i, i, response.MergedByType["baidu"][0].Note)
                }
            })
        }
    })
}