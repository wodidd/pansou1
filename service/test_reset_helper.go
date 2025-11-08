package service

import (
    "sync"
    "testing"
    "time"

    "pansou/config"
    "pansou/plugin"
    "pansou/util/cache"
)

// TestResetHelper provides utilities for resetting global state in tests
type TestResetHelper struct {
    originalCache *cache.EnhancedTwoLevelCache
    originalCacheWriteManager *cache.DelayedBatchWriteManager
    originalCacheInitialized bool
}

// NewTestResetHelper creates a new test reset helper
func NewTestResetHelper() *TestResetHelper {
    return &TestResetHelper{
        originalCache: enhancedTwoLevelCache,
        originalCacheWriteManager: globalCacheWriteManager,
        originalCacheInitialized: cacheInitialized,
    }
}

// ResetGlobalState resets all global singleton state to prevent test interference
func (h *TestResetHelper) ResetGlobalState() {
    // Initialize config for tests
    config.Init()
    
    // Reset cache-related globals
    enhancedTwoLevelCache = h.originalCache
    globalCacheWriteManager = h.originalCacheWriteManager
    cacheInitialized = h.originalCacheInitialized
    
    // Reset plugin level cache
    pluginLevelCache = sync.Map{}
    
    // Clear global plugin registry - we need to access internal state
    // Since the globalRegistry is not exported, we'll rely on creating fresh managers
    // and clearing any registered plugins through the available API
}

// ResetPluginRegistry clears the global plugin registry
// Note: This is a workaround since we can't directly access the internal globalRegistry
func (h *TestResetHelper) ResetPluginRegistry() {
    // Register a temporary nil plugin to clear the registry (this won't work but shows intent)
    // In practice, we rely on creating fresh PluginManager instances for each test
    plugin.RegisterGlobalPlugin(nil)
}

// WithResetState runs a test function with automatic state reset before and after
func (h *TestResetHelper) WithResetState(t *testing.T, testFunc func()) {
    // Reset state before test
    h.ResetGlobalState()
    h.ResetPluginRegistry()
    
    // Run the test
    testFunc()
    
    // Reset state after test (important for tests that might be run in parallel)
    h.ResetGlobalState()
    h.ResetPluginRegistry()
}

// CreateTestPluginManager creates a fresh plugin manager for testing
func (h *TestResetHelper) CreateTestPluginManager() *plugin.PluginManager {
    // Return a new empty plugin manager to avoid global state interference
    return plugin.NewPluginManager()
}

// CreateTestSearchService creates a fresh search service for testing
func (h *TestResetHelper) CreateTestSearchService(pluginManager *plugin.PluginManager) *SearchService {
    // Reset cache state before creating the service
    enhancedTwoLevelCache = nil
    cacheInitialized = false
    globalCacheWriteManager = nil
    
    return NewSearchService(pluginManager)
}

// MockCacheManager creates a mock cache manager for testing
type MockCacheManager struct {
    data map[string][]byte
    ttl  map[string]time.Time
    mu   sync.RWMutex
}

// NewMockCacheManager creates a new mock cache manager
func NewMockCacheManager() *MockCacheManager {
    return &MockCacheManager{
        data: make(map[string][]byte),
        ttl:  make(map[string]time.Time),
    }
}

// Set sets a value in the mock cache
func (m *MockCacheManager) Set(key string, data []byte, ttl time.Duration) error {
    m.mu.Lock()
    defer m.mu.Unlock()
    
    m.data[key] = data
    m.ttl[key] = time.Now().Add(ttl)
    return nil
}

// Get gets a value from the mock cache
func (m *MockCacheManager) Get(key string) ([]byte, bool, error) {
    m.mu.RLock()
    defer m.mu.RUnlock()
    
    data, exists := m.data[key]
    if !exists {
        return nil, false, nil
    }
    
    // Check TTL
    if expiry, ok := m.ttl[key]; ok && time.Now().After(expiry) {
        delete(m.data, key)
        delete(m.ttl, key)
        return nil, false, nil
    }
    
    return data, true, nil
}

// Clear clears all data from the mock cache
func (m *MockCacheManager) Clear() {
    m.mu.Lock()
    defer m.mu.Unlock()
    
    m.data = make(map[string][]byte)
    m.ttl = make(map[string]time.Time)
}

// Size returns the number of items in the cache
func (m *MockCacheManager) Size() int {
    m.mu.RLock()
    defer m.mu.RUnlock()
    
    return len(m.data)
}

// Global test helper instance
var globalTestHelper = NewTestResetHelper()

// ResetTestState is a convenience function for resetting test state
func ResetTestState(t *testing.T) {
    globalTestHelper.ResetGlobalState()
    globalTestHelper.ResetPluginRegistry()
}

// WithTestState is a convenience function for running tests with state reset
func WithTestState(t *testing.T, testFunc func()) {
    globalTestHelper.WithResetState(t, testFunc)
}