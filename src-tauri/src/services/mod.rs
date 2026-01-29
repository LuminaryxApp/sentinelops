pub mod config;
pub mod file_service;
pub mod trash_service;
pub mod terminal_service;
pub mod memory_service;

use std::sync::Mutex;
use config::Config;
use terminal_service::TerminalManager;
use trash_service::TrashManager;
use memory_service::MemoryManager;

/// Application state shared across commands
pub struct AppState {
    pub config: Mutex<Config>,
    pub trash: Mutex<TrashManager>,
    pub terminals: Mutex<TerminalManager>,
    pub memory: Mutex<Option<MemoryManager>>,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        let workspace = config.workspace_root.clone();

        // Initialize memory manager (lazy - will be created on first use if fails here)
        let memory_manager = MemoryManager::new(&workspace).ok();

        Self {
            config: Mutex::new(config),
            trash: Mutex::new(TrashManager::new(&workspace)),
            terminals: Mutex::new(TerminalManager::new()),
            memory: Mutex::new(memory_manager),
        }
    }

    /// Get or initialize the memory manager for the current workspace
    pub fn get_or_init_memory(&self) -> Result<(), String> {
        let mut memory = self.memory.lock().map_err(|e| e.to_string())?;
        if memory.is_none() {
            let config = self.config.lock().map_err(|e| e.to_string())?;
            *memory = Some(MemoryManager::new(&config.workspace_root)?);
        }
        Ok(())
    }
}
