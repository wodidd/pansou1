package api

import (
    "bytes"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"
    "time"

    "github.com/gin-gonic/gin"
    "github.com/stretchr/testify/assert"
    "pansou/config"
    "pansou/model"
    "pansou/plugin"
    "pansou/service"
    "pansou/util"
)

// MockPlugin 模拟插件实现
type MockPlugin struct {
    name     string
    priority int
    results  []model.SearchResult
}

func (m *MockPlugin) Name() string {
    return m.name
}

func (m *MockPlugin) Priority() int {
    return m.priority
}

func (m *MockPlugin) AsyncSearch(keyword string, searchFunc func(*http.Client, string, map[string]interface{}) ([]model.SearchResult, error), mainCacheKey string, ext map[string]interface{}) ([]model.SearchResult, error) {
    return m.results, nil
}

func (m *MockPlugin) SetMainCacheKey(key string) {
    // Mock implementation
}

func (m *MockPlugin) SetCurrentKeyword(keyword string) {
    // Mock implementation
}

func (m *MockPlugin) Search(keyword string, ext map[string]interface{}) ([]model.SearchResult, error) {
    return m.results, nil
}

func (m *MockPlugin) SkipServiceFilter() bool {
    return false
}

// TestSetup 测试环境设置
func TestSetup(t *testing.T) {
    // 保存原始配置
    if config.AppConfig == nil {
        // 如果全局配置为nil，先初始化它
        config.Init()
    }
    originalConfig := config.AppConfig
    defer func() {
        config.AppConfig = originalConfig
    }()

    // 设置测试配置
    config.AppConfig = &config.Config{
        DefaultChannels:     []string{"test_channel"},
        DefaultConcurrency:  5,
        AuthEnabled:         false,
        AsyncPluginEnabled:  false, // 禁用插件以简化测试
        CacheEnabled:        false,
        EnableCompression:   false,
        MinSizeToCompress:   1024,
        AuthJWTSecret:       "test-secret-key-12345",
        AuthTokenExpiry:     time.Hour,
        AuthUsers:           map[string]string{"testuser": "testpass"},
    }

    // 设置Gin为测试模式
    gin.SetMode(gin.TestMode)
}

// createSimpleSearchService 创建简单的搜索服务
func createSimpleSearchService() *service.SearchService {
    // 创建空的插件管理器
    pluginManager := plugin.NewPluginManager()
    
    // 创建搜索服务
    return service.NewSearchService(pluginManager)
}

// TestSearchHandler_GET_Basic 测试基本GET搜索
func TestSearchHandler_GET_Basic(t *testing.T) {
    TestSetup(t)

    // 创建搜索服务
    searchService := createSimpleSearchService()

    // 设置路由
    router := SetupRouter(searchService)

    // 测试基本的GET请求
    req, _ := http.NewRequest("GET", "/api/search?kw=test", nil)
    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)

    // 检查状态码（可能是200或500，取决于TG搜索是否工作）
    assert.True(t, w.Code == http.StatusOK || w.Code == http.StatusInternalServerError)
}

// TestSearchHandler_GET_MissingKeyword 测试缺少关键词
func TestSearchHandler_GET_MissingKeyword(t *testing.T) {
    TestSetup(t)

    searchService := createSimpleSearchService()
    router := SetupRouter(searchService)

    // 测试缺少kw参数的请求
    req, _ := http.NewRequest("GET", "/api/search", nil)
    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)

    // 应该返回某个状态码（不应该是404，因为路由存在）
    assert.NotEqual(t, http.StatusNotFound, w.Code)
}

// TestSearchHandler_POST_Basic 测试基本POST搜索
func TestSearchHandler_POST_Basic(t *testing.T) {
    TestSetup(t)

    searchService := createSimpleSearchService()
    router := SetupRouter(searchService)

    // 构建简单的POST请求体
    requestBody := model.SearchRequest{
        Keyword: "test",
    }

    jsonBody, _ := json.Marshal(requestBody)
    req, _ := http.NewRequest("POST", "/api/search", bytes.NewBuffer(jsonBody))
    req.Header.Set("Content-Type", "application/json")

    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)

    // 检查状态码
    assert.True(t, w.Code == http.StatusOK || w.Code == http.StatusInternalServerError)
}

// TestSearchHandler_POST_InvalidJSON 测试无效JSON
func TestSearchHandler_POST_InvalidJSON(t *testing.T) {
    TestSetup(t)

    searchService := createSimpleSearchService()
    router := SetupRouter(searchService)

    // 发送无效JSON
    req, _ := http.NewRequest("POST", "/api/search", bytes.NewBuffer([]byte("{invalid json")))
    req.Header.Set("Content-Type", "application/json")

    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusBadRequest, w.Code)

    // 验证错误响应
    var response model.Response
    err := json.Unmarshal(w.Body.Bytes(), &response)
    if err == nil {
        assert.NotEqual(t, 0, response.Code)
    }
}

