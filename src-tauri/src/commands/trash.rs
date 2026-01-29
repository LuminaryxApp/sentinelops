use crate::services::AppState;
use super::file_ops::ApiResponse;
use serde::Serialize;
use tauri::State;

#[derive(Debug, Serialize)]
pub struct TrashListResult {
    pub items: Vec<crate::services::trash_service::TrashMetadata>,
    pub count: usize,
}

#[tauri::command]
pub async fn move_to_trash(
    state: State<'_, AppState>,
    path: String,
) -> Result<ApiResponse<serde_json::Value>, String> {
    let config = state.config.lock().unwrap();
    let workspace = config.workspace_root.clone();
    drop(config);

    let full_path = crate::services::file_service::resolve_path(&workspace, &path)
        .map_err(|e| e.to_string())?;

    let trash = state.trash.lock().unwrap();
    let request_id = uuid::Uuid::new_v4().to_string();

    match trash.move_to_trash(&full_path, &path, &request_id) {
        Ok((trash_id, trash_path)) => Ok(ApiResponse::success(serde_json::json!({
            "trashId": trash_id,
            "trashPath": trash_path.to_string_lossy()
        }))),
        Err(e) => Ok(ApiResponse::error("TRASH_ERROR", &e.to_string())),
    }
}

#[tauri::command]
pub async fn list_trash(
    state: State<'_, AppState>,
    date: Option<String>,
) -> Result<ApiResponse<TrashListResult>, String> {
    let trash = state.trash.lock().unwrap();

    match trash.list(date.as_deref()) {
        Ok(items) => {
            let count = items.len();
            Ok(ApiResponse::success(TrashListResult { items, count }))
        }
        Err(e) => Ok(ApiResponse::error("TRASH_ERROR", &e.to_string())),
    }
}

#[tauri::command]
pub async fn restore_from_trash(
    state: State<'_, AppState>,
    trash_id: String,
    to_path: Option<String>,
) -> Result<ApiResponse<serde_json::Value>, String> {
    let trash = state.trash.lock().unwrap();

    match trash.restore(&trash_id, to_path.as_ref().map(|s| std::path::Path::new(s))) {
        Ok(restored_path) => Ok(ApiResponse::success(serde_json::json!({
            "restored": true,
            "toPath": restored_path.to_string_lossy()
        }))),
        Err(e) => Ok(ApiResponse::error("TRASH_ERROR", &e.to_string())),
    }
}

#[tauri::command]
pub async fn purge_trash(
    state: State<'_, AppState>,
    trash_id: Option<String>,
    older_than_days: Option<i64>,
) -> Result<ApiResponse<serde_json::Value>, String> {
    let trash = state.trash.lock().unwrap();

    match trash.purge(trash_id.as_deref(), older_than_days) {
        Ok(purged) => Ok(ApiResponse::success(serde_json::json!({
            "purged": purged
        }))),
        Err(e) => Ok(ApiResponse::error("TRASH_ERROR", &e.to_string())),
    }
}
