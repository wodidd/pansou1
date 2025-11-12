package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestNewSuccessResponse(t *testing.T) {
	data := map[string]string{"key": "value"}
	resp := NewSuccessResponse(data)

	assert.Equal(t, 0, resp.Code)
	assert.Equal(t, "success", resp.Message)
	assert.Equal(t, data, resp.Data)
}

func TestNewErrorResponse(t *testing.T) {
	resp := NewErrorResponse(400, "bad request")

	assert.Equal(t, 400, resp.Code)
	assert.Equal(t, "bad request", resp.Message)
	assert.Nil(t, resp.Data)
}

func TestSearchResult(t *testing.T) {
	now := time.Now()
	result := SearchResult{
		MessageID: "msg123",
		UniqueID:  "unique123",
		Channel:   "test_channel",
		Datetime:  now,
		Title:     "Test Title",
		Content:   "Test Content",
		Links: []Link{
			{Type: "baidu", URL: "https://pan.baidu.com/s/test", Password: "1234"},
		},
		Tags:   []string{"tag1", "tag2"},
		Images: []string{"image1.jpg"},
	}

	assert.Equal(t, "msg123", result.MessageID)
	assert.Equal(t, "unique123", result.UniqueID)
	assert.Equal(t, "test_channel", result.Channel)
	assert.Equal(t, now, result.Datetime)
	assert.Equal(t, "Test Title", result.Title)
	assert.Equal(t, "Test Content", result.Content)
	assert.Len(t, result.Links, 1)
	assert.Equal(t, "baidu", result.Links[0].Type)
	assert.Len(t, result.Tags, 2)
	assert.Len(t, result.Images, 1)
}

func TestLink(t *testing.T) {
	link := Link{
		Type:     "aliyun",
		URL:      "https://www.aliyundrive.com/s/test",
		Password: "password",
	}

	assert.Equal(t, "aliyun", link.Type)
	assert.Equal(t, "https://www.aliyundrive.com/s/test", link.URL)
	assert.Equal(t, "password", link.Password)
}

func TestMergedLink(t *testing.T) {
	now := time.Now()
	merged := MergedLink{
		URL:      "https://pan.baidu.com/s/test",
		Password: "1234",
		Note:     "Test Note",
		Datetime: now,
		Source:   "tg:channel1",
		Images:   []string{"img1.jpg", "img2.jpg"},
	}

	assert.Equal(t, "https://pan.baidu.com/s/test", merged.URL)
	assert.Equal(t, "1234", merged.Password)
	assert.Equal(t, "Test Note", merged.Note)
	assert.Equal(t, now, merged.Datetime)
	assert.Equal(t, "tg:channel1", merged.Source)
	assert.Len(t, merged.Images, 2)
}

func TestSearchResponse(t *testing.T) {
	results := []SearchResult{
		{
			MessageID: "msg1",
			Title:     "Title 1",
		},
		{
			MessageID: "msg2",
			Title:     "Title 2",
		},
	}

	response := SearchResponse{
		Total:   2,
		Results: results,
	}

	assert.Equal(t, 2, response.Total)
	assert.Len(t, response.Results, 2)
	assert.Equal(t, "msg1", response.Results[0].MessageID)
	assert.Equal(t, "msg2", response.Results[1].MessageID)
}

func TestSearchResponseWithMergedLinks(t *testing.T) {
	mergedLinks := make(MergedLinks)
	mergedLinks["baidu"] = []MergedLink{
		{URL: "url1", Password: "pass1"},
		{URL: "url2", Password: "pass2"},
	}
	mergedLinks["aliyun"] = []MergedLink{
		{URL: "url3", Password: "pass3"},
	}

	response := SearchResponse{
		Total:        3,
		MergedByType: mergedLinks,
	}

	assert.Equal(t, 3, response.Total)
	assert.Len(t, response.MergedByType, 2)
	assert.Len(t, response.MergedByType["baidu"], 2)
	assert.Len(t, response.MergedByType["aliyun"], 1)
}