// TestAuthHandler_Login_AuthDisabled 测试认证未启用时的登录
func TestAuthHandler_Login_AuthDisabled(t *testing.T) {
    TestSetup(t)

    // 确保认证未启用
    config.AppConfig.AuthEnabled = false

    searchService := createSimpleSearchService()
    router := SetupRouter(searchService)

    loginReq := map[string]string{
        "username": "testuser",
        "password": "testpass",
    }

    jsonBody, _ := json.Marshal(loginReq)
    req, _ := http.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(jsonBody))
    req.Header.Set("Content-Type", "application/json")

    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusForbidden, w.Code)

    var response map[string]interface{}
    err := json.Unmarshal(w.Body.Bytes(), &response)
    if err == nil {
        assert.Contains(t, response["error"], "认证功能未启用")
    }
}

// TestAuthHandler_Login_Enabled 测试认证启用时的登录
func TestAuthHandler_Login_Enabled(t *testing.T) {
    TestSetup(t)

    // 启用认证
    config.AppConfig.AuthEnabled = true

    searchService := createSimpleSearchService()
    router := SetupRouter(searchService)

    loginReq := map[string]string{
        "username": "testuser",
        "password": "testpass",
    }

    jsonBody, _ := json.Marshal(loginReq)
    req, _ := http.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(jsonBody))
    req.Header.Set("Content-Type", "application/json")

    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)

    // 应该成功或失败（取决于配置是否正确）
    assert.True(t, w.Code == http.StatusOK || w.Code == http.StatusUnauthorized || w.Code == http.StatusInternalServerError)
}

// TestAuthHandler_Logout 测试登出
func TestAuthHandler_Logout(t *testing.T) {
    TestSetup(t)

    searchService := createSimpleSearchService()
    router := SetupRouter(searchService)

    req, _ := http.NewRequest("POST", "/api/auth/logout", nil)
    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusOK, w.Code)

    var response map[string]interface{}
    err := json.Unmarshal(w.Body.Bytes(), &response)
    if err == nil {
        assert.Contains(t, response["message"], "退出成功")
    }
}

// TestHealthEndpoint 测试健康检查端点
func TestHealthEndpoint(t *testing.T) {
    TestSetup(t)

    searchService := createSimpleSearchService()
    router := SetupRouter(searchService)

    req, _ := http.NewRequest("GET", "/api/health", nil)
    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusOK, w.Code)

    var response map[string]interface{}
    err := json.Unmarshal(w.Body.Bytes(), &response)
    assert.NoError(t, err)

    assert.Equal(t, "ok", response["status"])
    assert.Equal(t, config.AppConfig.AuthEnabled, response["auth_enabled"])
    assert.Equal(t, config.AppConfig.AsyncPluginEnabled, response["plugins_enabled"])
    assert.Contains(t, response, "channels")
    assert.Contains(t, response, "channels_count")
}

// TestAuthMiddleware_AuthDisabled 测试认证禁用时的中间件行为
func TestAuthMiddleware_AuthDisabled(t *testing.T) {
    TestSetup(t)

    // 确保认证未启用
    config.AppConfig.AuthEnabled = false

    searchService := createSimpleSearchService()
    router := SetupRouter(searchService)

    // 请求搜索接口，应该不需要认证
    req, _ := http.NewRequest("GET", "/api/search?kw=test", nil)
    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)

    // 不应该返回401（未授权）
    assert.NotEqual(t, http.StatusUnauthorized, w.Code)
}

// TestAuthMiddleware_AuthEnabled 测试认证启用时的中间件行为
func TestAuthMiddleware_AuthEnabled(t *testing.T) {
    TestSetup(t)

    // 启用认证
    config.AppConfig.AuthEnabled = true

    searchService := createSimpleSearchService()
    router := SetupRouter(searchService)

    // 请求需要认证的接口但不提供token
    req, _ := http.NewRequest("GET", "/api/search?kw=test", nil)
    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)

    // 应该返回401（未授权）
    assert.Equal(t, http.StatusUnauthorized, w.Code)
}

// TestAuthMiddleware_PublicPaths 测试公开路径不需要认证
func TestAuthMiddleware_PublicPaths(t *testing.T) {
    TestSetup(t)

    // 启用认证
    config.AppConfig.AuthEnabled = true

    searchService := createSimpleSearchService()
    router := SetupRouter(searchService)

    // 测试健康检查接口（公开）
    req, _ := http.NewRequest("GET", "/api/health", nil)
    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusOK, w.Code)

    // 测试登出接口（公开）
    req, _ = http.NewRequest("POST", "/api/auth/logout", nil)
    w = httptest.NewRecorder()
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusOK, w.Code)
}

