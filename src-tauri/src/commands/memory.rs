use crate::services::AppState;
use crate::services::memory_service::{
    Memory, MemoryWithScore, MemorySettings, MemoryStats, MemoryFilters,
    CreateMemoryInput, UpdateMemoryInput,
};
use super::file_ops::ApiResponse;
use super::llm::create_embedding;
use serde::{Deserialize, Serialize};
use tauri::State;

// ==================== Response Types ====================

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryListResult {
    pub memories: Vec<Memory>,
    pub count: usize,
    pub total: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemorySearchResult {
    pub memories: Vec<MemoryWithScore>,
    pub count: usize,
    pub search_type: String,
}

// ==================== Request Types ====================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMemoryRequest {
    pub content: String,
    pub summary: Option<String>,
    #[serde(rename = "type")]
    pub memory_type: Option<String>,
    pub tags: Option<Vec<String>>,
    pub importance: Option<i32>,
    pub is_pinned: Option<bool>,
    pub source_conversation_id: Option<String>,
    pub source_message_ids: Option<Vec<String>>,
    pub metadata: Option<serde_json::Value>,
    pub generate_embedding: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMemoryRequest {
    pub content: Option<String>,
    pub summary: Option<String>,
    pub tags: Option<Vec<String>>,
    pub importance: Option<i32>,
    pub is_pinned: Option<bool>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMemoryRequest {
    pub query: String,
    pub limit: Option<usize>,
    pub threshold: Option<f64>,
    pub include_embedding: Option<bool>,
    pub tags: Option<Vec<String>>,
    #[serde(rename = "type")]
    pub memory_type: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractMemoriesRequest {
    pub conversation_id: String,
    pub messages: Vec<ConversationMessage>,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSettingsRequest {
    pub auto_extract_enabled: Option<bool>,
    pub extraction_model: Option<String>,
    pub embedding_model: Option<String>,
    pub max_memories: Option<i32>,
    pub context_injection_count: Option<i32>,
    pub similarity_threshold: Option<f64>,
}

// ==================== Commands ====================

#[tauri::command]
pub async fn create_memory(
    state: State<'_, AppState>,
    request: CreateMemoryRequest,
) -> Result<ApiResponse<Memory>, String> {
    // Ensure memory manager is initialized
    state.get_or_init_memory()?;

    // Create memory and get ID in a scope to drop the guard
    let (memory_id, content_for_embedding) = {
        let memory_guard = state.memory.lock().map_err(|e| e.to_string())?;
        let manager = memory_guard.as_ref().ok_or("Memory manager not initialized")?;

        let input = CreateMemoryInput {
            content: request.content.clone(),
            summary: request.summary,
            memory_type: request.memory_type,
            tags: request.tags,
            importance: request.importance,
            is_pinned: request.is_pinned,
            source_conversation_id: request.source_conversation_id,
            source_message_ids: request.source_message_ids,
            metadata: request.metadata,
        };

        let memory = manager.create_memory(input)?;
        (memory.id.clone(), request.content.clone())
    }; // Guard dropped here

    // Generate and store embedding if requested
    if request.generate_embedding.unwrap_or(true) {
        // Get embedding (async)
        let embedding_result = create_embedding(state.clone(), content_for_embedding, None).await?;
        if embedding_result.ok {
            if let Some(emb_data) = embedding_result.data {
                let memory_guard = state.memory.lock().map_err(|e| e.to_string())?;
                let manager = memory_guard.as_ref().ok_or("Memory manager not initialized")?;
                let _ = manager.store_embedding(&memory_id, &emb_data.embedding, &emb_data.model);
            }
        }
    }

    // Re-fetch memory to return updated state
    let memory_guard = state.memory.lock().map_err(|e| e.to_string())?;
    let manager = memory_guard.as_ref().ok_or("Memory manager not initialized")?;
    match manager.get_memory(&memory_id)? {
        Some(memory) => Ok(ApiResponse::success(memory)),
        None => Ok(ApiResponse::error("NOT_FOUND", "Memory not found after creation")),
    }
}

#[tauri::command]
pub async fn get_memory(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<Memory>, String> {
    state.get_or_init_memory()?;

    let memory_guard = state.memory.lock().map_err(|e| e.to_string())?;
    let manager = memory_guard.as_ref().ok_or("Memory manager not initialized")?;

    match manager.get_memory(&id)? {
        Some(memory) => Ok(ApiResponse::success(memory)),
        None => Ok(ApiResponse::error("NOT_FOUND", "Memory not found")),
    }
}

#[tauri::command]
pub async fn update_memory(
    state: State<'_, AppState>,
    id: String,
    request: UpdateMemoryRequest,
) -> Result<ApiResponse<Memory>, String> {
    state.get_or_init_memory()?;

    let memory_guard = state.memory.lock().map_err(|e| e.to_string())?;
    let manager = memory_guard.as_ref().ok_or("Memory manager not initialized")?;

    let input = UpdateMemoryInput {
        content: request.content,
        summary: request.summary,
        tags: request.tags,
        importance: request.importance,
        is_pinned: request.is_pinned,
        metadata: request.metadata,
    };

    let memory = manager.update_memory(&id, input)?;
    Ok(ApiResponse::success(memory))
}

#[tauri::command]
pub async fn delete_memory(
    state: State<'_, AppState>,
    id: String,
) -> Result<ApiResponse<bool>, String> {
    state.get_or_init_memory()?;

    let memory_guard = state.memory.lock().map_err(|e| e.to_string())?;
    let manager = memory_guard.as_ref().ok_or("Memory manager not initialized")?;

    let deleted = manager.delete_memory(&id)?;
    Ok(ApiResponse::success(deleted))
}

#[tauri::command]
pub async fn list_memories(
    state: State<'_, AppState>,
    memory_type: Option<String>,
    tags: Option<Vec<String>>,
    limit: Option<usize>,
    offset: Option<usize>,
    sort_by: Option<String>,
) -> Result<ApiResponse<MemoryListResult>, String> {
    state.get_or_init_memory()?;

    let memory_guard = state.memory.lock().map_err(|e| e.to_string())?;
    let manager = memory_guard.as_ref().ok_or("Memory manager not initialized")?;

    let filters = MemoryFilters {
        memory_type,
        tags,
        is_pinned: None,
        limit,
        offset,
        sort_by,
    };

    let (memories, total) = manager.list_memories(filters)?;
    let count = memories.len();

    Ok(ApiResponse::success(MemoryListResult {
        memories,
        count,
        total,
    }))
}

#[tauri::command]
pub async fn search_memories(
    state: State<'_, AppState>,
    request: SearchMemoryRequest,
) -> Result<ApiResponse<MemorySearchResult>, String> {
    state.get_or_init_memory()?;

    let limit = request.limit.unwrap_or(10);
    let threshold = request.threshold.unwrap_or(0.7);
    let use_embedding = request.include_embedding.unwrap_or(true);

    // Try to get embedding for semantic search
    let query_embedding: Option<Vec<f32>> = if use_embedding {
        let emb_result = create_embedding(state.clone(), request.query.clone(), None).await?;
        if emb_result.ok {
            emb_result.data.map(|d| d.embedding)
        } else {
            None
        }
    } else {
        None
    };

    let memory_guard = state.memory.lock().map_err(|e| e.to_string())?;
    let manager = memory_guard.as_ref().ok_or("Memory manager not initialized")?;

    let memories = manager.search_hybrid(
        &request.query,
        query_embedding.as_deref(),
        limit,
        threshold,
    )?;

    let search_type = if query_embedding.is_some() && !memories.is_empty() && memories[0].match_type == "semantic" {
        "semantic"
    } else {
        "keyword"
    }.to_string();

    let count = memories.len();

    Ok(ApiResponse::success(MemorySearchResult {
        memories,
        count,
        search_type,
    }))
}

#[tauri::command]
pub async fn get_relevant_memories(
    state: State<'_, AppState>,
    context: String,
    limit: Option<usize>,
) -> Result<ApiResponse<Vec<MemoryWithScore>>, String> {
    state.get_or_init_memory()?;

    let limit = limit.unwrap_or(5);

    // Get settings for threshold
    let threshold = {
        let memory_guard = state.memory.lock().map_err(|e| e.to_string())?;
        let manager = memory_guard.as_ref().ok_or("Memory manager not initialized")?;
        manager.get_settings()?.similarity_threshold
    };

    // Get embedding for context
    let emb_result = create_embedding(state.clone(), context.clone(), None).await?;
    let query_embedding = if emb_result.ok {
        emb_result.data.map(|d| d.embedding)
    } else {
        None
    };

    let memory_guard = state.memory.lock().map_err(|e| e.to_string())?;
    let manager = memory_guard.as_ref().ok_or("Memory manager not initialized")?;

    let memories = manager.search_hybrid(&context, query_embedding.as_deref(), limit, threshold)?;

    // Increment access count for retrieved memories
    for mem in &memories {
        let _ = manager.increment_access(&mem.memory.id);
    }

    Ok(ApiResponse::success(memories))
}

#[tauri::command]
pub async fn extract_memories(
    state: State<'_, AppState>,
    request: ExtractMemoriesRequest,
) -> Result<ApiResponse<Vec<Memory>>, String> {
    if request.messages.len() < 4 {
        return Ok(ApiResponse::success(vec![]));
    }

    // Build conversation text for extraction
    let conversation_text: String = request.messages
        .iter()
        .map(|m| format!("{}: {}", m.role, m.content))
        .collect::<Vec<_>>()
        .join("\n\n");

    // Extraction prompt
    let extraction_prompt = format!(
        r#"Analyze this conversation and extract important information that should be remembered for future interactions.

Focus on:
- User preferences and coding style
- Project-specific knowledge (architecture, patterns, conventions)
- Important decisions made
- Technical details about the codebase
- User's goals and ongoing tasks

For each memory, provide a JSON array with objects containing:
- content: The information to remember (1-3 sentences)
- summary: A brief title (5-10 words)
- tags: Relevant categories as array (e.g., ["preferences", "architecture", "react"])
- importance: 1-10 scale based on how useful this is for future conversations

Return ONLY a valid JSON array. If nothing worth remembering, return empty array [].

Conversation:
{}
"#,
        conversation_text
    );

    // Get config for LLM call
    let (api_key, base_url, default_model) = {
        let config = state.config.lock().unwrap();
        (config.llm_api_key.clone(), config.llm_base_url.clone(), config.llm_model.clone())
    };

    let api_key = match api_key {
        Some(key) => key,
        None => return Ok(ApiResponse::success(vec![])),
    };

    let model = request.model.unwrap_or(default_model);

    // Call LLM for extraction
    let client = reqwest::Client::new();
    let url = format!("{}/chat/completions", base_url);

    let request_body = serde_json::json!({
        "model": model,
        "messages": [
            {"role": "system", "content": "You are a memory extraction assistant. Extract important information from conversations and return it as JSON."},
            {"role": "user", "content": extraction_prompt}
        ],
        "temperature": 0.3,
        "max_tokens": 2048
    });

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://sentinelops.app")
        .header("X-Title", "SentinelOps")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Ok(ApiResponse::success(vec![]));
    }

    let json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let content = json["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("[]");

    // Parse extracted memories
    let extracted: Vec<serde_json::Value> = serde_json::from_str(content).unwrap_or_default();

    // Ensure memory manager is ready
    state.get_or_init_memory()?;

    let mut created_memories = Vec::new();

    for item in extracted {
        let content = item["content"].as_str().unwrap_or_default().to_string();
        if content.is_empty() {
            continue;
        }

        let summary = item["summary"].as_str().map(String::from);
        let tags: Option<Vec<String>> = item["tags"].as_array().map(|arr| {
            arr.iter().filter_map(|v| v.as_str().map(String::from)).collect()
        });
        let importance = item["importance"].as_i64().map(|i| i as i32);

        // Create memory in a scope to release lock before await
        let created_memory = {
            let memory_guard = state.memory.lock().map_err(|e| e.to_string())?;
            let manager = memory_guard.as_ref().ok_or("Memory manager not initialized")?;

            let input = CreateMemoryInput {
                content: content.clone(),
                summary,
                memory_type: Some("auto".to_string()),
                tags,
                importance,
                is_pinned: Some(false),
                source_conversation_id: Some(request.conversation_id.clone()),
                source_message_ids: None,
                metadata: None,
            };

            manager.create_memory(input).ok()
        }; // Guard dropped here

        let Some(memory) = created_memory else {
            continue;
        };

        // Generate embedding for the new memory (async - guard already dropped)
        let emb_result = create_embedding(state.clone(), content, None).await?;
        if emb_result.ok {
            if let Some(emb_data) = emb_result.data {
                let memory_guard = state.memory.lock().map_err(|e| e.to_string())?;
                let manager = memory_guard.as_ref().ok_or("Memory manager not initialized")?;
                let _ = manager.store_embedding(&memory.id, &emb_data.embedding, &emb_data.model);

                // Get updated memory
                if let Ok(Some(updated)) = manager.get_memory(&memory.id) {
                    created_memories.push(updated);
                    continue;
                }
            }
        }
        created_memories.push(memory);
    }

    Ok(ApiResponse::success(created_memories))
}

#[tauri::command]
pub async fn get_memory_settings(
    state: State<'_, AppState>,
) -> Result<ApiResponse<MemorySettings>, String> {
    state.get_or_init_memory()?;

    let memory_guard = state.memory.lock().map_err(|e| e.to_string())?;
    let manager = memory_guard.as_ref().ok_or("Memory manager not initialized")?;

    let settings = manager.get_settings()?;
    Ok(ApiResponse::success(settings))
}

#[tauri::command]
pub async fn update_memory_settings(
    state: State<'_, AppState>,
    settings: UpdateSettingsRequest,
) -> Result<ApiResponse<MemorySettings>, String> {
    state.get_or_init_memory()?;

    let memory_guard = state.memory.lock().map_err(|e| e.to_string())?;
    let manager = memory_guard.as_ref().ok_or("Memory manager not initialized")?;

    let updated = manager.update_settings(
        settings.auto_extract_enabled,
        settings.extraction_model,
        settings.embedding_model,
        settings.max_memories,
        settings.context_injection_count,
        settings.similarity_threshold,
    )?;

    Ok(ApiResponse::success(updated))
}

#[tauri::command]
pub async fn get_memory_stats(
    state: State<'_, AppState>,
) -> Result<ApiResponse<MemoryStats>, String> {
    state.get_or_init_memory()?;

    let memory_guard = state.memory.lock().map_err(|e| e.to_string())?;
    let manager = memory_guard.as_ref().ok_or("Memory manager not initialized")?;

    let stats = manager.get_stats()?;
    Ok(ApiResponse::success(stats))
}
