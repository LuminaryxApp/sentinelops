mod commands;
mod services;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env file - try multiple locations
    let env_paths = [
        ".env",
        "../.env",
        "../../.env",
    ];

    for path in env_paths {
        if std::path::Path::new(path).exists() {
            if dotenvy::from_filename(path).is_ok() {
                println!("Loaded .env from: {}", path);
                break;
            }
        }
    }

    // Debug: print LLM config status
    println!("LLM_API_KEY configured: {}", std::env::var("LLM_API_KEY").is_ok());
    println!("LLM_BASE_URL: {:?}", std::env::var("LLM_BASE_URL").ok());
    println!("LLM_MODEL: {:?}", std::env::var("LLM_MODEL").ok());

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init());

    // Add updater plugin (only on desktop)
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .setup(|app| {
            // Initialize services
            let app_handle = app.handle().clone();
            let config = services::config::Config::new(&app_handle);
            app.manage(services::AppState::new(config));

            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // File operations
            commands::file_ops::list_directory,
            commands::file_ops::read_file,
            commands::file_ops::read_file_binary,
            commands::file_ops::write_file,
            commands::file_ops::create_directory,
            commands::file_ops::delete_path,
            commands::file_ops::move_path,
            commands::file_ops::copy_path,
            commands::file_ops::get_stat,
            commands::file_ops::search_files,
            commands::file_ops::exists,
            // Trash operations
            commands::trash::move_to_trash,
            commands::trash::list_trash,
            commands::trash::restore_from_trash,
            commands::trash::purge_trash,
            // Git operations
            commands::git::git_status,
            commands::git::git_stage,
            commands::git::git_unstage,
            commands::git::git_commit,
            commands::git::git_diff,
            commands::git::git_branches,
            commands::git::git_checkout,
            commands::git::git_log,
            // Terminal operations
            commands::terminal::execute_command,
            commands::terminal::kill_terminal,
            commands::terminal::get_terminal_output,
            commands::terminal::list_available_shells,
            // Config operations
            commands::config::get_config,
            commands::config::set_workspace,
            commands::config::get_app_info,
            // LLM operations
            commands::llm::test_llm_connection,
            commands::llm::chat_completion,
            commands::llm::chat_completion_with_tools,
            commands::llm::generate_image,
            commands::llm::create_embedding,
            commands::llm::batch_create_embeddings,
            // Memory operations
            commands::memory::create_memory,
            commands::memory::get_memory,
            commands::memory::update_memory,
            commands::memory::delete_memory,
            commands::memory::list_memories,
            commands::memory::search_memories,
            commands::memory::get_relevant_memories,
            commands::memory::extract_memories,
            commands::memory::get_memory_settings,
            commands::memory::update_memory_settings,
            commands::memory::get_memory_stats,
            // Extension operations
            commands::extensions::list_vscode_extensions,
            commands::extensions::list_installed_extensions,
            commands::extensions::search_openvsx,
            commands::extensions::get_openvsx_extension,
            commands::extensions::install_extension,
            commands::extensions::uninstall_extension,
            commands::extensions::load_extension_contributions,
            commands::extensions::load_theme_file,
            commands::extensions::load_icon_theme_file,
            commands::extensions::load_grammar_file,
            commands::extensions::load_extension_readme,
            commands::extensions::load_extension_icon,
            commands::extensions::load_snippets_file,
            commands::extensions::get_extension_settings,
            commands::extensions::set_extension_setting,
            commands::extensions::reset_extension_setting,
            // Search operations
            commands::search::web_search,
            // SQLite operations
            commands::sqlite::sqlite_get_schema,
            commands::sqlite::sqlite_get_columns,
            commands::sqlite::sqlite_get_indexes,
            commands::sqlite::sqlite_execute_query,
            commands::sqlite::sqlite_get_table_data,
            // Window operations
            commands::window::create_new_window,
            commands::window::minimize_window,
            commands::window::toggle_maximize,
            commands::window::exit_app,
            commands::window::close_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
