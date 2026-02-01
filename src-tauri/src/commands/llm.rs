use crate::services::config::{is_local_llm_base_url, normalize_base_url_for_openai_api, ApiKeysConfig};
use crate::services::AppState;
use super::file_ops::ApiResponse;
use serde::{Deserialize, Serialize};
use tauri::{State, AppHandle, Manager, Emitter};
use futures::StreamExt;

/// Get the API key for the current provider, checking user-saved keys first
fn get_effective_api_key(config_api_key: Option<String>, base_url: &str) -> Option<String> {
    let keys = ApiKeysConfig::load();

    // Determine provider from base URL
    let url_lower = base_url.to_lowercase();
    let provider = if url_lower.contains("openrouter") {
        "openrouter"
    } else if url_lower.contains("openai.com") {
        "openai"
    } else if url_lower.contains("anthropic") {
        "anthropic"
    } else if url_lower.contains("generativelanguage.googleapis.com") || url_lower.contains("google") {
        "google"
    } else if url_lower.contains("groq") {
        "groq"
    } else if url_lower.contains("together") {
        "together"
    } else if url_lower.contains("deepseek") {
        "deepseek"
    } else {
        ""
    };

    // First check user-saved API keys
    if !provider.is_empty() {
        if let Some(key) = keys.get_key(provider) {
            return Some(key);
        }
    }

    // Fall back to config/env API key
    config_api_key
}

#[derive(Debug, Serialize)]
pub struct LlmConnectionResult {
    pub connected: bool,
    pub model: String,
    pub provider: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub call_type: String,
    pub function: ToolFunction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolFunction {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Serialize)]
pub struct ChatCompletionResult {
    pub id: String,
    pub model: String,
    pub content: Option<String>,
    #[serde(rename = "finishReason")]
    pub finish_reason: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage: Option<TokenUsage>,
    #[serde(rename = "toolCalls", skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
}

#[derive(Debug, Serialize)]
pub struct TokenUsage {
    #[serde(rename = "promptTokens")]
    pub prompt_tokens: u32,
    #[serde(rename = "completionTokens")]
    pub completion_tokens: u32,
    #[serde(rename = "totalTokens")]
    pub total_tokens: u32,
}

#[tauri::command]
pub async fn test_llm_connection(
    state: State<'_, AppState>,
) -> Result<ApiResponse<LlmConnectionResult>, String> {
    let (config_api_key, base_url, model, provider, use_proxy) = {
        let config = state.config.lock().unwrap();
        (
            config.llm_api_key.clone(),
            config.llm_base_url.clone(),
            config.llm_model.clone(),
            config.llm_provider.clone(),
            config.llm_proxy_url.is_some(),
        )
    };

    // Get effective API key (user-saved keys take precedence)
    let api_key = get_effective_api_key(config_api_key, &base_url);

    if !use_proxy && api_key.is_none() && !is_local_llm_base_url(&base_url) {
        return Ok(ApiResponse::success(LlmConnectionResult {
            connected: false,
            model,
            provider,
            message: Some("No API key configured. Add your API key in Settings > AI & Models, or use a local model.".to_string()),
        }));
    }

    let client = reqwest::Client::new();
    let base_norm = normalize_base_url_for_openai_api(&base_url);
    let base = base_norm.trim_end_matches('/');
    let url = format!("{}/chat/completions", base);
    let request_body = serde_json::json!({
        "model": model,
        "messages": [{"role": "user", "content": "Hello"}],
        "max_tokens": 10,
        "stream": false
    });

    let mut req = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://sentinelops.app")
        .header("X-Title", "SentinelOps")
        .json(&request_body);
    if let Some(k) = &api_key {
        req = req.header("Authorization", format!("Bearer {}", k));
    }

    match req.send().await
    {
        Ok(response) => {
            if response.status().is_success() {
                Ok(ApiResponse::success(LlmConnectionResult {
                    connected: true,
                    model,
                    provider,
                    message: None,
                }))
            } else {
                let status = response.status();
                let error_text = response.text().await.unwrap_or_default();
                Ok(ApiResponse::success(LlmConnectionResult {
                    connected: false,
                    model,
                    provider,
                    message: Some(format!("HTTP {}: {}", status, error_text)),
                }))
            }
        }
        Err(e) => Ok(ApiResponse::success(LlmConnectionResult {
            connected: false,
            model,
            provider,
            message: Some(format!("Connection error: {}", e)),
        })),
    }
}

