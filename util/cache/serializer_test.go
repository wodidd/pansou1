package cache

import (
	"testing"
	"time"

	"pansou/model"
)

func TestGobSerializerRoundTripSearchResults(t *testing.T) {
	t.Parallel()

	serializer := NewGobSerializer()
	results := sampleSearchResults(3)

	assertSerializerRoundTrip(t, serializer, results)
}

func TestGobSerializerRoundTripSearchResponse(t *testing.T) {
	t.Parallel()

	serializer := NewGobSerializer()
	response := model.SearchResponse{
		Total:   2,
		Results: sampleSearchResults(2),
		MergedByType: model.MergedLinks{
			"cloud": []model.MergedLink{
				{
					URL:      "https://example.com/resource",
					Password: "pwd",
					Note:     "note",
					Datetime: time.Date(2024, time.March, 1, 8, 0, 0, 0, time.UTC),
					Source:   "plugin:test",
					Images:   []string{"https://img.example.com/1"},
				},
			},
		},
	}

	assertSerializerRoundTrip(t, serializer, response)
}
