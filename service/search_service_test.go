package service

import (
    "testing"
    "time"

    "pansou/model"
)

// TestNormalizeUrl tests the normalizeUrl function
func TestNormalizeUrl(t *testing.T) {
    tests := []struct {
        name     string
        input    string
        expected string
    }{
        {
            name:     "Plain URL",
            input:    "https://example.com/file.txt",
            expected: "https://example.com/file.txt",
        },
        {
            name:     "URL with encoded Chinese",
            input:    "https://example.com/%E4%B8%AD%E6%96%87%E6%96%87%E4%BB%B6.txt",
            expected: "https://example.com/中文文件.txt",
        },
        {
            name:     "URL with mixed encoding",
            input:    "https://example.com/test%20%E4%B8%AD%E6%96%87.txt",
            expected: "https://example.com/test 中文.txt",
        },
        {
            name:     "Invalid encoded URL",
            input:    "https://example.com/%ZZ%E4%B8%AD.txt",
            expected: "https://example.com/%ZZ%E4%B8%AD.txt",
        },
        {
            name:     "Empty URL",
            input:    "",
            expected: "",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := normalizeUrl(tt.input)
            if result != tt.expected {
                t.Errorf("normalizeUrl() = %v, want %v", result, tt.expected)
            }
        })
    }
}

// TestMergeSearchResults tests the mergeSearchResults function
func TestMergeSearchResults(t *testing.T) {
    now := time.Now()
    
    // Helper to create test results
    createResult := func(uniqueID, title string, datetime time.Time, links []model.Link) model.SearchResult {
        return model.SearchResult{
            UniqueID: uniqueID,
            Title:     title,
            Datetime:  datetime,
            Links:     links,
            Content:   "test content",
        }
    }

    tests := []struct {
        name       string
        existing   []model.SearchResult
        newResults []model.SearchResult
        expected   []model.SearchResult
    }{
        {
            name:       "Empty existing and new",
            existing:   []model.SearchResult{},
            newResults: []model.SearchResult{},
            expected:   []model.SearchResult{},
        },
        {
            name:     "Only existing results",
            existing: []model.SearchResult{
                createResult("id1", "Title 1", now.Add(-1*time.Hour), []model.Link{{URL: "https://example.com/1"}}),
            },
            newResults: []model.SearchResult{},
            expected: []model.SearchResult{
                createResult("id1", "Title 1", now.Add(-1*time.Hour), []model.Link{{URL: "https://example.com/1"}}),
            },
        },
        {
            name:     "Only new results",
            existing: []model.SearchResult{},
            newResults: []model.SearchResult{
                createResult("id2", "Title 2", now.Add(-30*time.Minute), []model.Link{{URL: "https://example.com/2"}}),
            },
            expected: []model.SearchResult{
                createResult("id2", "Title 2", now.Add(-30*time.Minute), []model.Link{{URL: "https://example.com/2"}}),
            },
        },
        {
            name: "Different unique IDs - should keep both",
            existing: []model.SearchResult{
                createResult("id1", "Title 1", now.Add(-1*time.Hour), []model.Link{{URL: "https://example.com/1"}}),
            },
            newResults: []model.SearchResult{
                createResult("id2", "Title 2", now.Add(-30*time.Minute), []model.Link{{URL: "https://example.com/2"}}),
            },
            expected: []model.SearchResult{
                createResult("id2", "Title 2", now.Add(-30*time.Minute), []model.Link{{URL: "https://example.com/2"}}),
                createResult("id1", "Title 1", now.Add(-1*time.Hour), []model.Link{{URL: "https://example.com/1"}}),
            },
        },
        {
            name: "Same unique ID - should choose better result",
            existing: []model.SearchResult{
                createResult("id1", "Title 1", now.Add(-1*time.Hour), []model.Link{{URL: "https://example.com/1"}}),
            },
            newResults: []model.SearchResult{
                createResult("id1", "Title 1 Enhanced", now.Add(-30*time.Minute), []model.Link{{URL: "https://example.com/1"}, {URL: "https://example.com/extra"}}),
            },
            expected: []model.SearchResult{
                createResult("id1", "Title 1 Enhanced", now.Add(-30*time.Minute), []model.Link{{URL: "https://example.com/1"}, {URL: "https://example.com/extra"}}),
            },
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := mergeSearchResults(tt.existing, tt.newResults)
            
            if len(result) != len(tt.expected) {
                t.Errorf("mergeSearchResults() returned %d results, expected %d", len(result), len(tt.expected))
                return
            }
            
            for i, expectedResult := range tt.expected {
                if result[i].UniqueID != expectedResult.UniqueID {
                    t.Errorf("mergeSearchResults()[%d].UniqueID = %v, want %v", i, result[i].UniqueID, expectedResult.UniqueID)
                }
                if result[i].Title != expectedResult.Title {
                    t.Errorf("mergeSearchResults()[%d].Title = %v, want %v", i, result[i].Title, expectedResult.Title)
                }
            }
        })
    }
}