/// List models from a local server (Ollama or LM Studio). base_url should be e.g. http://localhost:11434/v1
#[tauri::command]
pub async fn list_local_models(base_url: String) -> Result<ApiResponse<Vec<String>>, String> {
    let base_norm = normalize_base_url_for_openai_api(&base_url);
    let base = base_norm.trim_end_matches('/');
    if base.is_empty() {
        return Ok(ApiResponse::success(vec![]));
    }

    let client = reqwest::Client::new();

    // Try Ollama first: base is .../v1, root is ...:11434, GET /api/tags
    let ollama_root = base.strip_suffix("/v1").unwrap_or(base);
    let ollama_url = format!("{}/api/tags", ollama_root);
    if let Ok(res) = client.get(&ollama_url).send().await {
        if res.status().is_success() {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                if let Some(models) = json.get("models").and_then(|m| m.as_array()) {
                    let names: Vec<String> = models
                        .iter()
                        .filter_map(|m| m.get("name").and_then(|n| n.as_str()).map(String::from))
                        .collect();
                    return Ok(ApiResponse::success(names));
                }
            }
        }
    }

    // Try OpenAI-compatible (LM Studio): GET /v1/models
    let openai_url = format!("{}/models", base);
    if let Ok(res) = client.get(&openai_url).send().await {
        if res.status().is_success() {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
                    let names: Vec<String> = data
                        .iter()
                        .filter_map(|m| m.get("id").and_then(|id| id.as_str()).map(String::from))
                        .collect();
                    return Ok(ApiResponse::success(names));
                }
            }
        }
    }

    Ok(ApiResponse::success(vec![]))
}

#[tauri::command]
pub async fn chat_completion(
    state: State<'_, AppState>,
    messages: Vec<ChatMessage>,
    model: Option<String>,
    temperature: Option<f32>,
    max_tokens: Option<u32>,
) -> Result<ApiResponse<ChatCompletionResult>, String> {
    let (config_api_key, base_url, default_model, use_proxy) = {
        let config = state.config.lock().unwrap();
        (
            config.llm_api_key.clone(),
            config.llm_base_url.clone(),
            config.llm_model.clone(),
            config.llm_proxy_url.is_some(),
        )
    };

    let api_key = get_effective_api_key(config_api_key, &base_url);

    if !use_proxy && api_key.is_none() && !is_local_llm_base_url(&base_url) {
        return Ok(ApiResponse::error("LLM_NOT_CONFIGURED", "No API key configured. Add your API key in Settings > AI & Models."));
    }

    let use_model = model.unwrap_or(default_model);
    let client = reqwest::Client::new();
    let base_norm = normalize_base_url_for_openai_api(&base_url);
    let base = base_norm.trim_end_matches('/');
    let url = format!("{}/chat/completions", base);
    let request_body = serde_json::json!({
        "model": use_model,
        "messages": messages,
        "temperature": temperature.unwrap_or(0.7),
        "max_tokens": max_tokens.unwrap_or(4096),
        "stream": false
    });

    let mut req = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://sentinelops.app")
        .header("X-Title", "SentinelOps")
        .json(&request_body);
    if let Some(k) = &api_key {
        req = req.header("Authorization", format!("Bearer {}", k));
    }

    match req.send().await
    {
        Ok(response) => {
            if response.status().is_success() {
                let json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;

                let id = json["id"].as_str().unwrap_or("").to_string();
                let model = json["model"].as_str().unwrap_or(&use_model).to_string();
                let content = json["choices"][0]["message"]["content"]
                    .as_str()
                    .map(String::from);
                let finish_reason = json["choices"][0]["finish_reason"]
                    .as_str()
                    .unwrap_or("stop")
                    .to_string();

                let usage = if let Some(usage_obj) = json["usage"].as_object() {
                    Some(TokenUsage {
                        prompt_tokens: usage_obj["prompt_tokens"].as_u64().unwrap_or(0) as u32,
                        completion_tokens: usage_obj["completion_tokens"].as_u64().unwrap_or(0) as u32,
                        total_tokens: usage_obj["total_tokens"].as_u64().unwrap_or(0) as u32,
                    })
                } else {
                    None
                };

                Ok(ApiResponse::success(ChatCompletionResult {
                    id,
                    model,
                    content,
                    finish_reason,
                    usage,
                    tool_calls: None,
                }))
            } else {
                let status = response.status();
                let error_text = response.text().await.unwrap_or_default();
                Ok(ApiResponse::error("LLM_ERROR", &format!("HTTP {}: {}", status, error_text)))
            }
        }
        Err(e) => Ok(ApiResponse::error("LLM_ERROR", &format!("Request failed: {}", e))),
    }
}

