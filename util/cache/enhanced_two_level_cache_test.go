package cache

import (
	"os"
	"testing"
	"time"
)

func TestEnhancedTwoLevelCacheSetBothLevelsAndGet(t *testing.T) {
	baseDir := t.TempDir()
	configureTestCache(t, baseDir)

	cache, err := NewEnhancedTwoLevelCache()
	if err != nil {
		t.Fatalf("create cache: %v", err)
	}

	key := "roundtrip-key"
	payload := []byte("roundtrip-data")
	ttl := time.Minute

	if err := cache.SetBothLevels(key, payload, ttl); err != nil {
		t.Fatalf("set both levels: %v", err)
	}

	got, hit, err := cache.Get(key)
	if err != nil {
		t.Fatalf("get cache: %v", err)
	}
	if !hit {
		t.Fatalf("expected cache hit")
	}
	if string(got) != string(payload) {
		t.Fatalf("unexpected payload: %q", string(got))
	}

	if !cache.disk.Has(key) {
		t.Fatalf("expected disk cache to have key")
	}
}

func TestEnhancedTwoLevelCacheDiskPersistenceAcrossInstances(t *testing.T) {
	baseDir := t.TempDir()
	configureTestCache(t, baseDir)

	key := "persisted-key"
	payload := []byte("persisted-data")

	first, err := NewEnhancedTwoLevelCache()
	if err != nil {
		t.Fatalf("create cache: %v", err)
	}

	if err := first.SetBothLevels(key, payload, time.Minute); err != nil {
		t.Fatalf("set data: %v", err)
	}

	// Create a fresh instance backed by the same disk directory.
	second, err := NewEnhancedTwoLevelCache()
	if err != nil {
		t.Fatalf("create second cache: %v", err)
	}

	fetched, hit, err := second.Get(key)
	if err != nil {
		t.Fatalf("get from second cache: %v", err)
	}
	if !hit {
		t.Fatalf("expected disk-backed hit on new cache instance")
	}
	if string(fetched) != string(payload) {
		t.Fatalf("unexpected payload from disk: %q", string(fetched))
	}
}

func TestEnhancedTwoLevelCacheSetWithFinalFlag(t *testing.T) {
	baseDir := t.TempDir()
	configureTestCache(t, baseDir)

	cache, err := NewEnhancedTwoLevelCache()
	if err != nil {
		t.Fatalf("create cache: %v", err)
	}

	memKey := "memory-only"
	diskKey := "final-write"
	payload := []byte("payload")

	if err := cache.SetWithFinalFlag(memKey, payload, time.Minute, false); err != nil {
		t.Fatalf("set memory-only: %v", err)
	}

	if _, ok := cache.memory.Get(memKey); !ok {
		t.Fatalf("expected memory cache hit for %s", memKey)
	}
	if cache.disk.Has(memKey) {
		t.Fatalf("expected disk cache miss for memory-only write")
	}

	if err := cache.SetWithFinalFlag(diskKey, payload, time.Minute, true); err != nil {
		t.Fatalf("set final: %v", err)
	}

	if _, ok := cache.memory.Get(diskKey); !ok {
		t.Fatalf("expected memory cache hit for final write")
	}
	if !cache.disk.Has(diskKey) {
		t.Fatalf("expected disk cache hit for final write")
	}
}

func TestEnhancedTwoLevelCacheFlushMemoryToDiskPropagatesError(t *testing.T) {
	baseDir := t.TempDir()
	configureTestCache(t, baseDir)

	cache, err := NewEnhancedTwoLevelCache()
	if err != nil {
		t.Fatalf("create cache: %v", err)
	}

	key := "flush-key"
	payload := []byte("flush-data")

	if err := cache.SetWithFinalFlag(key, payload, time.Minute, false); err != nil {
		t.Fatalf("populate memory: %v", err)
	}

	// Make shard directories read-only so disk writes fail.
	for _, shard := range cache.disk.shards {
		path := shard.path
		if err := os.Chmod(path, 0o500); err != nil {
			t.Fatalf("chmod shard: %v", err)
		}
		t.Cleanup(func() {
			_ = os.Chmod(path, 0o755)
		})
	}

	if err := cache.FlushMemoryToDisk(); err == nil {
		t.Fatalf("expected flush to propagate disk error")
	}
}