// TestSelectBetterResult tests the selectBetterResult function
func TestSelectBetterResult(t *testing.T) {
    tests := []struct {
        name     string
        existing model.SearchResult
        new      model.SearchResult
        expected model.SearchResult
    }{
        {
            name: "New result has higher completeness score",
            existing: model.SearchResult{
                Title:    "Simple Title",
                Content:  "",
                Links:    []model.Link{},
            },
            new: model.SearchResult{
                Title:    "Enhanced Title",
                Content:  "Detailed content",
                Links:    []model.Link{{URL: "https://example.com/file"}},
            },
            expected: model.SearchResult{
                Title:    "Enhanced Title",
                Content:  "Detailed content",
                Links:    []model.Link{{URL: "https://example.com/file"}},
            },
        },
        {
            name: "Existing result has higher completeness score",
            existing: model.SearchResult{
                UniqueID: "existing-id",
                Title:    "Complete Title",
                Content:  "Detailed content",
                Links:    []model.Link{{URL: "https://example.com/file1"}, {URL: "https://example.com/file2"}},
            },
            new: model.SearchResult{
                Title:   "Simple Title",
                Content: "",
                Links:   []model.Link{},
            },
            expected: model.SearchResult{
                UniqueID: "existing-id",
                Title:    "Complete Title",
                Content:  "Detailed content",
                Links:    []model.Link{{URL: "https://example.com/file1"}, {URL: "https://example.com/file2"}},
            },
        },
        {
            name: "Equal scores - should keep existing",
            existing: model.SearchResult{
                Title:   "Title A",
                Content: "Content A",
            },
            new: model.SearchResult{
                Title:   "Title B",
                Content: "Content B",
            },
            expected: model.SearchResult{
                Title:   "Title A",
                Content: "Content A",
            },
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := selectBetterResult(tt.existing, tt.new)
            
            if result.Title != tt.expected.Title {
                t.Errorf("selectBetterResult().Title = %v, want %v", result.Title, tt.expected.Title)
            }
            if result.Content != tt.expected.Content {
                t.Errorf("selectBetterResult().Content = %v, want %v", result.Content, tt.expected.Content)
            }
            if len(result.Links) != len(tt.expected.Links) {
                t.Errorf("selectBetterResult().Links length = %v, want %v", len(result.Links), len(tt.expected.Links))
            }
        })
    }
}

// TestCalculateCompletenessScore tests the calculateCompletenessScore function
func TestCalculateCompletenessScore(t *testing.T) {
    tests := []struct {
        name     string
        result   model.SearchResult
        expected int
    }{
        {
            name: "Empty result",
            result: model.SearchResult{},
            expected: 0,
        },
        {
            name: "Only title",
            result: model.SearchResult{
                Title: "Simple Title",
            },
            expected: 1, // len("Simple Title") / 10 = 1
        },
        {
            name: "Title with UniqueID",
            result: model.SearchResult{
                UniqueID: "test-id-123",
                Title:    "Test Title",
            },
            expected: 11, // 10 (UniqueID) + 1 (title length)
        },
        {
            name: "Complete result",
            result: model.SearchResult{
                UniqueID: "test-id-123",
                Title:    "Complete Test Title With More Details",
                Content:  "This is detailed content for the search result",
                Links:    []model.Link{{URL: "https://example.com/file1"}, {URL: "https://example.com/file2"}},
                Channel:  "test-channel",
                Tags:     []string{"tag1", "tag2"},
            },
            expected: 27, // 10 (UniqueID) + 5 (links) + 2 (links count) + 3 (content) + 4 (title length) + 2 (channel) + 2 (tags)
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := calculateCompletenessScore(tt.result)
            if result != tt.expected {
                t.Errorf("calculateCompletenessScore() = %v, want %v", result, tt.expected)
            }
        })
    }
}

