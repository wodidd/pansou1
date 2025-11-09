package cache

import (
	"os"
	"reflect"
	"strconv"
	"testing"
	"time"

	"pansou/config"
	"pansou/model"
)

func configureTestCache(t testing.TB, baseDir string) {
	t.Helper()
	if err := os.MkdirAll(baseDir, 0o755); err != nil {
		t.Fatalf("failed to create cache dir: %v", err)
	}
	config.AppConfig = &config.Config{
		CacheEnabled:    true,
		CachePath:       baseDir,
		CacheMaxSizeMB:  32,
		CacheTTLMinutes: 60,
	}
	t.Cleanup(func() {
		config.AppConfig = nil
	})
}

func sampleSearchResult(id int) model.SearchResult {
	ts := time.Date(2024, time.January, id%28+1, id%24, id%60, 0, 0, time.UTC)
	return model.SearchResult{
		MessageID: "msg" + strconv.Itoa(id),
		UniqueID:  "uid" + strconv.Itoa(id),
		Channel:   "channel" + strconv.Itoa(id%3),
		Datetime:  ts,
		Title:     "Title " + strconv.Itoa(id),
		Content:   "Content for result " + strconv.Itoa(id),
		Links:     []model.Link{{Type: "cloud", URL: "https://example.com/" + strconv.Itoa(id), Password: "pwd"}},
		Tags:      []string{"tag" + strconv.Itoa(id)},
		Images:    []string{"https://img.example.com/" + strconv.Itoa(id)},
	}
}

func sampleSearchResults(n int) []model.SearchResult {
	results := make([]model.SearchResult, 0, n)
	for i := 0; i < n; i++ {
		results = append(results, sampleSearchResult(i+1))
	}
	return results
}

func assertSerializerRoundTrip[T any](t testing.TB, serializer Serializer, value T) {
	t.Helper()
	data, err := serializer.Serialize(value)
	if err != nil {
		t.Fatalf("serialize failed: %v", err)
	}
	if len(data) == 0 {
		t.Fatalf("serialize produced empty payload")
	}
	var decoded T
	if err := serializer.Deserialize(data, &decoded); err != nil {
		t.Fatalf("deserialize failed: %v", err)
	}
	if !reflect.DeepEqual(value, decoded) {
		t.Fatalf("roundtrip mismatch: %+v vs %+v", value, decoded)
	}
}
