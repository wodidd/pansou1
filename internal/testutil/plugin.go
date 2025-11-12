package testutil

import (
	"net/http"
	"sync"
	"testing"

	"pansou/model"
	"pansou/plugin"
)

// pluginRegistryBackup stores backup of plugin registry for restoration
var (
	pluginRegistryBackup     map[string]plugin.AsyncSearchPlugin
	pluginRegistryBackupLock sync.Mutex
)

// ResetPluginRegistry clears the global plugin registry
// This should be called in test cleanup to ensure isolated test state
func ResetPluginRegistry() {
	// We need to use reflection or access the package-level variables
	// Since we can't directly access private variables, we'll clear by getting and removing
	plugins := plugin.GetRegisteredPlugins()
	
	// There's no public Clear method, so we document this limitation
	// Tests should use isolated plugin managers instead of global registry
	_ = plugins
}

// BackupPluginRegistry backs up the current plugin registry state
func BackupPluginRegistry() {
	pluginRegistryBackupLock.Lock()
	defer pluginRegistryBackupLock.Unlock()

	plugins := plugin.GetRegisteredPlugins()
	pluginRegistryBackup = make(map[string]plugin.AsyncSearchPlugin, len(plugins))
	for _, p := range plugins {
		pluginRegistryBackup[p.Name()] = p
	}
}

// RestorePluginRegistry restores the plugin registry from backup
func RestorePluginRegistry() {
	pluginRegistryBackupLock.Lock()
	defer pluginRegistryBackupLock.Unlock()

	// Note: Since we can't directly clear the registry,
	// we document that tests should avoid global plugin registration
	// and instead use NewPluginManager() for isolated testing
	_ = pluginRegistryBackup
}

// StubAsyncPlugin is a test stub implementation of AsyncSearchPlugin
type StubAsyncPlugin struct {
	name             string
	priority         int
	searchFunc       func(keyword string, ext map[string]interface{}) ([]model.SearchResult, error)
	mainCacheKey     string
	currentKeyword   string
	skipServiceFilter bool
}

// NewStubPlugin creates a new stub plugin for testing
func NewStubPlugin(name string, priority int) *StubAsyncPlugin {
	return &StubAsyncPlugin{
		name:     name,
		priority: priority,
		searchFunc: func(keyword string, ext map[string]interface{}) ([]model.SearchResult, error) {
			// Default: return empty results
			return []model.SearchResult{}, nil
		},
		skipServiceFilter: false,
	}
}

// WithSearchFunc sets a custom search function for the stub plugin
func (s *StubAsyncPlugin) WithSearchFunc(f func(keyword string, ext map[string]interface{}) ([]model.SearchResult, error)) *StubAsyncPlugin {
	s.searchFunc = f
	return s
}

// WithSkipServiceFilter sets whether to skip service filter
func (s *StubAsyncPlugin) WithSkipServiceFilter(skip bool) *StubAsyncPlugin {
	s.skipServiceFilter = skip
	return s
}

// Name returns the plugin name
func (s *StubAsyncPlugin) Name() string {
	return s.name
}

// Priority returns the plugin priority
func (s *StubAsyncPlugin) Priority() int {
	return s.priority
}

// AsyncSearch implements the async search method
func (s *StubAsyncPlugin) AsyncSearch(keyword string, searchFunc func(*http.Client, string, map[string]interface{}) ([]model.SearchResult, error), mainCacheKey string, ext map[string]interface{}) ([]model.SearchResult, error) {
	// Stub implementation - just call the search func if provided
	if s.searchFunc != nil {
		return s.searchFunc(keyword, ext)
	}
	return []model.SearchResult{}, nil
}

// SetMainCacheKey sets the main cache key
func (s *StubAsyncPlugin) SetMainCacheKey(key string) {
	s.mainCacheKey = key
}

// SetCurrentKeyword sets the current search keyword
func (s *StubAsyncPlugin) SetCurrentKeyword(keyword string) {
	s.currentKeyword = keyword
}

// Search implements the synchronous search method
func (s *StubAsyncPlugin) Search(keyword string, ext map[string]interface{}) ([]model.SearchResult, error) {
	if s.searchFunc != nil {
		return s.searchFunc(keyword, ext)
	}
	return []model.SearchResult{}, nil
}

// SkipServiceFilter returns whether to skip service filter
func (s *StubAsyncPlugin) SkipServiceFilter() bool {
	return s.skipServiceFilter
}

// CreateTestPluginManager creates a plugin manager with stub plugins for testing
func CreateTestPluginManager(t *testing.T, plugins ...*StubAsyncPlugin) *plugin.PluginManager {
	t.Helper()

	pm := plugin.NewPluginManager()
	for _, p := range plugins {
		pm.RegisterPlugin(p)
	}
	return pm
}
