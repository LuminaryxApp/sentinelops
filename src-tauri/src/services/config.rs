use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub workspace_root: PathBuf,
    pub llm_base_url: String,
    pub llm_api_key: Option<String>,
    pub llm_proxy_url: Option<String>,
    pub llm_model: String,
    pub llm_provider: String,
    pub brave_api_key: Option<String>,
    pub max_read_size: usize,
    pub max_search_results: usize,
}

impl Config {
    pub fn new(_app_handle: &AppHandle) -> Self {
        // Default workspace to user's Desktop
        let workspace_root = dirs::desktop_dir()
            .unwrap_or_else(|| dirs::home_dir().unwrap_or_else(|| PathBuf::from(".")));

        // Default proxy URL so fresh installs work with your OpenRouter key (limits on proxy)
        const DEFAULT_PROXY_URL: &str = "https://sentinelops.onrender.com";
        let llm_proxy_url = std::env::var("LLM_PROXY_URL")
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| Some(DEFAULT_PROXY_URL.to_string()));

        let (llm_base_url, llm_api_key, llm_provider) = if llm_proxy_url.is_some() {
            let base = llm_proxy_url.as_ref().unwrap().trim_end_matches('/').to_string();
            (base, None, "Proxy".to_string())
        } else {
            let llm_base_url = std::env::var("LLM_BASE_URL")
                .unwrap_or_else(|_| "https://openrouter.ai/api/v1".to_string());
            let llm_api_key = std::env::var("LLM_API_KEY").ok();
            let llm_provider = detect_provider(&llm_base_url);
            (llm_base_url, llm_api_key, llm_provider)
        };

        let llm_model = std::env::var("LLM_MODEL")
            .unwrap_or_else(|_| "meta-llama/llama-3.1-8b-instruct".to_string());

        let brave_api_key = std::env::var("BRAVE_API_KEY").ok();

        Self {
            workspace_root,
            llm_base_url,
            llm_api_key,
            llm_proxy_url,
            llm_model,
            llm_provider,
            brave_api_key,
            max_read_size: 2 * 1024 * 1024, // 2MB
            max_search_results: 200,
        }
    }

    pub fn set_workspace(&mut self, path: PathBuf) {
        self.workspace_root = path;
    }
}

fn detect_provider(base_url: &str) -> String {
    let url = base_url.to_lowercase();
    if url.contains("openai.com") {
        "OpenAI".to_string()
    } else if url.contains("openrouter") {
        "OpenRouter".to_string()
    } else if url.contains("together") {
        "Together AI".to_string()
    } else if url.contains("groq") {
        "Groq".to_string()
    } else if url.contains("deepinfra") {
        "DeepInfra".to_string()
    } else if url.contains("anthropic") {
        "Anthropic".to_string()
    } else if url.contains("localhost") || url.contains("127.0.0.1") {
        "Local (Ollama/LM Studio)".to_string()
    } else {
        "Custom".to_string()
    }
}