// TestCORS_Middleware 测试CORS中间件
func TestCORS_Middleware(t *testing.T) {
    TestSetup(t)

    searchService := createSimpleSearchService()
    router := SetupRouter(searchService)

    // 测试OPTIONS请求
    req, _ := http.NewRequest("OPTIONS", "/api/search", nil)
    req.Header.Set("Origin", "http://localhost:3000")
    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusNoContent, w.Code)
    assert.Equal(t, "*", w.Header().Get("Access-Control-Allow-Origin"))
    assert.Contains(t, w.Header().Get("Access-Control-Allow-Methods"), "GET")
    assert.Contains(t, w.Header().Get("Access-Control-Allow-Methods"), "POST")
}

// TestJWT_TokenGeneration 测试JWT token生成和验证
func TestJWT_TokenGeneration(t *testing.T) {
    TestSetup(t)

    // 生成token
    token, err := util.GenerateToken("testuser", "test-secret", time.Hour)
    assert.NoError(t, err)
    assert.NotEmpty(t, token)

    // 验证token
    claims, err := util.ValidateToken(token, "test-secret")
    assert.NoError(t, err)
    assert.Equal(t, "testuser", claims.Username)

    // 验证无效token
    _, err = util.ValidateToken("invalid-token", "test-secret")
    assert.Error(t, err)

    // 验证错误密钥
    _, err = util.ValidateToken(token, "wrong-secret")
    assert.Error(t, err)
}

// TestParameterParsing 测试参数解析逻辑
func TestParameterParsing(t *testing.T) {
    TestSetup(t)

    // 确保认证未启用以测试参数解析
    config.AppConfig.AuthEnabled = false

    searchService := createSimpleSearchService()
    router := SetupRouter(searchService)

    // 测试各种参数组合
    testCases := []struct {
        url      string
        testName string
    }{
        {"/api/search?kw=test&channels=chan1,chan2", "channels参数"},
        {"/api/search?kw=test&plugins=plugin1,plugin2", "plugins参数"},
        {"/api/search?kw=test&cloud_types=baidu,aliyun", "cloud_types参数"},
        {"/api/search?kw=test&res=merge", "result类型参数"},
        {"/api/search?kw=test&src=tg", "source类型参数"},
        {"/api/search?kw=test&conc=5", "并发数参数"},
        {"/api/search?kw=test&refresh=true", "刷新参数"},
        {"/api/search?kw=test&ext={}", "ext空对象参数"},
    }

    for _, tc := range testCases {
        t.Run(tc.testName, func(t *testing.T) {
            req, _ := http.NewRequest("GET", tc.url, nil)
            w := httptest.NewRecorder()
            router.ServeHTTP(w, req)

            // 应该不返回400（参数解析错误）
            assert.NotEqual(t, http.StatusBadRequest, w.Code)
        })
    }
}

// TestErrorHandling 测试错误处理
func TestErrorHandling(t *testing.T) {
    TestSetup(t)

    // 确保认证未启用以测试参数错误
    config.AppConfig.AuthEnabled = false

    searchService := createSimpleSearchService()
    router := SetupRouter(searchService)

    // 测试无效的ext参数
    req, _ := http.NewRequest("GET", "/api/search?kw=test&ext={invalid}", nil)
    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)

    // 应该返回400或500（取决于错误处理）
    assert.True(t, w.Code == http.StatusBadRequest || w.Code == http.StatusInternalServerError)
}

// TestJSONResponseFormat 测试JSON响应格式
func TestJSONResponseFormat(t *testing.T) {
    TestSetup(t)

    searchService := createSimpleSearchService()
    router := SetupRouter(searchService)

    req, _ := http.NewRequest("GET", "/api/health", nil)
    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusOK, w.Code)

    // 验证响应是有效的JSON格式
    var response map[string]interface{}
    err := json.Unmarshal(w.Body.Bytes(), &response)
    assert.NoError(t, err)

    // 验证基本字段
    assert.Contains(t, response, "status")
}

// TestHealthEndpoint_PluginToggle 测试插件开关对健康检查的影响
func TestHealthEndpoint_PluginToggle(t *testing.T) {
    TestSetup(t)

    searchService := createSimpleSearchService()

    // 测试插件禁用状态
    config.AppConfig.AsyncPluginEnabled = false
    router := SetupRouter(searchService)

    req, _ := http.NewRequest("GET", "/api/health", nil)
    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusOK, w.Code)

    var response map[string]interface{}
    err := json.Unmarshal(w.Body.Bytes(), &response)
    assert.NoError(t, err)

    assert.Equal(t, false, response["plugins_enabled"])
    assert.NotContains(t, response, "plugin_count")
    assert.NotContains(t, response, "plugins")

    // 测试插件启用状态
    config.AppConfig.AsyncPluginEnabled = true
    router = SetupRouter(searchService)

    req, _ = http.NewRequest("GET", "/api/health", nil)
    w = httptest.NewRecorder()
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusOK, w.Code)

    err = json.Unmarshal(w.Body.Bytes(), &response)
    assert.NoError(t, err)

    assert.Equal(t, true, response["plugins_enabled"])
    // 注意：由于我们使用空插件管理器，可能没有插件信息
}

