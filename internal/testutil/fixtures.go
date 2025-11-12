package testutil

import (
    "time"

    "pansou/model"
)

// SampleSearchResult creates a sample SearchResult for testing
func SampleSearchResult(title string) model.SearchResult {
    return model.SearchResult{
        MessageID: "test_msg_123",
        UniqueID:  "test_unique_" + title,
        Channel:   "test_channel",
        Datetime:  time.Now(),
        Title:     title,
        Content:   "Test content for " + title,
        Links: []model.Link{
            {
                Type:     "baidu",
                URL:      "https://pan.baidu.com/s/test123",
                Password: "test",
            },
        },
        Tags:   []string{"test", "sample"},
        Images: []string{},
    }
}

// SampleSearchResultWithLinks creates a search result with custom links
func SampleSearchResultWithLinks(title string, links []model.Link) model.SearchResult {
    result := SampleSearchResult(title)
    result.Links = links
    return result
}

// SampleSearchResultWithChannel creates a search result with a specific channel
func SampleSearchResultWithChannel(title, channel string) model.SearchResult {
    result := SampleSearchResult(title)
    result.Channel = channel
    return result
}

// SampleSearchResultWithDatetime creates a search result with a specific datetime
func SampleSearchResultWithDatetime(title string, datetime time.Time) model.SearchResult {
    result := SampleSearchResult(title)
    result.Datetime = datetime
    return result
}

// SampleSearchResults creates multiple sample search results
func SampleSearchResults(count int) []model.SearchResult {
    results := make([]model.SearchResult, count)
    for i := 0; i < count; i++ {
        results[i] = SampleSearchResult("Test Title " + string(rune('A'+i)))
    }
    return results
}

// SampleLink creates a sample Link for testing
func SampleLink(linkType, url, password string) model.Link {
    return model.Link{
        Type:     linkType,
        URL:      url,
        Password: password,
    }
}

// SampleBaiduLink creates a sample Baidu netdisk link
func SampleBaiduLink() model.Link {
    return model.Link{
        Type:     "baidu",
        URL:      "https://pan.baidu.com/s/test123",
        Password: "abcd",
    }
}

// SampleAliyunLink creates a sample Aliyun netdisk link
func SampleAliyunLink() model.Link {
    return model.Link{
        Type:     "aliyun",
        URL:      "https://www.aliyundrive.com/s/test456",
        Password: "",
    }
}

// SampleQuarkLink creates a sample Quark netdisk link
func SampleQuarkLink() model.Link {
    return model.Link{
        Type:     "quark",
        URL:      "https://pan.quark.cn/s/test789",
        Password: "1234",
    }
}

// SampleMagnetLink creates a sample magnet link
func SampleMagnetLink() model.Link {
    return model.Link{
        Type:     "magnet",
        URL:      "magnet:?xt=urn:btih:test1234567890abcdef",
        Password: "",
    }
}

// SampleSearchResponse creates a sample SearchResponse for testing
func SampleSearchResponse(count int) model.SearchResponse {
    results := SampleSearchResults(count)
    return model.SearchResponse{
        Total:   count,
        Results: results,
    }
}

// SampleSearchResponseWithMerged creates a search response with merged links
func SampleSearchResponseWithMerged() model.SearchResponse {
    mergedLinks := make(model.MergedLinks)
    mergedLinks["baidu"] = []model.MergedLink{
        {
            URL:      "https://pan.baidu.com/s/test1",
            Password: "abcd",
            Note:     "Test file 1",
            Datetime: time.Now(),
            Source:   "tg:test_channel",
        },
        {
            URL:      "https://pan.baidu.com/s/test2",
            Password: "efgh",
            Note:     "Test file 2",
            Datetime: time.Now().Add(-1 * time.Hour),
            Source:   "plugin:test_plugin",
        },
    }
    mergedLinks["aliyun"] = []model.MergedLink{
        {
            URL:      "https://www.aliyundrive.com/s/test3",
            Password: "",
            Note:     "Test file 3",
            Datetime: time.Now(),
            Source:   "tg:test_channel",
        },
    }

    return model.SearchResponse{
        Total:        3,
        MergedByType: mergedLinks,
    }
}

// SamplePluginSearchResult creates a sample PluginSearchResult for testing
func SamplePluginSearchResult(source string, resultCount int, isFinal bool) model.PluginSearchResult {
    results := SampleSearchResults(resultCount)
    return model.PluginSearchResult{
        Results:   results,
        IsFinal:   isFinal,
        Timestamp: time.Now(),
        Source:    source,
        Message:   "Test plugin search result",
    }
}
