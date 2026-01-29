use crate::services::AppState;
use super::file_ops::ApiResponse;
use serde::{Deserialize, Serialize};
use tauri::State;

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
    // Extract all needed values from config and drop the lock before any await
    let (api_key, base_url, model, provider) = {
        let config = state.config.lock().unwrap();
        let api_key = config.llm_api_key.clone();
        let base_url = config.llm_base_url.clone();
        let model = config.llm_model.clone();
        let provider = config.llm_provider.clone();
        (api_key, base_url, model, provider)
    };

    let api_key = match api_key {
        Some(key) => key,
        None => {
            return Ok(ApiResponse::success(LlmConnectionResult {
                connected: false,
                model,
                provider,
                message: Some("No API key configured".to_string()),
            }));
        }
    };

    // Test connection
    let client = reqwest::Client::new();
    let url = format!("{}/chat/completions", base_url);

    let request_body = serde_json::json!({
        "model": model,
        "messages": [{"role": "user", "content": "Hello"}],
        "max_tokens": 10,
        "stream": false
    });

    match client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
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

#[tauri::command]
pub async fn chat_completion(
    state: State<'_, AppState>,
    messages: Vec<ChatMessage>,
    model: Option<String>,
    temperature: Option<f32>,
    max_tokens: Option<u32>,
) -> Result<ApiResponse<ChatCompletionResult>, String> {
    // Extract all needed values from config and drop the lock before any await
    let (api_key, base_url, default_model) = {
        let config = state.config.lock().unwrap();
        let api_key = config.llm_api_key.clone();
        let base_url = config.llm_base_url.clone();
        let default_model = config.llm_model.clone();
        (api_key, base_url, default_model)
    };

    let api_key = match api_key {
        Some(key) => key,
        None => {
            return Ok(ApiResponse::error("LLM_NOT_CONFIGURED", "No API key configured"));
        }
    };

    let use_model = model.unwrap_or(default_model);

    let client = reqwest::Client::new();
    let url = format!("{}/chat/completions", base_url);

    let request_body = serde_json::json!({
        "model": use_model,
        "messages": messages,
        "temperature": temperature.unwrap_or(0.7),
        "max_tokens": max_tokens.unwrap_or(4096),
        "stream": false
    });

    match client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://sentinelops.app")
        .header("X-Title", "SentinelOps")
        .json(&request_body)
        .send()
        .await
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
pub async fn chat_completion_with_tools(
    state: State<'_, AppState>,
    messages: Vec<serde_json::Value>,
    tools: Option<Vec<serde_json::Value>>,
    model: Option<String>,
    temperature: Option<f32>,
    max_tokens: Option<u32>,
) -> Result<ApiResponse<ChatCompletionResult>, String> {
    // Extract all needed values from config and drop the lock before any await
    let (api_key, base_url, default_model) = {
        let config = state.config.lock().unwrap();
        let api_key = config.llm_api_key.clone();
        let base_url = config.llm_base_url.clone();
        let default_model = config.llm_model.clone();
        (api_key, base_url, default_model)
    };

    let api_key = match api_key {
        Some(key) => key,
        None => {
            return Ok(ApiResponse::error("LLM_NOT_CONFIGURED", "No API key configured"));
        }
    };

    let use_model = model.unwrap_or(default_model);

    let client = reqwest::Client::new();
    let url = format!("{}/chat/completions", base_url);

    let mut request_body = serde_json::json!({
        "model": use_model,
        "messages": messages,
        "temperature": temperature.unwrap_or(0.7),
        "max_tokens": max_tokens.unwrap_or(4096),
        "stream": false
    });

    // Add tools if provided
    if let Some(tools) = tools {
        if !tools.is_empty() {
            request_body["tools"] = serde_json::json!(tools);
        }
    }

    match client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://sentinelops.app")
        .header("X-Title", "SentinelOps")
        .json(&request_body)
        .send()
        .await
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
    // Extract API key from config
    let api_key = {
        let config = state.config.lock().unwrap();
        config.llm_api_key.clone()
    };

    let api_key = match api_key {
        Some(key) => key,
        None => {
            return Ok(ApiResponse::error("LLM_NOT_CONFIGURED", "No API key configured"));
        }
    };

    let client = reqwest::Client::new();

    // Use OpenRouter's image generation endpoint
    let url = "https://openrouter.ai/api/v1/images/generations";

    let mut request_body = serde_json::json!({
        "model": model,
        "prompt": prompt,
        "n": num_images.min(4),
        "size": format!("{}x{}", width, height),
    });

    // Add optional parameters
    if let Some(neg) = negative_prompt {
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

    match client
        .post(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://sentinelops.app")
        .header("X-Title", "SentinelOps")
        .json(&request_body)
        .timeout(std::time::Duration::from_secs(120))
        .send()
        .await
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
    // Extract config values
    let (api_key, base_url) = {
        let config = state.config.lock().unwrap();
        (config.llm_api_key.clone(), config.llm_base_url.clone())
    };

    let api_key = match api_key {
        Some(key) => key,
        None => {
            return Ok(ApiResponse::error("LLM_NOT_CONFIGURED", "No API key configured"));
        }
    };

    let embedding_model = model.unwrap_or_else(|| "openai/text-embedding-3-small".to_string());

    let client = reqwest::Client::new();
    let url = format!("{}/embeddings", base_url);

    let request_body = serde_json::json!({
        "model": embedding_model,
        "input": text
    });

    match client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://sentinelops.app")
        .header("X-Title", "SentinelOps")
        .json(&request_body)
        .send()
        .await
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

    // Extract config values
    let (api_key, base_url) = {
        let config = state.config.lock().unwrap();
        (config.llm_api_key.clone(), config.llm_base_url.clone())
    };

    let api_key = match api_key {
        Some(key) => key,
        None => {
            return Ok(ApiResponse::error("LLM_NOT_CONFIGURED", "No API key configured"));
        }
    };

    let embedding_model = model.unwrap_or_else(|| "openai/text-embedding-3-small".to_string());

    let client = reqwest::Client::new();
    let url = format!("{}/embeddings", base_url);

    let request_body = serde_json::json!({
        "model": embedding_model,
        "input": texts
    });

    match client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://sentinelops.app")
        .header("X-Title", "SentinelOps")
        .json(&request_body)
        .send()
        .await
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