#[tauri::command]
pub async fn chat_completion_stream(
    app: AppHandle,
    state: State<'_, AppState>,
    messages: Vec<ChatMessage>,
    model: Option<String>,
    temperature: Option<f32>,
    max_tokens: Option<u32>,
    stream_id: String,
) -> Result<ApiResponse<ChatCompletionResult>, String> {
    // Get the main window for emitting events
    let window = app.get_webview_window("main");
    
    let (config_api_key, base_url, default_model, use_proxy) = {
        let config = state.config.lock().unwrap();
        (
            config.llm_api_key.clone(),
            config.llm_base_url.clone(),
            config.llm_model.clone(),
            config.llm_proxy_url.is_some(),
        )
    };

    let api_key = get_effective_api_key(config_api_key, &base_url);

    if !use_proxy && api_key.is_none() && !is_local_llm_base_url(&base_url) {
        return Ok(ApiResponse::error("LLM_NOT_CONFIGURED", "No API key configured. Add your API key in Settings > AI & Models."));
    }

    let use_model = model.unwrap_or(default_model);
    let client = reqwest::Client::new();
    let base_norm = normalize_base_url_for_openai_api(&base_url);
    let base = base_norm.trim_end_matches('/');
    let url = format!("{}/chat/completions", base);
    let request_body = serde_json::json!({
        "model": use_model,
        "messages": messages,
        "temperature": temperature.unwrap_or(0.7),
        "max_tokens": max_tokens.unwrap_or(4096),
        "stream": true
    });

    let mut req = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://sentinelops.app")
        .header("X-Title", "SentinelOps")
        .json(&request_body);
    if let Some(k) = &api_key {
        req = req.header("Authorization", format!("Bearer {}", k));
    }

    let mut full_content = String::new();
    let mut response_id = String::new();
    let mut response_model = use_model.clone();
    let mut finish_reason = "stop".to_string();
    let mut usage: Option<TokenUsage> = None;

    match req.send().await {
        Ok(response) => {
            if response.status().is_success() {
                let mut stream = response.bytes_stream();
                let mut buffer = String::new();

                while let Some(chunk_result) = stream.next().await {
                    match chunk_result {
                        Ok(chunk) => {
                            buffer.push_str(&String::from_utf8_lossy(&chunk));
                            
                            // Process complete lines
                            while let Some(newline_pos) = buffer.find('\n') {
                                let line = buffer[..newline_pos].trim().to_string();
                                buffer = buffer[newline_pos + 1..].to_string();
                                
                                if line.starts_with("data: ") {
                                    let data = &line[6..];
                                    if data == "[DONE]" {
                                        // Stream complete
                                        if let Some(ref win) = window {
                                            win.emit(
                                                &format!("stream-chunk-{}", stream_id),
                                                serde_json::json!({
                                                    "done": true,
                                                    "usage": usage,
                                                }),
                                            ).ok();
                                        }
                                        break;
                                    }

                                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                                        // Extract content delta
                                        if let Some(delta) = json["choices"][0]["delta"]["content"].as_str() {
                                            if !delta.is_empty() {
                                                full_content.push_str(delta);
                                                if let Some(ref win) = window {
                                                    win.emit(
                                                        &format!("stream-chunk-{}", stream_id),
                                                        serde_json::json!({
                                                            "content": delta,
                                                            "full": full_content.clone(),
                                                        }),
                                                    ).ok();
                                                }
                                            }
                                        }

                                        // Extract metadata
                                        if let Some(id) = json["id"].as_str() {
                                            if !id.is_empty() {
                                                response_id = id.to_string();
                                            }
                                        }
                                        if let Some(model_str) = json["model"].as_str() {
                                            if !model_str.is_empty() {
                                                response_model = model_str.to_string();
                                            }
                                        }
                                        if let Some(finish) = json["choices"][0]["finish_reason"].as_str() {
                                            if !finish.is_empty() {
                                                finish_reason = finish.to_string();
                                            }
                                        }
                                        if let Some(usage_obj) = json["usage"].as_object() {
                                            usage = Some(TokenUsage {
                                                prompt_tokens: usage_obj["prompt_tokens"].as_u64().unwrap_or(0) as u32,
                                                completion_tokens: usage_obj["completion_tokens"].as_u64().unwrap_or(0) as u32,
                                                total_tokens: usage_obj["total_tokens"].as_u64().unwrap_or(0) as u32,
                                            });
                                        }
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            if let Some(ref win) = window {
                                win.emit(
                                    &format!("stream-error-{}", stream_id),
                                    serde_json::json!({
                                        "error": format!("Stream error: {}", e),
                                    }),
                                ).ok();
                            }
                            return Ok(ApiResponse::error("STREAM_ERROR", &format!("Stream error: {}", e)));
                        }
                    }
                }

                Ok(ApiResponse::success(ChatCompletionResult {
                    id: response_id,
                    model: response_model,
                    content: Some(full_content),
                    finish_reason,
                    usage,
                    tool_calls: None,
                }))
            } else {
                let status = response.status();
                let error_text = response.text().await.unwrap_or_default();
                if let Some(ref win) = window {
                    win.emit(
                        &format!("stream-error-{}", stream_id),
                        serde_json::json!({
                            "error": format!("HTTP {}: {}", status, error_text),
                        }),
                    ).ok();
                }
                Ok(ApiResponse::error("LLM_ERROR", &format!("HTTP {}: {}", status, error_text)))
            }
        }
        Err(e) => {
            if let Some(ref win) = window {
                win.emit(
                    &format!("stream-error-{}", stream_id),
                    serde_json::json!({
                        "error": format!("Request failed: {}", e),
                    }),
                ).ok();
            }
            Ok(ApiResponse::error("LLM_ERROR", &format!("Request failed: {}", e)))
        }
    }
}

/// Streaming chat completion with tools support
/// Emits events for content chunks, tool calls, and thinking
#[tauri::command]
pub async fn chat_completion_stream_with_tools(
    app: AppHandle,
    state: State<'_, AppState>,
    messages: Vec<serde_json::Value>,
    tools: Option<Vec<serde_json::Value>>,
    model: Option<String>,
    temperature: Option<f32>,
    max_tokens: Option<u32>,
    stream_id: String,
) -> Result<ApiResponse<ChatCompletionResult>, String> {
    let window = app.get_webview_window("main");

    let (config_api_key, base_url, default_model, use_proxy) = {
        let config = state.config.lock().unwrap();
        (
            config.llm_api_key.clone(),
            config.llm_base_url.clone(),
            config.llm_model.clone(),
            config.llm_proxy_url.is_some(),
        )
    };

    let api_key = get_effective_api_key(config_api_key, &base_url);

    if !use_proxy && api_key.is_none() && !is_local_llm_base_url(&base_url) {
        return Ok(ApiResponse::error("LLM_NOT_CONFIGURED", "No API key configured. Add your API key in Settings > AI & Models."));
    }

    let use_model = model.unwrap_or(default_model);
    let client = reqwest::Client::new();
    let base_norm = normalize_base_url_for_openai_api(&base_url);
    let base = base_norm.trim_end_matches('/');
    let url = format!("{}/chat/completions", base);

    let mut request_body = serde_json::json!({
        "model": use_model,
        "messages": messages,
        "temperature": temperature.unwrap_or(0.7),
        "max_tokens": max_tokens.unwrap_or(4096),
        "stream": true
    });
    if let Some(t) = &tools {
        if !t.is_empty() {
            request_body["tools"] = serde_json::json!(t);
        }
    }

    let mut req = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://sentinelops.app")
        .header("X-Title", "SentinelOps")
        .json(&request_body);
    if let Some(k) = &api_key {
        req = req.header("Authorization", format!("Bearer {}", k));
    }

    let mut full_content = String::new();
    let mut response_id = String::new();
    let mut response_model = use_model.clone();
    let mut finish_reason = "stop".to_string();
    let mut usage: Option<TokenUsage> = None;
    let mut tool_calls: Vec<ToolCall> = Vec::new();
    let mut current_tool_call_index: Option<usize> = None;

    match req.send().await {
        Ok(response) => {
            if response.status().is_success() {
                let mut stream = response.bytes_stream();
                let mut buffer = String::new();

                // Emit thinking started
                if let Some(ref win) = window {
                    win.emit(
                        &format!("stream-thinking-{}", stream_id),
                        serde_json::json!({ "status": "started" }),
                    ).ok();
                }

                while let Some(chunk_result) = stream.next().await {
                    match chunk_result {
                        Ok(chunk) => {
                            buffer.push_str(&String::from_utf8_lossy(&chunk));

                            while let Some(newline_pos) = buffer.find('\n') {
                                let line = buffer[..newline_pos].trim().to_string();
                                buffer = buffer[newline_pos + 1..].to_string();

                                if line.starts_with("data: ") {
                                    let data = &line[6..];
                                    if data == "[DONE]" {
                                        if let Some(ref win) = window {
                                            win.emit(
                                                &format!("stream-chunk-{}", stream_id),
                                                serde_json::json!({
                                                    "done": true,
                                                    "full": full_content.clone(),
                                                    "usage": usage,
                                                    "toolCalls": if tool_calls.is_empty() { None } else { Some(&tool_calls) },
                                                }),
                                            ).ok();
                                        }
                                        break;
                                    }

                                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                                        // Extract content delta
                                        if let Some(delta) = json["choices"][0]["delta"]["content"].as_str() {
                                            if !delta.is_empty() {
                                                full_content.push_str(delta);
                                                if let Some(ref win) = window {
                                                    win.emit(
                                                        &format!("stream-chunk-{}", stream_id),
                                                        serde_json::json!({
                                                            "content": delta,
                                                            "full": full_content.clone(),
                                                        }),
                                                    ).ok();
                                                }
                                            }
                                        }

                                        // Handle tool calls in stream
                                        if let Some(tc_array) = json["choices"][0]["delta"]["tool_calls"].as_array() {
                                            for tc in tc_array {
                                                let idx = tc["index"].as_u64().unwrap_or(0) as usize;

                                                // Initialize tool call if new
                                                if idx >= tool_calls.len() {
                                                    let id = tc["id"].as_str().unwrap_or("").to_string();
                                                    let name = tc["function"]["name"].as_str().unwrap_or("").to_string();
                                                    tool_calls.push(ToolCall {
                                                        id,
                                                        call_type: "function".to_string(),
                                                        function: ToolFunction {
                                                            name: name.clone(),
                                                            arguments: String::new(),
                                                        },
                                                    });

                                                    // Emit tool call started
                                                    if let Some(ref win) = window {
                                                        win.emit(
                                                            &format!("stream-tool-{}", stream_id),
                                                            serde_json::json!({
                                                                "status": "started",
                                                                "index": idx,
                                                                "name": name,
                                                            }),
                                                        ).ok();
                                                    }
                                                    current_tool_call_index = Some(idx);
                                                }

                                                // Append arguments
                                                if let Some(args) = tc["function"]["arguments"].as_str() {
                                                    if let Some(tc_ref) = tool_calls.get_mut(idx) {
                                                        tc_ref.function.arguments.push_str(args);
                                                    }
                                                }
                                            }
                                        }

                                        // Extract metadata
                                        if let Some(id) = json["id"].as_str() {
                                            if !id.is_empty() {
                                                response_id = id.to_string();
                                            }
                                        }
                                        if let Some(model_str) = json["model"].as_str() {
                                            if !model_str.is_empty() {
                                                response_model = model_str.to_string();
                                            }
                                        }
                                        if let Some(finish) = json["choices"][0]["finish_reason"].as_str() {
                                            if !finish.is_empty() {
                                                finish_reason = finish.to_string();

                                                // If finish reason is tool_calls, emit completion
                                                if finish == "tool_calls" {
                                                    if let Some(ref win) = window {
                                                        win.emit(
                                                            &format!("stream-tool-{}", stream_id),
                                                            serde_json::json!({
                                                                "status": "completed",
                                                                "toolCalls": &tool_calls,
                                                            }),
                                                        ).ok();
                                                    }
                                                }
                                            }
                                        }
                                        if let Some(usage_obj) = json["usage"].as_object() {
                                            usage = Some(TokenUsage {
                                                prompt_tokens: usage_obj["prompt_tokens"].as_u64().unwrap_or(0) as u32,
                                                completion_tokens: usage_obj["completion_tokens"].as_u64().unwrap_or(0) as u32,
                                                total_tokens: usage_obj["total_tokens"].as_u64().unwrap_or(0) as u32,
                                            });
                                        }
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            if let Some(ref win) = window {
                                win.emit(
                                    &format!("stream-error-{}", stream_id),
                                    serde_json::json!({ "error": format!("Stream error: {}", e) }),
                                ).ok();
                            }
                            return Ok(ApiResponse::error("STREAM_ERROR", &format!("Stream error: {}", e)));
                        }
                    }
                }

                Ok(ApiResponse::success(ChatCompletionResult {
                    id: response_id,
                    model: response_model,
                    content: if full_content.is_empty() { None } else { Some(full_content) },
                    finish_reason,
                    usage,
                    tool_calls: if tool_calls.is_empty() { None } else { Some(tool_calls) },
                }))
            } else {
                let status = response.status();
                let error_text = response.text().await.unwrap_or_default();
                if let Some(ref win) = window {
                    win.emit(
                        &format!("stream-error-{}", stream_id),
                        serde_json::json!({ "error": format!("HTTP {}: {}", status, error_text) }),
                    ).ok();
                }
                Ok(ApiResponse::error("LLM_ERROR", &format!("HTTP {}: {}", status, error_text)))
            }
        }
        Err(e) => {
            if let Some(ref win) = window {
                win.emit(
                    &format!("stream-error-{}", stream_id),
                    serde_json::json!({ "error": format!("Request failed: {}", e) }),
                ).ok();
            }
            Ok(ApiResponse::error("LLM_ERROR", &format!("Request failed: {}", e)))
        }
    }
}

#[tauri::command]
pub async fn chat_completion_with_tools(
    state: State<'_, AppState>,
    messages: Vec<serde_json::Value>,
    tools: Option<Vec<serde_json::Value>>,
    model: Option<String>,
    temperature: Option<f32>,
    max_tokens: Option<u32>,
) -> Result<ApiResponse<ChatCompletionResult>, String> {
    let (config_api_key, base_url, default_model, use_proxy) = {
        let config = state.config.lock().unwrap();
        (
            config.llm_api_key.clone(),
            config.llm_base_url.clone(),
            config.llm_model.clone(),
            config.llm_proxy_url.is_some(),
        )
    };

    let api_key = get_effective_api_key(config_api_key, &base_url);

    if !use_proxy && api_key.is_none() && !is_local_llm_base_url(&base_url) {
        return Ok(ApiResponse::error("LLM_NOT_CONFIGURED", "No API key configured. Add your API key in Settings > AI & Models."));
    }

    let use_model = model.unwrap_or(default_model);
    let client = reqwest::Client::new();
    let base_norm = normalize_base_url_for_openai_api(&base_url);
    let base = base_norm.trim_end_matches('/');
    let url = format!("{}/chat/completions", base);

    let mut request_body = serde_json::json!({
        "model": use_model,
        "messages": messages,
        "temperature": temperature.unwrap_or(0.7),
        "max_tokens": max_tokens.unwrap_or(4096),
        "stream": false
    });
    if let Some(t) = &tools {
        if !t.is_empty() {
            request_body["tools"] = serde_json::json!(t);
        }
    }

    let mut req = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://sentinelops.app")
        .header("X-Title", "SentinelOps")
        .json(&request_body);
    if let Some(k) = &api_key {
        req = req.header("Authorization", format!("Bearer {}", k));
    }

    match req.send().await
    {
        Ok(response) => {
            if response.status().is_success() {
                let json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;

                let id = json["id"].as_str().unwrap_or("").to_string();
                let model = json["model"].as_str().unwrap_or(&use_model).to_string();
                let content = json["choices"][0]["message"]["content"]
                    .as_str()
                    .map(String::from);
                let finish_reason = json["choices"][0]["finish_reason"]
                    .as_str()
                    .unwrap_or("stop")
                    .to_string();

                // Parse tool calls if present
                let tool_calls = if let Some(calls) = json["choices"][0]["message"]["tool_calls"].as_array() {
                    let parsed: Vec<ToolCall> = calls.iter().filter_map(|tc| {
                        Some(ToolCall {
                            id: tc["id"].as_str()?.to_string(),
                            call_type: tc["type"].as_str().unwrap_or("function").to_string(),
                            function: ToolFunction {
                                name: tc["function"]["name"].as_str()?.to_string(),
                                arguments: tc["function"]["arguments"].as_str().unwrap_or("{}").to_string(),
                            },
                        })
                    }).collect();
                    if parsed.is_empty() { None } else { Some(parsed) }
                } else {
                    None
                };

                let usage = if let Some(usage_obj) = json["usage"].as_object() {
                    Some(TokenUsage {
                        prompt_tokens: usage_obj["prompt_tokens"].as_u64().unwrap_or(0) as u32,
                        completion_tokens: usage_obj["completion_tokens"].as_u64().unwrap_or(0) as u32,
                        total_tokens: usage_obj["total_tokens"].as_u64().unwrap_or(0) as u32,
                    })
                } else {
                    None
                };

                Ok(ApiResponse::success(ChatCompletionResult {
                    id,
                    model,
                    content,
                    finish_reason,
                    usage,
                    tool_calls,
                }))
            } else {
                let status = response.status();
                let error_text = response.text().await.unwrap_or_default();
                Ok(ApiResponse::error("LLM_ERROR", &format!("HTTP {}: {}", status, error_text)))
            }
        }
        Err(e) => Ok(ApiResponse::error("LLM_ERROR", &format!("Request failed: {}", e))),
    }
}

#[derive(Debug, Serialize)]
pub struct ImageGenerationResult {
    pub images: Vec<String>,
    pub model: String,
}

#[tauri::command]
pub async fn generate_image(
    state: State<'_, AppState>,
    prompt: String,
    negative_prompt: Option<String>,
    model: String,
    width: u32,
    height: u32,
    num_images: u32,
    steps: Option<u32>,
    guidance_scale: Option<f32>,
    seed: Option<i64>,
) -> Result<ApiResponse<ImageGenerationResult>, String> {
    let (config_api_key, base_url, use_proxy) = {
        let config = state.config.lock().unwrap();
        (
            config.llm_api_key.clone(),
            config.llm_base_url.clone(),
            config.llm_proxy_url.is_some(),
        )
    };

    let api_key = get_effective_api_key(config_api_key, &base_url);

    if !use_proxy && api_key.is_none() && !is_local_llm_base_url(&base_url) {
        return Ok(ApiResponse::error("LLM_NOT_CONFIGURED", "No API key configured. Add your API key in Settings > AI & Models."));
    }

    let url = if use_proxy {
        format!("{}/images/generations", base_url.trim_end_matches('/'))
    } else {
        "https://openrouter.ai/api/v1/images/generations".to_string()
    };

    let mut request_body = serde_json::json!({
        "model": model,
        "prompt": prompt,
        "n": num_images.min(4),
        "size": format!("{}x{}", width, height),
    });
    if let Some(neg) = &negative_prompt {
        if !neg.is_empty() {
            request_body["negative_prompt"] = serde_json::json!(neg);
        }
    }
    if let Some(s) = steps {
        request_body["steps"] = serde_json::json!(s);
    }
    if let Some(g) = guidance_scale {
        request_body["guidance_scale"] = serde_json::json!(g);
    }
    if let Some(s) = seed {
        request_body["seed"] = serde_json::json!(s);
    }

    let client = reqwest::Client::new();
    let mut req = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://sentinelops.app")
        .header("X-Title", "SentinelOps")
        .json(&request_body)
        .timeout(std::time::Duration::from_secs(120));
    if let Some(k) = &api_key {
        req = req.header("Authorization", format!("Bearer {}", k));
    }

    match req.send().await
    {
        Ok(response) => {
            if response.status().is_success() {
                let json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;

                // Extract image URLs from response
                let images: Vec<String> = if let Some(data) = json["data"].as_array() {
                    data.iter()
                        .filter_map(|item| {
                            // Try to get URL first, then base64
                            if let Some(url) = item["url"].as_str() {
                                Some(url.to_string())
                            } else if let Some(b64) = item["b64_json"].as_str() {
                                Some(format!("data:image/png;base64,{}", b64))
                            } else {
                                None
                            }
                        })
                        .collect()
                } else {
                    vec![]
                };

                if images.is_empty() {
                    return Ok(ApiResponse::error("IMAGE_ERROR", "No images returned from API"));
                }

                Ok(ApiResponse::success(ImageGenerationResult {
                    images,
                    model,
                }))
            } else {
                let status = response.status();
                let error_text = response.text().await.unwrap_or_default();
                Ok(ApiResponse::error("IMAGE_ERROR", &format!("HTTP {}: {}", status, error_text)))
            }
        }
        Err(e) => Ok(ApiResponse::error("IMAGE_ERROR", &format!("Request failed: {}", e))),
    }
}

// ==================== Embedding Commands ====================

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddingResult {
    pub embedding: Vec<f32>,
    pub model: String,
    pub dimensions: usize,
    pub token_count: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchEmbeddingResult {
    pub embeddings: Vec<Vec<f32>>,
    pub model: String,
    pub dimensions: usize,
    pub total_tokens: Option<u32>,
}

#[tauri::command]
pub async fn create_embedding(
    state: State<'_, AppState>,
    text: String,
    model: Option<String>,
) -> Result<ApiResponse<EmbeddingResult>, String> {
    let (config_api_key, base_url, use_proxy) = {
        let config = state.config.lock().unwrap();
        (
            config.llm_api_key.clone(),
            config.llm_base_url.clone(),
            config.llm_proxy_url.is_some(),
        )
    };

    let api_key = get_effective_api_key(config_api_key, &base_url);

    if !use_proxy && api_key.is_none() && !is_local_llm_base_url(&base_url) {
        return Ok(ApiResponse::error("LLM_NOT_CONFIGURED", "No API key configured. Add your API key in Settings > AI & Models."));
    }

    let embedding_model = model.unwrap_or_else(|| "openai/text-embedding-3-small".to_string());
    let client = reqwest::Client::new();
    let base_norm = normalize_base_url_for_openai_api(&base_url);
    let base = base_norm.trim_end_matches('/');
    let url = format!("{}/embeddings", base);
    let request_body = serde_json::json!({ "model": embedding_model, "input": text });

    let mut req = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://sentinelops.app")
        .header("X-Title", "SentinelOps")
        .json(&request_body);
    if let Some(k) = &api_key {
        req = req.header("Authorization", format!("Bearer {}", k));
    }

    match req.send().await
    {
        Ok(response) => {
            if response.status().is_success() {
                let json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;

                // Extract embedding from response
                let embedding: Vec<f32> = json["data"][0]["embedding"]
                    .as_array()
                    .map(|arr| arr.iter().filter_map(|v| v.as_f64().map(|f| f as f32)).collect())
                    .unwrap_or_default();

                let dimensions = embedding.len();
                let token_count = json["usage"]["total_tokens"].as_u64().map(|t| t as u32);

                Ok(ApiResponse::success(EmbeddingResult {
                    embedding,
                    model: embedding_model,
                    dimensions,
                    token_count,
                }))
            } else {
                let status = response.status();
                let error_text = response.text().await.unwrap_or_default();
                Ok(ApiResponse::error("EMBEDDING_ERROR", &format!("HTTP {}: {}", status, error_text)))
            }
        }
        Err(e) => Ok(ApiResponse::error("EMBEDDING_ERROR", &format!("Request failed: {}", e))),
    }
}

#[tauri::command]
pub async fn batch_create_embeddings(
    state: State<'_, AppState>,
    texts: Vec<String>,
    model: Option<String>,
) -> Result<ApiResponse<BatchEmbeddingResult>, String> {
    if texts.is_empty() {
        return Ok(ApiResponse::error("EMBEDDING_ERROR", "No texts provided"));
    }

    let (config_api_key, base_url, use_proxy) = {
        let config = state.config.lock().unwrap();
        (
            config.llm_api_key.clone(),
            config.llm_base_url.clone(),
            config.llm_proxy_url.is_some(),
        )
    };

    let api_key = get_effective_api_key(config_api_key, &base_url);

    if !use_proxy && api_key.is_none() && !is_local_llm_base_url(&base_url) {
        return Ok(ApiResponse::error("LLM_NOT_CONFIGURED", "No API key configured. Add your API key in Settings > AI & Models."));
    }

    let embedding_model = model.unwrap_or_else(|| "openai/text-embedding-3-small".to_string());
    let client = reqwest::Client::new();
    let base_norm = normalize_base_url_for_openai_api(&base_url);
    let base = base_norm.trim_end_matches('/');
    let url = format!("{}/embeddings", base);
    let request_body = serde_json::json!({ "model": embedding_model, "input": texts });

    let mut req = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://sentinelops.app")
        .header("X-Title", "SentinelOps")
        .json(&request_body);
    if let Some(k) = &api_key {
        req = req.header("Authorization", format!("Bearer {}", k));
    }

    match req.send().await
    {
        Ok(response) => {
            if response.status().is_success() {
                let json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;

                // Extract all embeddings from response
                let embeddings: Vec<Vec<f32>> = json["data"]
                    .as_array()
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|item| {
                                item["embedding"].as_array().map(|emb| {
                                    emb.iter().filter_map(|v| v.as_f64().map(|f| f as f32)).collect()
                                })
                            })
                            .collect()
                    })
                    .unwrap_or_default();

                let dimensions = embeddings.first().map(|e| e.len()).unwrap_or(0);
                let total_tokens = json["usage"]["total_tokens"].as_u64().map(|t| t as u32);

                Ok(ApiResponse::success(BatchEmbeddingResult {
                    embeddings,
                    model: embedding_model,
                    dimensions,
                    total_tokens,
                }))
            } else {
                let status = response.status();
                let error_text = response.text().await.unwrap_or_default();
                Ok(ApiResponse::error("EMBEDDING_ERROR", &format!("HTTP {}: {}", status, error_text)))
            }
        }
        Err(e) => Ok(ApiResponse::error("EMBEDDING_ERROR", &format!("Request failed: {}", e))),
    }
}
