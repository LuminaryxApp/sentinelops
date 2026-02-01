use crate::services::config::{is_local_llm_base_url, ApiKeysConfig};
use crate::services::AppState;
use super::file_ops::ApiResponse;
use serde::{Serialize, Deserialize};
use std::path::PathBuf;
use tauri::State;

#[derive(Debug, Serialize)]
pub struct ConfigInfo {
    #[serde(rename = "workspaceRoot")]
    pub workspace_root: String,
    #[serde(rename = "llmConfigured")]
    pub llm_configured: bool,
    #[serde(rename = "llmProvider")]
    pub llm_provider: String,
    #[serde(rename = "llmModel")]
    pub llm_model: String,
    /// Base URL (for Settings UI to show/edit local model config)
    #[serde(rename = "llmBaseUrl")]
    pub llm_base_url: String,
}

#[derive(Debug, Serialize)]
pub struct AppInfo {
    pub version: String,
    pub name: String,
    pub platform: String,
}

#[tauri::command]
pub async fn get_config(
    state: State<'_, AppState>,
) -> Result<ApiResponse<ConfigInfo>, String> {
    let config = state.config.lock().unwrap();

    Ok(ApiResponse::success(ConfigInfo {
        workspace_root: config.workspace_root.to_string_lossy().to_string(),
        llm_configured: config.llm_api_key.is_some() || config.llm_proxy_url.is_some() || is_local_llm_base_url(&config.llm_base_url),
        llm_provider: config.llm_provider.clone(),
        llm_model: config.llm_model.clone(),
        llm_base_url: config.llm_base_url.clone(),
    }))
}

#[tauri::command]
pub async fn set_workspace(
    state: State<'_, AppState>,
    path: String,
) -> Result<ApiResponse<serde_json::Value>, String> {
    let new_path = PathBuf::from(&path);

    if !new_path.exists() {
        return Ok(ApiResponse::error("PATH_NOT_FOUND", "Workspace path does not exist"));
    }

    if !new_path.is_dir() {
        return Ok(ApiResponse::error("NOT_A_DIRECTORY", "Path is not a directory"));
    }

    // Update config
    {
        let mut config = state.config.lock().unwrap();
        config.set_workspace(new_path.clone());
    }

    // Update trash manager
    {
        let mut trash = state.trash.lock().unwrap();
        trash.update_workspace(&new_path);
    }

    Ok(ApiResponse::success(serde_json::json!({
        "workspaceRoot": path
    })))
}

#[tauri::command]
pub async fn set_proxy_url(
    state: State<'_, AppState>,
    proxy_url: String,
) -> Result<ApiResponse<serde_json::Value>, String> {
    let mut config = state.config.lock().unwrap();
    config.set_proxy_url(proxy_url).map_err(|e| e.to_string())?;

    Ok(ApiResponse::success(serde_json::json!({
        "llmBaseUrl": config.llm_base_url,
        "llmModel": config.llm_model,
        "llmProvider": config.llm_provider,
        "llmConfigured": true
    })))
}

#[tauri::command]
pub async fn clear_local_llm_config(state: State<'_, AppState>) -> Result<ApiResponse<serde_json::Value>, String> {
    let mut config = state.config.lock().unwrap();
    config
        .clear_local_llm_and_use_env()
        .map_err(|e| e.to_string())?;

    Ok(ApiResponse::success(serde_json::json!({
        "llmBaseUrl": config.llm_base_url,
        "llmModel": config.llm_model,
        "llmProvider": config.llm_provider,
        "llmConfigured": config.llm_api_key.is_some()
            || config.llm_proxy_url.is_some()
            || crate::services::config::is_local_llm_base_url(&config.llm_base_url)
    })))
}

#[tauri::command]
pub async fn set_local_llm_config(
    state: State<'_, AppState>,
    base_url: String,
    model: String,
) -> Result<ApiResponse<serde_json::Value>, String> {
    let mut config = state.config.lock().unwrap();
    config
        .set_local_llm(base_url, model)
        .map_err(|e| e)?;

    Ok(ApiResponse::success(serde_json::json!({
        "llmBaseUrl": config.llm_base_url,
        "llmModel": config.llm_model,
        "llmProvider": config.llm_provider
    })))
}

#[tauri::command]
pub async fn get_app_info() -> Result<ApiResponse<AppInfo>, String> {
    let platform = if cfg!(windows) {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    };

    Ok(ApiResponse::success(AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        name: "SentinelOps".to_string(),
        platform: platform.to_string(),
    }))
}

// ============================================================================
// API Keys Management
// ============================================================================

#[derive(Debug, Serialize)]
pub struct ApiKeysInfo {
    /// List of providers that have API keys configured
    #[serde(rename = "configuredProviders")]
    pub configured_providers: Vec<String>,
    /// Whether the user has any API key configured
    #[serde(rename = "hasAnyKey")]
    pub has_any_key: bool,
}

#[derive(Debug, Deserialize)]
pub struct SetApiKeyRequest {
    pub provider: String,
    pub api_key: Option<String>,
}

#[tauri::command]
pub async fn get_api_keys_info() -> Result<ApiResponse<ApiKeysInfo>, String> {
    let keys = ApiKeysConfig::load();
    Ok(ApiResponse::success(ApiKeysInfo {
        configured_providers: keys.configured_providers(),
        has_any_key: keys.has_any_key(),
    }))
}

#[tauri::command]
pub async fn set_api_key(
    provider: String,
    api_key: Option<String>,
) -> Result<ApiResponse<ApiKeysInfo>, String> {
    let mut keys = ApiKeysConfig::load();

    // Validate the key is not empty string if Some
    let key_to_set = api_key.filter(|k| !k.trim().is_empty());

    keys.set_key(&provider, key_to_set);
    keys.save().map_err(|e| e.to_string())?;

    Ok(ApiResponse::success(ApiKeysInfo {
        configured_providers: keys.configured_providers(),
        has_any_key: keys.has_any_key(),
    }))
}

#[tauri::command]
pub async fn get_api_key_for_provider(provider: String) -> Result<ApiResponse<serde_json::Value>, String> {
    let keys = ApiKeysConfig::load();
    let has_key = keys.get_key(&provider).is_some();

    // Don't return the actual key for security, just whether it exists
    Ok(ApiResponse::success(serde_json::json!({
        "provider": provider,
        "hasKey": has_key
    })))
}

#[tauri::command]
pub async fn clear_api_key(provider: String) -> Result<ApiResponse<ApiKeysInfo>, String> {
    let mut keys = ApiKeysConfig::load();
    keys.set_key(&provider, None);
    keys.save().map_err(|e| e.to_string())?;

    Ok(ApiResponse::success(ApiKeysInfo {
        configured_providers: keys.configured_providers(),
        has_any_key: keys.has_any_key(),
    }))
}

/// Internal function to get API key for LLM service
pub fn get_api_key_internal(provider: &str) -> Option<String> {
    let keys = ApiKeysConfig::load();
    keys.get_key(provider)
}
