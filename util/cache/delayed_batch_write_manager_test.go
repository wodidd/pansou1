package cache

import (
	"os"
	"reflect"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"pansou/model"
)

func setEnv(t testing.TB, key, value string) {
	t.Helper()
	original, had := os.LookupEnv(key)
	if err := os.Setenv(key, value); err != nil {
		t.Fatalf("set env %s: %v", key, err)
	}
	t.Cleanup(func() {
		if had {
			_ = os.Setenv(key, original)
		} else {
			_ = os.Unsetenv(key)
		}
	})
}

func TestDelayedBatchWriteManagerImmediateStrategyInvokesUpdater(t *testing.T) {
	setEnv(t, "CACHE_WRITE_STRATEGY", "immediate")
	setEnv(t, "BATCH_MAX_INTERVAL", "30s")
	setEnv(t, "BATCH_MAX_SIZE", "10")
	setEnv(t, "BATCH_MAX_DATA_SIZE", "2048")

	manager, err := NewDelayedBatchWriteManager()
	if err != nil {
		t.Fatalf("new manager: %v", err)
	}
	defer manager.Shutdown(time.Second)

	var (
		mu           sync.Mutex
		calls        int
		capturedKey  string
		capturedData []byte
	)

	manager.SetMainCacheUpdater(func(key string, data []byte, ttl time.Duration) error {
		mu.Lock()
		defer mu.Unlock()
		calls++
		capturedKey = key
		capturedData = append(capturedData[:0], data...)
		return nil
	})

	op := &CacheOperation{
		Key:        "immediate-key",
		Data:       sampleSearchResults(1),
		TTL:        time.Minute,
		PluginName: "immediate",
		Keyword:    "instant",
		Timestamp:  time.Now(),
		Priority:   1,
		DataSize:   500,
		IsFinal:    true,
	}

	if err := manager.HandleCacheOperation(op); err != nil {
		t.Fatalf("handle operation: %v", err)
	}

	mu.Lock()
	defer mu.Unlock()
	if calls != 1 {
		t.Fatalf("expected updater call, got %d", calls)
	}
	if capturedKey != op.Key {
		t.Fatalf("unexpected key: %s", capturedKey)
	}

	var decoded []model.SearchResult
	if err := manager.serializer.Deserialize(capturedData, &decoded); err != nil {
		t.Fatalf("deserialize data: %v", err)
	}
	if len(decoded) != len(op.Data) {
		t.Fatalf("expected %d results, got %d", len(op.Data), len(decoded))
	}
}

func TestDelayedBatchWriteManagerHybridStrategyFlushOnShutdown(t *testing.T) {
	setEnv(t, "CACHE_WRITE_STRATEGY", "hybrid")
	setEnv(t, "BATCH_MAX_INTERVAL", "30s")
	setEnv(t, "BATCH_MAX_SIZE", "50")
	setEnv(t, "BATCH_MAX_DATA_SIZE", "4096")

	manager, err := NewDelayedBatchWriteManager()
	if err != nil {
		t.Fatalf("new manager: %v", err)
	}
	manager.stats.LastFlushTime = time.Now()
	defer manager.Shutdown(time.Second)

	var (
		mu    sync.Mutex
		calls []string
	)

	manager.SetMainCacheUpdater(func(key string, data []byte, ttl time.Duration) error {
		mu.Lock()
		defer mu.Unlock()
		calls = append(calls, key)
		return nil
	})

	ops := []*CacheOperation{
		{
			Key:        "hybrid-key-1",
			Data:       sampleSearchResults(1),
			TTL:        time.Minute,
			PluginName: "hybrid",
			Keyword:    "kw1",
			Timestamp:  time.Now(),
			Priority:   3,
			DataSize:   500,
		},
		{
			Key:        "hybrid-key-2",
			Data:       sampleSearchResults(2),
			TTL:        time.Minute,
			PluginName: "hybrid",
			Keyword:    "kw2",
			Timestamp:  time.Now(),
			Priority:   3,
			DataSize:   1000,
		},
	}

	for _, op := range ops {
		if err := manager.HandleCacheOperation(op); err != nil {
			t.Fatalf("handle op: %v", err)
		}
	}

	time.Sleep(50 * time.Millisecond)

	mu.Lock()
	pending := len(calls)
	mu.Unlock()
	if pending != 0 {
		t.Fatalf("expected no writes before shutdown, got %d", pending)
	}

	if err := manager.Shutdown(time.Second); err != nil {
		t.Fatalf("shutdown: %v", err)
	}

	mu.Lock()
	defer mu.Unlock()
	if len(calls) != len(ops) {
		t.Fatalf("expected %d writes, got %d", len(ops), len(calls))
	}
}

