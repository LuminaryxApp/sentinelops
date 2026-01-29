use crate::services::{file_service, AppState};
use serde::Serialize;
use tauri::State;

#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub ok: bool,
    pub request_id: String,
    pub data: Option<T>,
    pub error: Option<ApiError>,
}

#[derive(Debug, Serialize)]
pub struct ApiError {
    pub code: String,
    pub message: String,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            ok: true,
            request_id: uuid::Uuid::new_v4().to_string(),
            data: Some(data),
            error: None,
        }
    }

    pub fn error(code: &str, message: &str) -> Self {
        Self {
            ok: false,
            request_id: uuid::Uuid::new_v4().to_string(),
            data: None,
            error: Some(ApiError {
                code: code.to_string(),
                message: message.to_string(),
            }),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ListResult {
    pub entries: Vec<file_service::FileEntry>,
    pub count: usize,
}

#[derive(Debug, Serialize)]
pub struct ReadResult {
    pub content: String,
    pub sha256: String,
    pub size: u64,
}

#[derive(Debug, Serialize)]
pub struct WriteResult {
    pub path: String,
    pub sha256: String,
    pub created: bool,
    #[serde(rename = "bytesWritten")]
    pub bytes_written: usize,
}

#[derive(Debug, Serialize)]
pub struct SearchResult {
    pub matches: Vec<file_service::SearchMatch>,
    pub count: usize,
    pub truncated: bool,
}

#[tauri::command]
pub async fn list_directory(
    state: State<'_, AppState>,
    path: String,
    recursive: Option<bool>,
    include_hidden: Option<bool>,
) -> Result<ApiResponse<ListResult>, String> {
    let config = state.config.lock().unwrap();
    let workspace = config.workspace_root.clone();
    drop(config);

    match file_service::list_directory(
        &workspace,
        &path,
        recursive.unwrap_or(false),
        include_hidden.unwrap_or(false),
    ) {
        Ok(entries) => {
            let count = entries.len();
            Ok(ApiResponse::success(ListResult { entries, count }))
        }
        Err(e) => Ok(ApiResponse::error("FILE_ERROR", &e.to_string())),
    }
}

#[tauri::command]
pub async fn read_file(
    state: State<'_, AppState>,
    path: String,
) -> Result<ApiResponse<ReadResult>, String> {
    let config = state.config.lock().unwrap();
    let workspace = config.workspace_root.clone();
    let max_size = config.max_read_size;
    drop(config);

    match file_service::read_file(&workspace, &path, max_size) {
        Ok((content, sha256, size)) => Ok(ApiResponse::success(ReadResult {
            content,
            sha256,
            size,
        })),
        Err(e) => Ok(ApiResponse::error("FILE_ERROR", &e.to_string())),
    }
}

#[derive(Debug, Serialize)]
pub struct ReadBinaryResult {
    pub content: String, // base64 encoded
    pub size: u64,
    #[serde(rename = "mimeType")]
    pub mime_type: String,
}

#[tauri::command]
pub async fn read_file_binary(
    state: State<'_, AppState>,
    path: String,
) -> Result<ApiResponse<ReadBinaryResult>, String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};

    let config = state.config.lock().unwrap();
    let workspace = config.workspace_root.clone();
    drop(config);

    let full_path = std::path::Path::new(&workspace).join(&path);

    match std::fs::read(&full_path) {
        Ok(bytes) => {
            let size = bytes.len() as u64;
            let content = STANDARD.encode(&bytes);

            // Detect mime type from extension
            let mime_type = match path.to_lowercase() {
                p if p.ends_with(".png") => "image/png",
                p if p.ends_with(".jpg") || p.ends_with(".jpeg") => "image/jpeg",
                p if p.ends_with(".gif") => "image/gif",
                p if p.ends_with(".webp") => "image/webp",
                p if p.ends_with(".svg") => "image/svg+xml",
                p if p.ends_with(".bmp") => "image/bmp",
                p if p.ends_with(".ico") => "image/x-icon",
                p if p.ends_with(".avif") => "image/avif",
                _ => "application/octet-stream",
            }.to_string();

            Ok(ApiResponse::success(ReadBinaryResult {
                content,
                size,
                mime_type,
            }))
        }
        Err(e) => Ok(ApiResponse::error("FILE_ERROR", &e.to_string())),
    }
}

#[tauri::command]
pub async fn write_file(
    state: State<'_, AppState>,
    path: String,
    content: String,
    create_dirs: Option<bool>,
    overwrite: Option<bool>,
) -> Result<ApiResponse<WriteResult>, String> {
    let config = state.config.lock().unwrap();
    let workspace = config.workspace_root.clone();
    drop(config);

    match file_service::write_file(
        &workspace,
        &path,
        &content,
        create_dirs.unwrap_or(true),
        overwrite.unwrap_or(true),
    ) {
        Ok((sha256, created, bytes_written)) => Ok(ApiResponse::success(WriteResult {
            path,
            sha256,
            created,
            bytes_written,
        })),
        Err(e) => Ok(ApiResponse::error("FILE_ERROR", &e.to_string())),
    }
}

