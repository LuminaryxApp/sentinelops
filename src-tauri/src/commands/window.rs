use tauri::{WebviewUrl, WebviewWindowBuilder};

/// Create a new window instance
#[tauri::command]
pub async fn create_new_window(app: tauri::AppHandle) -> Result<(), String> {
    // Generate a unique label for the new window
    let label = format!("main-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("1"));

    WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::default(),
    )
    .title("SentinelOps")
    .inner_size(1400.0, 900.0)
    .min_inner_size(800.0, 600.0)
    .decorations(false)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Minimize the current window
#[tauri::command]
pub async fn minimize_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

/// Toggle window maximize/restore
#[tauri::command]
pub async fn toggle_maximize(window: tauri::Window) -> Result<(), String> {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

/// Close the application
#[tauri::command]
pub async fn exit_app(app: tauri::AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}

/// Close the current window
#[tauri::command]
pub async fn close_window(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}
