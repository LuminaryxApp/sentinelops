use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;
use tauri::AppHandle;

/// User-saved LLM config. Stored in app config dir.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmUserConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    /// When set, use this URL as proxy (OpenRouter via proxy). Takes precedence.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proxy_url: Option<String>,
    /// Active provider (openrouter, openai, anthropic, google, local)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_provider: Option<String>,
}

/// API keys for different AI providers. Stored separately for security.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ApiKeysConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub openrouter: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub openai: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anthropic: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub google: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub groq: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub together: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deepseek: Option<String>,
}

fn llm_config_path() -> Option<PathBuf> {
    dirs::config_dir().map(|d| d.join("SentinelOps").join("llm_config.json"))
}

fn api_keys_path() -> Option<PathBuf> {
    dirs::config_dir().map(|d| d.join("SentinelOps").join("api_keys.json"))
}

impl ApiKeysConfig {
    pub fn load() -> Self {
        if let Some(path) = api_keys_path() {
            if path.exists() {
                if let Ok(json) = fs::read_to_string(&path) {
                    if let Ok(config) = serde_json::from_str(&json) {
                        return config;
                    }
                }
            }
        }
        Self::default()
    }

    pub fn save(&self) -> Result<(), String> {
        if let Some(path) = api_keys_path() {
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let json = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
            fs::write(&path, json).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn get_key(&self, provider: &str) -> Option<String> {
        match provider.to_lowercase().as_str() {
            "openrouter" => self.openrouter.clone(),
            "openai" => self.openai.clone(),
            "anthropic" => self.anthropic.clone(),
            "google" => self.google.clone(),
            "groq" => self.groq.clone(),
            "together" => self.together.clone(),
            "deepseek" => self.deepseek.clone(),
            _ => None,
        }
    }

    pub fn set_key(&mut self, provider: &str, key: Option<String>) {
        match provider.to_lowercase().as_str() {
            "openrouter" => self.openrouter = key,
            "openai" => self.openai = key,
            "anthropic" => self.anthropic = key,
            "google" => self.google = key,
            "groq" => self.groq = key,
            "together" => self.together = key,
            "deepseek" => self.deepseek = key,
            _ => {}
        }
    }

    pub fn has_any_key(&self) -> bool {
        self.openrouter.is_some() ||
        self.openai.is_some() ||
        self.anthropic.is_some() ||
        self.google.is_some() ||
        self.groq.is_some() ||
        self.together.is_some() ||
        self.deepseek.is_some()
    }

    pub fn configured_providers(&self) -> Vec<String> {
        let mut providers = Vec::new();
        if self.openrouter.is_some() { providers.push("openrouter".to_string()); }
        if self.openai.is_some() { providers.push("openai".to_string()); }
        if self.anthropic.is_some() { providers.push("anthropic".to_string()); }
        if self.google.is_some() { providers.push("google".to_string()); }
        if self.groq.is_some() { providers.push("groq".to_string()); }
        if self.together.is_some() { providers.push("together".to_string()); }
        if self.deepseek.is_some() { providers.push("deepseek".to_string()); }
        providers
    }
}

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

        let brave_api_key = std::env::var("BRAVE_API_KEY").ok();

        // 1. Check for user-saved config (from Settings in the app)
        if let Some(path) = llm_config_path() {
            if path.exists() {
                if let Ok(json) = fs::read_to_string(&path) {
                    if let Ok(user) = serde_json::from_str::<LlmUserConfig>(&json) {
                        // Proxy mode: user chose to use OpenRouter/proxy
                        if let Some(ref proxy) = user.proxy_url {
                            let base = proxy.trim().trim_end_matches('/').to_string();
                            if !base.is_empty() {
                                return Self {
                                    workspace_root,
                                    llm_base_url: base.clone(),
                                    llm_api_key: None,
                                    llm_proxy_url: Some(base),
                                    llm_model: std::env::var("LLM_MODEL")
                                        .unwrap_or_else(|_| "meta-llama/llama-3.1-8b-instruct".to_string()),
                                    llm_provider: "Proxy".to_string(),
                                    brave_api_key,
                                    max_read_size: 2 * 1024 * 1024,
                                    max_search_results: 200,
                                };
                            }
                        }
                        // Local mode: Ollama, LM Studio
                        if let Some(ref base_url) = user.base_url {
                            let base = base_url.trim().trim_end_matches('/').to_string();
                            if !base.is_empty() {
                                let model = user.model.as_ref()
                                    .map(|m| m.trim().to_string())
                                    .unwrap_or_else(|| "llama3.2".to_string());
                                let model = if model.is_empty() { "llama3.2".to_string() } else { model };
                                let provider = detect_provider(&base);
                                return Self {
                                    workspace_root,
                                    llm_base_url: base,
                                    llm_api_key: None,
                                    llm_proxy_url: None,
                                    llm_model: model,
                                    llm_provider: provider,
                                    brave_api_key,
                                    max_read_size: 2 * 1024 * 1024,
                                    max_search_results: 200,
                                };
                            }
                        }
                    }
                }
            }
        }

        // 2. Fall back to env vars
        const DEFAULT_PROXY_URL: &str = "https://sentinelops.onrender.com";
        let explicit_proxy = std::env::var("LLM_PROXY_URL").ok().filter(|s| !s.is_empty());
        let explicit_base = std::env::var("LLM_BASE_URL").ok().filter(|s| !s.is_empty());
        let llm_proxy_url = explicit_proxy.or_else(|| {
            if explicit_base.as_ref().map_or(false, |b| is_local_llm_base_url(b)) {
                None
            } else {
                Some(DEFAULT_PROXY_URL.to_string())
            }
        });

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

        let llm_model = std::env::var("LLM_MODEL").unwrap_or_else(|_| {
            if is_local_llm_base_url(&llm_base_url) {
                "llama3.2".to_string()
            } else {
                "meta-llama/llama-3.1-8b-instruct".to_string()
            }
        });

        Self {
            workspace_root,
            llm_base_url,
            llm_api_key,
            llm_proxy_url,
            llm_model,
            llm_provider,
            brave_api_key,
            max_read_size: 2 * 1024 * 1024,
            max_search_results: 200,
        }
    }