#[tauri::command]
pub async fn create_directory(
    state: State<'_, AppState>,
    path: String,
    recursive: Option<bool>,
) -> Result<ApiResponse<serde_json::Value>, String> {
    let config = state.config.lock().unwrap();
    let workspace = config.workspace_root.clone();
    drop(config);

    match file_service::create_directory(&workspace, &path, recursive.unwrap_or(true)) {
        Ok(created) => Ok(ApiResponse::success(serde_json::json!({
            "path": path,
            "created": created
        }))),
        Err(e) => Ok(ApiResponse::error("FILE_ERROR", &e.to_string())),
    }
}

#[tauri::command]
pub async fn delete_path(
    state: State<'_, AppState>,
    path: String,
    recursive: Option<bool>,
    permanent: Option<bool>,
) -> Result<ApiResponse<serde_json::Value>, String> {
    let config = state.config.lock().unwrap();
    let workspace = config.workspace_root.clone();
    drop(config);

    // If not permanent, move to trash
    if !permanent.unwrap_or(false) {
        let trash = state.trash.lock().unwrap();
        let full_path = file_service::resolve_path(&workspace, &path)
            .map_err(|e| e.to_string())?;

        match trash.move_to_trash(&full_path, &path, &uuid::Uuid::new_v4().to_string()) {
            Ok((trash_id, _)) => Ok(ApiResponse::success(serde_json::json!({
                "path": path,
                "trashId": trash_id,
                "deleted": true
            }))),
            Err(e) => Ok(ApiResponse::error("TRASH_ERROR", &e.to_string())),
        }
    } else {
        match file_service::delete_path(&workspace, &path, recursive.unwrap_or(false)) {
            Ok(()) => Ok(ApiResponse::success(serde_json::json!({
                "path": path,
                "deleted": true
            }))),
            Err(e) => Ok(ApiResponse::error("FILE_ERROR", &e.to_string())),
        }
    }
}

#[tauri::command]
pub async fn move_path(
    state: State<'_, AppState>,
    from: String,
    to: String,
    overwrite: Option<bool>,
) -> Result<ApiResponse<serde_json::Value>, String> {
    let config = state.config.lock().unwrap();
    let workspace = config.workspace_root.clone();
    drop(config);

    match file_service::move_path(&workspace, &from, &to, overwrite.unwrap_or(false)) {
        Ok(()) => Ok(ApiResponse::success(serde_json::json!({
            "from": from,
            "to": to,
            "moved": true
        }))),
        Err(e) => Ok(ApiResponse::error("FILE_ERROR", &e.to_string())),
    }
}

#[tauri::command]
pub async fn copy_path(
    state: State<'_, AppState>,
    from: String,
    to: String,
    overwrite: Option<bool>,
) -> Result<ApiResponse<serde_json::Value>, String> {
    let config = state.config.lock().unwrap();
    let workspace = config.workspace_root.clone();
    drop(config);

    match file_service::copy_path(&workspace, &from, &to, overwrite.unwrap_or(false)) {
        Ok(()) => Ok(ApiResponse::success(serde_json::json!({
            "from": from,
            "to": to,
            "copied": true
        }))),
        Err(e) => Ok(ApiResponse::error("FILE_ERROR", &e.to_string())),
    }
}

#[tauri::command]
pub async fn get_stat(
    state: State<'_, AppState>,
    path: String,
    include_hash: Option<bool>,
) -> Result<ApiResponse<file_service::FileStat>, String> {
    let config = state.config.lock().unwrap();
    let workspace = config.workspace_root.clone();
    drop(config);

    match file_service::get_stat(&workspace, &path, include_hash.unwrap_or(false)) {
        Ok(stat) => Ok(ApiResponse::success(stat)),
        Err(e) => Ok(ApiResponse::error("FILE_ERROR", &e.to_string())),
    }
}

#[tauri::command]
pub async fn search_files(
    state: State<'_, AppState>,
    query: String,
    path: Option<String>,
    case_sensitive: Option<bool>,
    max_results: Option<usize>,
) -> Result<ApiResponse<SearchResult>, String> {
    let config = state.config.lock().unwrap();
    let workspace = config.workspace_root.clone();
    let default_max = config.max_search_results;
    drop(config);

    let search_path = path.unwrap_or_else(|| ".".to_string());
    let max = max_results.unwrap_or(default_max);

    match file_service::search_files(
        &workspace,
        &query,
        &search_path,
        case_sensitive.unwrap_or(false),
        max,
    ) {
        Ok(matches) => {
            let count = matches.len();
            let truncated = count >= max;
            Ok(ApiResponse::success(SearchResult {
                matches,
                count,
                truncated,
            }))
        }
        Err(e) => Ok(ApiResponse::error("SEARCH_ERROR", &e.to_string())),
    }
}

#[tauri::command]
pub async fn exists(
    state: State<'_, AppState>,
    path: String,
) -> Result<ApiResponse<bool>, String> {
    let config = state.config.lock().unwrap();
    let workspace = config.workspace_root.clone();
    drop(config);

    let exists = file_service::exists(&workspace, &path);
    Ok(ApiResponse::success(exists))
}