// TestGetKeywordPriority tests the getKeywordPriority function
func TestGetKeywordPriority(t *testing.T) {
    tests := []struct {
        name     string
        title    string
        expected int
    }{
        {
            name:     "No priority keywords",
            title:    "Regular Movie Title",
            expected: 0,
        },
        {
            name:     "Contains '合集'",
            title:    "电影合集 2023",
            expected: 490, // (7 - 0) * 70 = 490
        },
        {
            name:     "Contains '系列'",
            title:    "电视剧系列完整版",
            expected: 420, // (7 - 1) * 70 = 420
        },
        {
            name:     "Contains '全'",
            title:    "全集完整版",
            expected: 350, // (7 - 2) * 70 = 350
        },
        {
            name:     "Contains '完'",
            title:    "已完结动漫",
            expected: 280, // (7 - 3) * 70 = 280
        },
        {
            name:     "Contains '最新'",
            title:    "最新更新章节",
            expected: 210, // (7 - 4) * 70 = 210
        },
        {
            name:     "Contains '附'",
            title:    "附带资源下载",
            expected: 140, // (7 - 5) * 70 = 140
        },
        {
            name:     "Contains 'complete' (lowercase)",
            title:    "Complete Collection",
            expected: 70,  // (7 - 6) * 70 = 70
        },
        {
            name:     "Multiple priority keywords - should use highest",
            title:    "合集系列全集",
            expected: 490, // Should use '合集' priority
        },
        {
            name:     "Case insensitive test",
            title:    "MOVIE合集",
            expected: 490,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := getKeywordPriority(tt.title)
            if result != tt.expected {
                t.Errorf("getKeywordPriority() = %v, want %v", result, tt.expected)
            }
        })
    }
}

// TestSortResultsByTimeAndKeywords tests the sortResultsByTimeAndKeywords function
func TestSortResultsByTimeAndKeywords(t *testing.T) {
    now := time.Now()
    
    // Helper to create test results
    createResult := func(uniqueID, title string, datetime time.Time, source string) model.SearchResult {
        result := model.SearchResult{
            UniqueID: uniqueID,
            Title:     title,
            Datetime:  datetime,
            Content:   "test content",
        }
        
        // Set UniqueID to reflect source for testing
        if source != "" {
            result.UniqueID = source + "-" + uniqueID
        } else {
            result.Channel = "test-channel"
        }
        
        return result
    }

    tests := []struct {
        name     string
        results  []model.SearchResult
        expected []string // Expected order of UniqueIDs
    }{
        {
            name:     "Empty results",
            results:  []model.SearchResult{},
            expected: []string{},
        },
        {
            name: "Sort by time only",
            results: []model.SearchResult{
                createResult("id1", "Old Movie", now.Add(-24*time.Hour), "plugin1"),
                createResult("id2", "New Movie", now.Add(-1*time.Hour), "plugin1"),
                createResult("id3", "Medium Movie", now.Add(-12*time.Hour), "plugin1"),
            },
            expected: []string{"plugin1-id2", "plugin1-id3", "plugin1-id1"},
        },
        {
            name: "Priority keywords should rank higher",
            results: []model.SearchResult{
                createResult("id1", "Regular Movie", now.Add(-1*time.Hour), "plugin1"),
                createResult("id2", "Movie合集", now.Add(-24*time.Hour), "plugin1"), // Priority keyword
                createResult("id3", "New Movie", now.Add(-2*time.Hour), "plugin1"),
            },
            expected: []string{"plugin1-id2", "plugin1-id1", "plugin1-id3"},
        },
        {
            name: "Mixed sources and priorities",
            results: []model.SearchResult{
                createResult("id1", "Regular Movie", now.Add(-1*time.Hour), "plugin3"), // Level 3 plugin
                createResult("id2", "Movie合集", now.Add(-24*time.Hour), "plugin1"),     // Priority keyword + Level 1 plugin
                createResult("id3", "New Movie", now.Add(-2*time.Hour), "tg"),           // TG source
            },
            expected: []string{"plugin1-id2", "plugin3-id1", "tg-id3"}, // All same level, sorted by time
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Make a copy to avoid modifying the original
            results := make([]model.SearchResult, len(tt.results))
            copy(results, tt.results)
            
            sortResultsByTimeAndKeywords(results)
            
            if len(results) != len(tt.expected) {
                t.Errorf("sortResultsByTimeAndKeywords() returned %d results, expected %d", len(results), len(tt.expected))
                return
            }
            
            for i, expectedID := range tt.expected {
                if results[i].UniqueID != expectedID {
                    t.Errorf("sortResultsByTimeAndKeywords()[%d].UniqueID = %v, want %v", i, results[i].UniqueID, expectedID)
                }
            }
        })
    }
}

