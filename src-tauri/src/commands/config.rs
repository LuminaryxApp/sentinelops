use crate::services::AppState;
use super::file_ops::ApiResponse;
use serde::Serialize;
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
        llm_configured: config.llm_api_key.is_some(),
        llm_provider: config.llm_provider.clone(),
        llm_model: config.llm_model.clone(),
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