func TestDelayedBatchWriteManagerMergesDuplicateKeysAndUpdatesStats(t *testing.T) {
	setEnv(t, "CACHE_WRITE_STRATEGY", "hybrid")
	setEnv(t, "BATCH_MAX_INTERVAL", "30s")
	setEnv(t, "BATCH_MAX_SIZE", "50")
	setEnv(t, "BATCH_MAX_DATA_SIZE", "4096")

	manager, err := NewDelayedBatchWriteManager()
	if err != nil {
		t.Fatalf("new manager: %v", err)
	}
	manager.stats.LastFlushTime = time.Now()
	defer manager.Shutdown(time.Second)

	var (
		mu    sync.Mutex
		calls [][]model.SearchResult
	)

	manager.SetMainCacheUpdater(func(key string, data []byte, ttl time.Duration) error {
		var decoded []model.SearchResult
		if err := manager.serializer.Deserialize(data, &decoded); err != nil {
			return err
		}
		mu.Lock()
		calls = append(calls, decoded)
		mu.Unlock()
		return nil
	})

	op1 := &CacheOperation{
		Key:        "merge-key",
		Data:       sampleSearchResults(1),
		TTL:        time.Minute,
		PluginName: "merge",
		Keyword:    "merge",
		Timestamp:  time.Now(),
		Priority:   3,
		DataSize:   500,
	}
	op2 := &CacheOperation{
		Key:        "merge-key",
		Data:       sampleSearchResults(2),
		TTL:        time.Minute,
		PluginName: "merge",
		Keyword:    "merge",
		Timestamp:  time.Now().Add(time.Millisecond),
		Priority:   3,
		DataSize:   1000,
		IsFinal:    true,
	}

	stop := make(chan struct{})
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		for {
			select {
			case op := <-manager.writeQueue:
				manager.queueMutex.Lock()
				manager.queueBuffer = append(manager.queueBuffer, op)
				manager.queueMutex.Unlock()
				atomic.AddInt32(&manager.stats.CurrentQueueSize, -1)
				wg.Done()
			case <-stop:
				return
			}
		}
	}()

	if err := manager.enqueueForBatchWrite(op1); err != nil {
		t.Fatalf("enqueue op1: %v", err)
	}
	if err := manager.enqueueForBatchWrite(op2); err != nil {
		t.Fatalf("enqueue op2: %v", err)
	}

	wg.Wait()
	close(stop)

	manager.mapMutex.RLock()
	mergedEntries := len(manager.operationMap)
	manager.mapMutex.RUnlock()
	if mergedEntries != 1 {
		t.Fatalf("expected merged map with single entry, got %d", mergedEntries)
	}

	if merged := atomic.LoadInt64(&manager.stats.MergedOperations); merged == 0 {
		t.Fatalf("expected merged operations stat to increase")
	}
	if total := atomic.LoadInt64(&manager.stats.TotalOperations); total < 2 {
		t.Fatalf("expected total operations >= 2, got %d", total)
	}

	manager.queueMutex.Lock()
	if err := manager.executeBatchWrite("测试合并"); err != nil {
		manager.queueMutex.Unlock()
		t.Fatalf("execute batch write: %v", err)
	}
	manager.queueMutex.Unlock()

	mu.Lock()
	if len(calls) != 1 {
		mu.Unlock()
		t.Fatalf("expected single write after merge, got %d", len(calls))
	}
	if !reflect.DeepEqual(calls[0], op2.Data) {
		mu.Unlock()
		t.Fatalf("expected latest data to be written")
	}
	mu.Unlock()

	atomic.StoreInt32(&manager.initialized, 1)
	if err := manager.Shutdown(time.Second); err != nil {
		t.Fatalf("shutdown: %v", err)
	}
}