    /// Save local model config from the app. Creates config dir if needed.
    pub fn set_local_llm(&mut self, base_url: String, model: String) -> Result<(), String> {
        let base = normalize_base_url_for_openai_api(&base_url);
        let model = model.trim().to_string();
        if base.is_empty() {
            return Err("URL cannot be empty".to_string());
        }
        if model.is_empty() {
            return Err("Model name cannot be empty".to_string());
        }

        self.llm_base_url = base.clone();
        self.llm_model = model.clone();
        self.llm_api_key = None;
        self.llm_proxy_url = None;
        self.llm_provider = detect_provider(&base);

        if let Some(path) = llm_config_path() {
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let json = serde_json::to_string_pretty(&LlmUserConfig {
                base_url: Some(base),
                model: Some(model),
                proxy_url: None,
                active_provider: None,
            })
            .map_err(|e| e.to_string())?;
            fs::write(&path, json).map_err(|e| e.to_string())?;
        }

        Ok(())
    }

    /// Save proxy URL from the app (use OpenRouter via proxy). Overrides local config.
    pub fn set_proxy_url(&mut self, proxy_url: String) -> Result<(), String> {
        let url = proxy_url.trim().trim_end_matches('/').to_string();
        if url.is_empty() {
            return Err("Proxy URL cannot be empty".to_string());
        }

        self.llm_base_url = url.clone();
        self.llm_proxy_url = Some(url.clone());
        self.llm_api_key = None;
        self.llm_provider = "Proxy".to_string();
        self.llm_model = std::env::var("LLM_MODEL")
            .unwrap_or_else(|_| "meta-llama/llama-3.1-8b-instruct".to_string());

        if let Some(path) = llm_config_path() {
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let json = serde_json::to_string_pretty(&LlmUserConfig {
                base_url: None,
                model: None,
                proxy_url: Some(url),
                active_provider: None,
            })
            .map_err(|e| e.to_string())?;
            fs::write(&path, json).map_err(|e| e.to_string())?;
        }

        Ok(())
    }

    pub fn set_workspace(&mut self, path: PathBuf) {
        self.workspace_root = path;
    }

    /// Clear user-saved local config and reload from env (LLM_PROXY_URL, LLM_API_KEY, LLM_BASE_URL, LLM_MODEL)
    pub fn clear_local_llm_and_use_env(&mut self) -> Result<(), String> {
        if let Some(path) = llm_config_path() {
            if path.exists() {
                fs::remove_file(&path).map_err(|e| e.to_string())?;
            }
        }
        self.apply_env_llm_config();
        Ok(())
    }

    fn apply_env_llm_config(&mut self) {
        const DEFAULT_PROXY_URL: &str = "https://sentinelops.onrender.com";
        let explicit_proxy = std::env::var("LLM_PROXY_URL").ok().filter(|s| !s.is_empty());
        let explicit_base = std::env::var("LLM_BASE_URL").ok().filter(|s| !s.is_empty());
        let llm_proxy_url = explicit_proxy.or_else(|| {
            if explicit_base.as_ref().map_or(false, |b| is_local_llm_base_url(b)) {
                None
            } else {
                Some(DEFAULT_PROXY_URL.to_string())
            }
        });

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

        let llm_model = std::env::var("LLM_MODEL").unwrap_or_else(|_| {
            if is_local_llm_base_url(&llm_base_url) {
                "llama3.2".to_string()
            } else {
                "meta-llama/llama-3.1-8b-instruct".to_string()
            }
        });

        self.llm_base_url = llm_base_url;
        self.llm_api_key = llm_api_key;
        self.llm_proxy_url = llm_proxy_url;
        self.llm_model = llm_model;
        self.llm_provider = llm_provider;
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

/// True when the LLM base URL is a local server (Ollama, LM Studio, etc.) that typically needs no API key.
pub fn is_local_llm_base_url(url: &str) -> bool {
    let u = url.to_lowercase();
    u.contains("localhost") || u.contains("127.0.0.1")
}

/// LM Studio and Ollama's OpenAI-compatible API live at /v1/chat/completions.
/// If the base URL is local and doesn't end with /v1, append it to avoid "Unexpected endpoint" errors.
pub fn normalize_base_url_for_openai_api(base: &str) -> String {
    let b = base.trim().trim_end_matches('/');
    if b.is_empty() {
        return base.to_string();
    }
    let lower = b.to_lowercase();
    if (lower.contains("localhost") || lower.contains("127.0.0.1")) && !lower.ends_with("/v1") {
        format!("{}/v1", b)
    } else {
        b.to_string()
    }
}