// TestFilterResponseByType tests the filterResponseByType function
func TestFilterResponseByType(t *testing.T) {
    now := time.Now()
    
    // Helper to create test response
    createResponse := func() model.SearchResponse {
        return model.SearchResponse{
            Total: 5,
            Results: []model.SearchResult{
                {
                    UniqueID: "result1",
                    Title:    "Result 1",
                    Datetime: now,
                    Links:    []model.Link{{URL: "https://example.com/1", Type: "baidu"}},
                },
                {
                    UniqueID: "result2",
                    Title:    "Result 2",
                    Datetime: now,
                    Links:    []model.Link{{URL: "https://example.com/2", Type: "aliyun"}},
                },
            },
            MergedByType: model.MergedLinks{
                "baidu": []model.MergedLink{
                    {URL: "https://example.com/1", Note: "Result 1"},
                },
                "aliyun": []model.MergedLink{
                    {URL: "https://example.com/2", Note: "Result 2"},
                },
            },
        }
    }

    tests := []struct {
        name       string
        resultType string
        wantTotal  int
        wantResults bool
        wantMerged bool
    }{
        {
            name:       "all type",
            resultType: "all",
            wantTotal:  5, // As set in createResponse
            wantResults: true,
            wantMerged: true,
        },
        {
            name:       "results type",
            resultType: "results",
            wantTotal:  5, // As set in createResponse
            wantResults: true,
            wantMerged: false,
        },
        {
            name:       "merged_by_type type",
            resultType: "merged_by_type",
            wantTotal:  2, // Sum of all merged links (1 baidu + 1 aliyun)
            wantResults: false,
            wantMerged: true,
        },
        {
            name:       "default type (should behave like merged_by_type)",
            resultType: "unknown",
            wantTotal:  2, // Sum of all merged links (1 baidu + 1 aliyun)
            wantResults: false,
            wantMerged: true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            response := createResponse()
            result := filterResponseByType(response, tt.resultType)
            
            if result.Total != tt.wantTotal {
                t.Errorf("filterResponseByType().Total = %v, want %v", result.Total, tt.wantTotal)
            }
            
            hasResults := result.Results != nil && len(result.Results) > 0
            if hasResults != tt.wantResults {
                t.Errorf("filterResponseByType().Results presence = %v, want %v", hasResults, tt.wantResults)
            }
            
            hasMerged := result.MergedByType != nil && len(result.MergedByType) > 0
            if hasMerged != tt.wantMerged {
                t.Errorf("filterResponseByType().MergedByType presence = %v, want %v", hasMerged, tt.wantMerged)
            }
        })
    }
}

// TestGenerateResultKey tests the generateResultKey function
func TestGenerateResultKey(t *testing.T) {
    tests := []struct {
        name     string
        result   model.SearchResult
        expected string
    }{
        {
            name: "Result with UniqueID",
            result: model.SearchResult{
                UniqueID: "test-unique-id-123",
                Title:    "Test Title",
            },
            expected: "test-unique-id-123",
        },
        {
            name: "Result with MessageID but no UniqueID",
            result: model.SearchResult{
                MessageID: "msg-123",
                Title:     "Test Title",
            },
            expected: "msg-123",
        },
        {
            name: "Result with neither UniqueID nor MessageID",
            result: model.SearchResult{
                Title:   "Test Title",
                Channel: "test-channel",
            },
            expected: "title_Test Title_test-channel",
        },
        {
            name: "Empty result",
            result: model.SearchResult{},
            expected: "title__",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := generateResultKey(tt.result)
            if result != tt.expected {
                t.Errorf("generateResultKey() = %v, want %v", result, tt.expected)
            }
        })
    }
}