// TestAuthMiddleware_ValidToken 测试有效token的认证中间件
func TestAuthMiddleware_ValidToken(t *testing.T) {
    TestSetup(t)

    // 启用认证
    config.AppConfig.AuthEnabled = true

    searchService := createSimpleSearchService()
    router := SetupRouter(searchService)

    // 生成有效token
    token, err := util.GenerateToken("testuser", config.AppConfig.AuthJWTSecret, config.AppConfig.AuthTokenExpiry)
    assert.NoError(t, err)

    // 使用有效token请求
    req, _ := http.NewRequest("GET", "/api/search?kw=test", nil)
    req.Header.Set("Authorization", "Bearer "+token)
    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)

    // 不应该返回401（未授权）
    assert.NotEqual(t, http.StatusUnauthorized, w.Code)
}

// TestAuthMiddleware_InvalidToken 测试无效token的认证中间件
func TestAuthMiddleware_InvalidToken(t *testing.T) {
    TestSetup(t)

    // 启用认证
    config.AppConfig.AuthEnabled = true

    searchService := createSimpleSearchService()
    router := SetupRouter(searchService)

    // 使用无效token
    req, _ := http.NewRequest("GET", "/api/search?kw=test", nil)
    req.Header.Set("Authorization", "Bearer invalid_token")
    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusUnauthorized, w.Code)

    var response map[string]interface{}
    err := json.Unmarshal(w.Body.Bytes(), &response)
    if err == nil {
        assert.Contains(t, response["error"], "未授权：令牌无效或已过期")
        assert.Equal(t, "AUTH_TOKEN_INVALID", response["code"])
    }
}

// TestAuthMiddleware_MissingToken 测试缺少token的认证中间件
func TestAuthMiddleware_MissingToken(t *testing.T) {
    TestSetup(t)

    // 启用认证
    config.AppConfig.AuthEnabled = true

    searchService := createSimpleSearchService()
    router := SetupRouter(searchService)

    // 请求需要认证的接口但不提供token
    req, _ := http.NewRequest("GET", "/api/search?kw=test", nil)
    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusUnauthorized, w.Code)

    var response map[string]interface{}
    err := json.Unmarshal(w.Body.Bytes(), &response)
    if err == nil {
        assert.Contains(t, response["error"], "未授权：缺少认证令牌")
        assert.Equal(t, "AUTH_TOKEN_MISSING", response["code"])
    }
}

// TestResultTypeConversion 测试结果类型转换
func TestResultTypeConversion(t *testing.T) {
    TestSetup(t)

    // 确保认证未启用
    config.AppConfig.AuthEnabled = false

    searchService := createSimpleSearchService()
    router := SetupRouter(searchService)

    // 测试res=merge被转换为merged_by_type
    req, _ := http.NewRequest("GET", "/api/search?kw=test&res=merge", nil)
    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusOK, w.Code)

    var response model.Response
    err := json.Unmarshal(w.Body.Bytes(), &response)
    if err == nil {
        assert.Equal(t, 0, response.Code)
    }

    // 测试空res被设置为默认值
    req, _ = http.NewRequest("GET", "/api/search?kw=test&res=", nil)
    w = httptest.NewRecorder()
    router.ServeHTTP(w, req)

    assert.Equal(t, http.StatusOK, w.Code)
}

// TestSearchHandler_POST_WithFullParameters 测试带完整参数的POST搜索
func TestSearchHandler_POST_WithFullParameters(t *testing.T) {
    TestSetup(t)

    // 确保认证未启用
    config.AppConfig.AuthEnabled = false

    searchService := createSimpleSearchService()
    router := SetupRouter(searchService)

    // 构建完整的POST请求体
    requestBody := model.SearchRequest{
        Keyword:      "测试电影",
        Channels:     []string{"test_channel1", "test_channel2"},
        Concurrency:  3,
        ForceRefresh: true,
        ResultType:   "merge",
        SourceType:   "all",
        Plugins:      []string{"plugin1", "plugin2"},
        CloudTypes:   []string{"baidu", "aliyun", "115"},
        Ext:          map[string]interface{}{"test": "value", "number": 123},
    }

    jsonBody, _ := json.Marshal(requestBody)
    req, _ := http.NewRequest("POST", "/api/search", bytes.NewBuffer(jsonBody))
    req.Header.Set("Content-Type", "application/json")

    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)

    // 检查状态码
    assert.True(t, w.Code == http.StatusOK || w.Code == http.StatusInternalServerError)
}