package service

import (
	"net/http"
	"reflect"
	"sync"
	"testing"
	"time"

	"pansou/model"
	"pansou/plugin"
	"pansou/util/cache"
)

type fakeBatchManager struct {
	mu         sync.Mutex
	operations []*cache.CacheOperation
	updater    func(string, []byte, time.Duration) error
}

type stubAsyncPlugin struct {
	name     string
	priority int
}

func (f *fakeBatchManager) SetMainCacheUpdater(fn func(string, []byte, time.Duration) error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.updater = fn
}

func (f *fakeBatchManager) Initialize() error {
	return nil
}

func (f *fakeBatchManager) HandleCacheOperation(op *cache.CacheOperation) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	clone := *op
	clone.Data = append([]model.SearchResult(nil), op.Data...)
	f.operations = append(f.operations, &clone)
	return nil
}

func (f *fakeBatchManager) Shutdown(time.Duration) error {
	return nil
}

func (f *fakeBatchManager) GetStats() map[string]interface{} {
	return map[string]interface{}{}
}

func (p *stubAsyncPlugin) Name() string { return p.name }

func (p *stubAsyncPlugin) Priority() int { return p.priority }

func (p *stubAsyncPlugin) AsyncSearch(keyword string, searchFunc func(*http.Client, string, map[string]interface{}) ([]model.SearchResult, error), mainCacheKey string, ext map[string]interface{}) ([]model.SearchResult, error) {
	return nil, nil
}

func (p *stubAsyncPlugin) SetMainCacheKey(string) {}

func (p *stubAsyncPlugin) SetCurrentKeyword(string) {}

func (p *stubAsyncPlugin) Search(string, map[string]interface{}) ([]model.SearchResult, error) {
	return nil, nil
}

func (p *stubAsyncPlugin) SkipServiceFilter() bool { return false }

func newFakeBatchManager() *fakeBatchManager {
	return &fakeBatchManager{}
}

func TestCacheWriteIntegrationHandleCacheWriteForwardsOperation(t *testing.T) {
	pluginName := "fake-plugin"
	priority := 2
	plugin.RegisterGlobalPlugin(&stubAsyncPlugin{name: pluginName, priority: priority})

	fakeManager := newFakeBatchManager()
	integration := &CacheWriteIntegration{
		batchManager: fakeManager,
		initialized:  true,
	}
	fakeManager.SetMainCacheUpdater(integration.createMainCacheUpdater())

	results := []model.SearchResult{
		{MessageID: "1", Title: "first"},
		{MessageID: "2", Title: "second"},
	}

	ttl := 2 * time.Minute
	key := "cache-key"
	keyword := "search-term"

	if err := integration.HandleCacheWrite(key, results, ttl, true, keyword, pluginName); err != nil {
		t.Fatalf("handle cache write: %v", err)
	}

	fakeManager.mu.Lock()
	defer fakeManager.mu.Unlock()

	if len(fakeManager.operations) != 1 {
		t.Fatalf("expected one operation, got %d", len(fakeManager.operations))
	}

	op := fakeManager.operations[0]
	if op.PluginName != pluginName {
		t.Fatalf("unexpected plugin name: %s", op.PluginName)
	}
	if op.Keyword != keyword {
		t.Fatalf("unexpected keyword: %s", op.Keyword)
	}
	if op.Priority != priority {
		t.Fatalf("expected priority %d, got %d", priority, op.Priority)
	}
	expectedSize := len(results) * 500
	if op.DataSize != expectedSize {
		t.Fatalf("expected data size %d, got %d", expectedSize, op.DataSize)
	}
	if !op.IsFinal {
		t.Fatalf("expected operation to be final")
	}
	if op.TTL != ttl {
		t.Fatalf("unexpected ttl: %v", op.TTL)
	}
	if !reflect.DeepEqual(op.Data, results) {
		t.Fatalf("results mismatch")
	}
}

func TestCacheWriteIntegrationHandleCacheWriteUsesDefaultPriority(t *testing.T) {
	fakeManager := newFakeBatchManager()
	integration := &CacheWriteIntegration{
		batchManager: fakeManager,
		initialized:  true,
	}
	fakeManager.SetMainCacheUpdater(integration.createMainCacheUpdater())

	results := []model.SearchResult{{MessageID: "1"}}
	key := "default-priority"
	ttl := time.Minute
	keyword := "term"
	missingPlugin := "missing-plugin"

	if err := integration.HandleCacheWrite(key, results, ttl, false, keyword, missingPlugin); err != nil {
		t.Fatalf("handle cache write: %v", err)
	}

	fakeManager.mu.Lock()
	defer fakeManager.mu.Unlock()

	if len(fakeManager.operations) != 1 {
		t.Fatalf("expected one operation, got %d", len(fakeManager.operations))
	}

	op := fakeManager.operations[0]
	if op.Priority != 4 {
		t.Fatalf("expected default priority 4, got %d", op.Priority)
	}
	if op.PluginName != missingPlugin {
		t.Fatalf("unexpected plugin name: %s", op.PluginName)
	}
	if op.IsFinal {
		t.Fatalf("expected non-final operation")
	}
}
