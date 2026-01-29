use super::file_ops::ApiResponse;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionInfo {
    pub id: String,
    pub name: String,
    pub publisher: String,
    pub version: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub installed: bool,
    pub path: Option<String>,
    // Rich metadata from Open-VSX
    pub download_count: Option<u64>,
    pub average_rating: Option<f32>,
    pub review_count: Option<u32>,
    pub repository: Option<String>,
    pub homepage: Option<String>,
    pub license: Option<String>,
    pub categories: Option<Vec<String>>,
    pub tags: Option<Vec<String>>,
    pub last_updated: Option<String>,
    pub preview: Option<bool>,
}

// ============================================================================
// Extension Contributions Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionContributions {
    pub themes: Vec<ThemeContribution>,
    pub icon_themes: Vec<IconThemeContribution>,
    pub grammars: Vec<GrammarContribution>,
    pub languages: Vec<LanguageContribution>,
    pub snippets: Vec<SnippetContribution>,
    pub configuration: Vec<ExtensionConfiguration>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionConfiguration {
    pub extension_id: String,
    pub extension_name: String,
    pub title: Option<String>,
    pub properties: HashMap<String, ConfigurationProperty>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigurationProperty {
    #[serde(rename = "type")]
    pub prop_type: Option<String>,
    pub default: Option<serde_json::Value>,
    pub description: Option<String>,
    pub markdown_description: Option<String>,
    #[serde(rename = "enum")]
    pub enum_values: Option<Vec<serde_json::Value>>,
    pub enum_descriptions: Option<Vec<String>>,
    pub minimum: Option<f64>,
    pub maximum: Option<f64>,
    pub pattern: Option<String>,
    pub deprecated: Option<bool>,
    pub deprecation_message: Option<String>,
    pub scope: Option<String>,
    pub order: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeContribution {
    pub id: String,
    pub label: String,
    pub ui_theme: String, // "vs-dark", "vs", "hc-black"
    pub path: String,     // Absolute path to theme JSON
    pub extension_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IconThemeContribution {
    pub id: String,
    pub label: String,
    pub path: String, // Absolute path to icon theme JSON
    pub extension_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GrammarContribution {
    pub language: Option<String>,
    pub scope_name: String,
    pub path: String, // Absolute path to grammar file
    pub extension_id: String,
    pub embedded_languages: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LanguageContribution {
    pub id: String,
    pub extensions: Vec<String>,
    pub aliases: Vec<String>,
    pub configuration: Option<String>, // Absolute path to language config
    pub extension_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnippetContribution {
    pub language: String,
    pub path: String, // Absolute path to snippets file
    pub extension_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeColors {
    pub colors: HashMap<String, String>,
    pub token_colors: Vec<TokenColor>,
    pub name: Option<String>,
    #[serde(rename = "type")]
    pub theme_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenColor {
    pub name: Option<String>,
    pub scope: Option<serde_json::Value>, // Can be string or array
    pub settings: TokenColorSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenColorSettings {
    pub foreground: Option<String>,
    pub background: Option<String>,
    pub font_style: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ExtensionListResult {
    pub extensions: Vec<ExtensionInfo>,
    pub count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OpenVsxExtension {
    pub name: String,
    pub namespace: String,
    pub version: String,
    pub description: Option<String>,
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    #[serde(rename = "iconUrl")]
    pub icon_url: Option<String>,
    #[serde(rename = "downloadUrl")]
    pub download_url: Option<String>,
}

/// Get the VSCode extensions directory based on the platform
fn get_vscode_extensions_dir() -> Option<PathBuf> {
    let home = dirs::home_dir()?;

    #[cfg(target_os = "windows")]
    {
        Some(home.join(".vscode").join("extensions"))
    }

    #[cfg(target_os = "macos")]
    {
        Some(home.join(".vscode").join("extensions"))
    }

    #[cfg(target_os = "linux")]
    {
        Some(home.join(".vscode").join("extensions"))
    }
}

/// Get SentinelOps extensions directory
fn get_sentinelops_extensions_dir() -> Option<PathBuf> {
    let home = dirs::home_dir()?;

    #[cfg(target_os = "windows")]
    {
        Some(home.join(".sentinelops").join("extensions"))
    }

    #[cfg(not(target_os = "windows"))]
    {
        Some(home.join(".sentinelops").join("extensions"))
    }
}

/// Resolve localization placeholder from package.nls.json
fn resolve_localization(value: &str, nls: &Option<serde_json::Value>) -> String {
    // Check if it's a localization placeholder like %displayName% or %extension.description%
    if value.starts_with('%') && value.ends_with('%') && value.len() > 2 {
        let key = &value[1..value.len()-1]; // Remove % from both ends
        if let Some(nls_data) = nls {
            if let Some(resolved) = nls_data[key].as_str() {
                return resolved.to_string();
            }
        }
    }
    value.to_string()
}

/// Read extension manifest (package.json)
fn read_extension_manifest(ext_path: &PathBuf) -> Option<ExtensionInfo> {
    let package_json = ext_path.join("package.json");
    if !package_json.exists() {
        return None;
    }

    let content = fs::read_to_string(&package_json).ok()?;
    let manifest: serde_json::Value = serde_json::from_str(&content).ok()?;

    // Try to load localization file (package.nls.json)
    let nls_path = ext_path.join("package.nls.json");
    let nls: Option<serde_json::Value> = if nls_path.exists() {
        fs::read_to_string(&nls_path)
            .ok()
            .and_then(|c| serde_json::from_str(&c).ok())
    } else {
        None
    };

    let name = manifest["name"].as_str()?.to_string();
    let publisher = manifest["publisher"].as_str().unwrap_or("unknown").to_string();
    let version = manifest["version"].as_str().unwrap_or("0.0.0").to_string();

    // Resolve display name - could be a localization placeholder
    let display_name = manifest["displayName"].as_str().map(|s| resolve_localization(s, &nls));

    // Resolve description - could be a localization placeholder
    let description = manifest["description"].as_str().map(|s| resolve_localization(s, &nls));

    // Try to get icon and convert to base64 data URL
    let icon = manifest["icon"].as_str().and_then(|icon_path| {
        let full_path = ext_path.join(icon_path);
        if full_path.exists() {
            // Read file and convert to base64 data URL
            if let Ok(bytes) = fs::read(&full_path) {
                use base64::{Engine as _, engine::general_purpose::STANDARD};
                let base64_data = STANDARD.encode(&bytes);
                let mime = if icon_path.ends_with(".svg") {
                    "image/svg+xml"
                } else if icon_path.ends_with(".png") {
                    "image/png"
                } else if icon_path.ends_with(".jpg") || icon_path.ends_with(".jpeg") {
                    "image/jpeg"
                } else {
                    "image/png"
                };
                Some(format!("data:{};base64,{}", mime, base64_data))
            } else {
                None
            }
        } else {
            None
        }
    });

    Some(ExtensionInfo {
        id: format!("{}.{}", publisher, name),
        name: display_name.unwrap_or(name),
        publisher,
        version,
        description,
        icon,
        installed: true,
        path: Some(ext_path.to_string_lossy().to_string()),
        // Local extensions don't have these fields
        download_count: None,
        average_rating: None,
        review_count: None,
        repository: None,
        homepage: None,
        license: None,
        categories: None,
        tags: None,
        last_updated: None,
        preview: None,
    })
}

/// List all extensions installed in VSCode
#[tauri::command]
pub async fn list_vscode_extensions() -> Result<ApiResponse<ExtensionListResult>, String> {
    let extensions_dir = match get_vscode_extensions_dir() {
        Some(dir) => dir,
        None => return Ok(ApiResponse::error("NOT_FOUND", "Could not find VSCode extensions directory")),
    };

    if !extensions_dir.exists() {
        return Ok(ApiResponse::success(ExtensionListResult {
            extensions: vec![],
            count: 0,
        }));
    }

    let mut extensions = Vec::new();

    if let Ok(entries) = fs::read_dir(&extensions_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(ext_info) = read_extension_manifest(&path) {
                    extensions.push(ext_info);
                }
            }
        }
    }

    // Sort by name
    extensions.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    let count = extensions.len();
    Ok(ApiResponse::success(ExtensionListResult { extensions, count }))
}

/// List extensions installed in SentinelOps
#[tauri::command]
pub async fn list_installed_extensions() -> Result<ApiResponse<ExtensionListResult>, String> {
    let extensions_dir = match get_sentinelops_extensions_dir() {
        Some(dir) => dir,
        None => return Ok(ApiResponse::error("NOT_FOUND", "Could not find extensions directory")),
    };

    if !extensions_dir.exists() {
        return Ok(ApiResponse::success(ExtensionListResult {
            extensions: vec![],
            count: 0,
        }));
    }

    let mut extensions = Vec::new();

    if let Ok(entries) = fs::read_dir(&extensions_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(ext_info) = read_extension_manifest(&path) {
                    extensions.push(ext_info);
                }
            }
        }
    }

    extensions.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    let count = extensions.len();
    Ok(ApiResponse::success(ExtensionListResult { extensions, count }))
}

/// Search for extensions on Open-VSX
#[tauri::command]
pub async fn search_openvsx(query: String) -> Result<ApiResponse<ExtensionListResult>, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "https://open-vsx.org/api/-/search?query={}&size=100",
        urlencoding::encode(&query)
    );

    match client.get(&url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                let json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;

                let mut extensions = Vec::new();

                if let Some(results) = json["extensions"].as_array() {
                    for ext in results {
                        let namespace = ext["namespace"].as_str().unwrap_or("").to_string();
                        let name = ext["name"].as_str().unwrap_or("").to_string();
                        let display_name = ext["displayName"].as_str().map(|s| s.to_string());
                        let version = ext["version"].as_str().unwrap_or("0.0.0").to_string();
                        let description = ext["description"].as_str().map(|s| s.to_string());

                        // Try multiple icon locations - Open-VSX API can have it in different places
                        let icon_url = ext["files"]["icon"].as_str()
                            .or_else(|| ext["iconUrl"].as_str())
                            .map(|s| s.to_string());

                        // Rich metadata
                        let download_count = ext["downloadCount"].as_u64();
                        let average_rating = ext["averageRating"].as_f64().map(|f| f as f32);
                        let review_count = ext["reviewCount"].as_u64().map(|u| u as u32);
                        let repository = ext["repository"].as_str().map(|s| s.to_string());
                        let license = ext["license"].as_str().map(|s| s.to_string());
                        let categories: Option<Vec<String>> = ext["categories"].as_array()
                            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect());
                        let tags: Option<Vec<String>> = ext["tags"].as_array()
                            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect());
                        let last_updated = ext["timestamp"].as_str().map(|s| s.to_string());
                        let preview = ext["preRelease"].as_bool();

                        if !namespace.is_empty() && !name.is_empty() {
                            extensions.push(ExtensionInfo {
                                id: format!("{}.{}", namespace, name),
                                name: display_name.unwrap_or(name),
                                publisher: namespace,
                                version,
                                description,
                                icon: icon_url,
                                installed: false,
                                path: None,
                                download_count,
                                average_rating,
                                review_count,
                                repository,
                                homepage: None,
                                license,
                                categories,
                                tags,
                                last_updated,
                                preview,
                            });
                        }
                    }
                }

                let count = extensions.len();
                Ok(ApiResponse::success(ExtensionListResult { extensions, count }))
            } else {
                Ok(ApiResponse::error("API_ERROR", "Failed to search Open-VSX"))
            }
        }
        Err(e) => Ok(ApiResponse::error("NETWORK_ERROR", &e.to_string())),
    }
}

/// Get extension details from Open-VSX
#[tauri::command]
pub async fn get_openvsx_extension(extension_id: String) -> Result<ApiResponse<ExtensionInfo>, String> {
    let id_clone = extension_id.clone();
    let parts: Vec<&str> = extension_id.split('.').collect();
    if parts.len() < 2 {
        return Ok(ApiResponse::error("INVALID_ID", "Extension ID must be in format: publisher.name"));
    }

    let publisher = parts[0].to_string();
    let name = parts[1..].join(".");

    let client = reqwest::Client::new();
    let url = format!("https://open-vsx.org/api/{}/{}", publisher, name);

    match client.get(&url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                let json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;

                // Extract rich metadata
                let download_count = json["downloadCount"].as_u64();
                let average_rating = json["averageRating"].as_f64().map(|f| f as f32);
                let review_count = json["reviewCount"].as_u64().map(|u| u as u32);
                let repository = json["repository"].as_str().map(|s| s.to_string());
                let homepage = json["homepage"].as_str().map(|s| s.to_string());
                let license = json["license"].as_str().map(|s| s.to_string());
                let categories: Option<Vec<String>> = json["categories"].as_array()
                    .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect());
                let tags: Option<Vec<String>> = json["tags"].as_array()
                    .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect());
                let last_updated = json["timestamp"].as_str().map(|s| s.to_string());
                let preview = json["preRelease"].as_bool();

                let ext = ExtensionInfo {
                    id: id_clone,
                    name: json["displayName"].as_str().unwrap_or(&name).to_string(),
                    publisher: json["namespace"].as_str().unwrap_or(&publisher).to_string(),
                    version: json["version"].as_str().unwrap_or("0.0.0").to_string(),
                    description: json["description"].as_str().map(|s| s.to_string()),
                    icon: json["files"]["icon"].as_str().map(|s| s.to_string()),
                    installed: false,
                    path: None,
                    download_count,
                    average_rating,
                    review_count,
                    repository,
                    homepage,
                    license,
                    categories,
                    tags,
                    last_updated,
                    preview,
                };

                Ok(ApiResponse::success(ext))
            } else if response.status() == 404 {
                Ok(ApiResponse::error("NOT_FOUND", "Extension not found on Open-VSX"))
            } else {
                Ok(ApiResponse::error("API_ERROR", "Failed to get extension details"))
            }
        }
        Err(e) => Ok(ApiResponse::error("NETWORK_ERROR", &e.to_string())),
    }
}

/// Install extension from Open-VSX
#[tauri::command]
pub async fn install_extension(extension_id: String) -> Result<ApiResponse<ExtensionInfo>, String> {
    let id_clone = extension_id.clone();
    let parts: Vec<&str> = extension_id.split('.').collect();
    if parts.len() < 2 {
        return Ok(ApiResponse::error("INVALID_ID", "Extension ID must be in format: publisher.name"));
    }

    let publisher = parts[0].to_string();
    let name = parts[1..].join(".");

    // Get extension info first
    let client = reqwest::Client::new();
    let url = format!("https://open-vsx.org/api/{}/{}", publisher, name);

    let ext_info: serde_json::Value = match client.get(&url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                response.json().await.map_err(|e| e.to_string())?
            } else {
                return Ok(ApiResponse::error("NOT_FOUND", "Extension not found"));
            }
        }
        Err(e) => return Ok(ApiResponse::error("NETWORK_ERROR", &e.to_string())),
    };

    // Get download URL
    let download_url = ext_info["files"]["download"].as_str()
        .ok_or_else(|| "No download URL found".to_string())?;

    let version = ext_info["version"].as_str().unwrap_or("0.0.0");

    // Create extensions directory
    let extensions_dir = get_sentinelops_extensions_dir()
        .ok_or_else(|| "Could not find extensions directory".to_string())?;

    fs::create_dir_all(&extensions_dir).map_err(|e| e.to_string())?;

    // Download the VSIX file
    let vsix_response = client.get(download_url).send().await.map_err(|e| e.to_string())?;
    let vsix_bytes = vsix_response.bytes().await.map_err(|e| e.to_string())?;

    // Extract to extensions directory
    let ext_dir_name = format!("{}.{}-{}", publisher, name, version);
    let ext_path = extensions_dir.join(&ext_dir_name);

    // Remove old version if exists
    if ext_path.exists() {
        fs::remove_dir_all(&ext_path).map_err(|e| e.to_string())?;
    }

    // Create extension directory
    fs::create_dir_all(&ext_path).map_err(|e| e.to_string())?;

    // Extract VSIX (it's a ZIP file)
    let cursor = std::io::Cursor::new(vsix_bytes.to_vec());
    let mut archive = zip::ZipArchive::new(cursor).map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = match file.enclosed_name() {
            Some(path) => {
                // VSIX files have content in "extension/" subdirectory
                let path_str = path.to_string_lossy();
                if path_str.starts_with("extension/") {
                    ext_path.join(path_str.strip_prefix("extension/").unwrap_or(&path_str))
                } else {
                    continue; // Skip non-extension files
                }
            }
            None => continue,
        };

        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(p).map_err(|e| e.to_string())?;
                }
            }
            let mut outfile = fs::File::create(&outpath).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }

    // Read the installed extension info
    let installed_ext = read_extension_manifest(&ext_path)
        .unwrap_or(ExtensionInfo {
            id: id_clone,
            name: name.clone(),
            publisher: publisher.clone(),
            version: version.to_string(),
            description: None,
            icon: None,
            installed: true,
            path: Some(ext_path.to_string_lossy().to_string()),
            download_count: None,
            average_rating: None,
            review_count: None,
            repository: None,
            homepage: None,
            license: None,
            categories: None,
            tags: None,
            last_updated: None,
            preview: None,
        });

    Ok(ApiResponse::success(installed_ext))
}

/// Uninstall extension
#[tauri::command]
pub async fn uninstall_extension(extension_id: String) -> Result<ApiResponse<bool>, String> {
    let extensions_dir = get_sentinelops_extensions_dir()
        .ok_or_else(|| "Could not find extensions directory".to_string())?;

    if !extensions_dir.exists() {
        return Ok(ApiResponse::error("NOT_FOUND", "Extension not installed"));
    }

    // Find and remove the extension directory
    if let Ok(entries) = fs::read_dir(&extensions_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let dir_name = path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("");

                // Check if this directory matches the extension ID
                if dir_name.to_lowercase().starts_with(&extension_id.to_lowercase()) {
                    fs::remove_dir_all(&path).map_err(|e| e.to_string())?;
                    return Ok(ApiResponse::success(true));
                }
            }
        }
    }

    Ok(ApiResponse::error("NOT_FOUND", "Extension not found"))
}

// ============================================================================
// Extension Contributions Loading
// ============================================================================

/// Load all contributions from installed extensions (both SentinelOps and VSCode directories)
#[tauri::command]
pub async fn load_extension_contributions() -> Result<ApiResponse<ExtensionContributions>, String> {
    let mut contributions = ExtensionContributions::default();

    // Scan both SentinelOps and VSCode extensions directories
    let dirs_to_scan: Vec<PathBuf> = vec![
        get_sentinelops_extensions_dir(),
        get_vscode_extensions_dir(),
    ].into_iter().flatten().collect();

    for extensions_dir in dirs_to_scan {
        if !extensions_dir.exists() {
            continue;
        }

        if let Ok(entries) = fs::read_dir(&extensions_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    if let Some(ext_contributions) = read_extension_contributions(&path) {
                        contributions.themes.extend(ext_contributions.themes);
                        contributions.icon_themes.extend(ext_contributions.icon_themes);
                        contributions.grammars.extend(ext_contributions.grammars);
                        contributions.languages.extend(ext_contributions.languages);
                        contributions.snippets.extend(ext_contributions.snippets);
                        contributions.configuration.extend(ext_contributions.configuration);
                    }
                }
            }
        }
    }

    Ok(ApiResponse::success(contributions))
}

/// Read contributions from a single extension
fn read_extension_contributions(ext_path: &PathBuf) -> Option<ExtensionContributions> {
    let package_json = ext_path.join("package.json");
    if !package_json.exists() {
        return None;
    }

    let content = fs::read_to_string(&package_json).ok()?;
    let manifest: serde_json::Value = serde_json::from_str(&content).ok()?;

    let publisher = manifest["publisher"].as_str().unwrap_or("unknown");
    let name = manifest["name"].as_str().unwrap_or("unknown");
    let extension_id = format!("{}.{}", publisher, name);

    let contributes = manifest.get("contributes")?;
    let mut contributions = ExtensionContributions::default();

    // Load themes
    if let Some(themes) = contributes["themes"].as_array() {
        for theme in themes {
            let label = theme["label"].as_str().unwrap_or("").to_string();
            let id = theme["id"].as_str().unwrap_or(&label).to_string();
            let ui_theme = theme["uiTheme"].as_str().unwrap_or("vs-dark").to_string();

            if let Some(path) = theme["path"].as_str() {
                let full_path = ext_path.join(path);
                if full_path.exists() {
                    contributions.themes.push(ThemeContribution {
                        id: id.clone(),
                        label,
                        ui_theme,
                        path: full_path.to_string_lossy().to_string(),
                        extension_id: extension_id.clone(),
                    });
                }
            }
        }
    }

    // Load icon themes
    if let Some(icon_themes) = contributes["iconThemes"].as_array() {
        for theme in icon_themes {
            let label = theme["label"].as_str().unwrap_or("").to_string();
            let id = theme["id"].as_str().unwrap_or(&label).to_string();

            if let Some(path) = theme["path"].as_str() {
                let full_path = ext_path.join(path);
                if full_path.exists() {
                    contributions.icon_themes.push(IconThemeContribution {
                        id,
                        label,
                        path: full_path.to_string_lossy().to_string(),
                        extension_id: extension_id.clone(),
                    });
                }
            }
        }
    }

    // Load grammars
    if let Some(grammars) = contributes["grammars"].as_array() {
        for grammar in grammars {
            let scope_name = grammar["scopeName"].as_str().unwrap_or("").to_string();
            let language = grammar["language"].as_str().map(|s| s.to_string());

            // Parse embedded languages if present
            let embedded_languages = grammar["embeddedLanguages"].as_object().map(|obj| {
                obj.iter()
                    .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                    .collect()
            });

            if let Some(path) = grammar["path"].as_str() {
                let full_path = ext_path.join(path);
                if full_path.exists() {
                    contributions.grammars.push(GrammarContribution {
                        language,
                        scope_name,
                        path: full_path.to_string_lossy().to_string(),
                        extension_id: extension_id.clone(),
                        embedded_languages,
                    });
                }
            }
        }
    }

    // Load languages
    if let Some(languages) = contributes["languages"].as_array() {
        for lang in languages {
            let id = lang["id"].as_str().unwrap_or("").to_string();
            let extensions: Vec<String> = lang["extensions"].as_array()
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                .unwrap_or_default();
            let aliases: Vec<String> = lang["aliases"].as_array()
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                .unwrap_or_default();

            let configuration = lang["configuration"].as_str().map(|path| {
                ext_path.join(path).to_string_lossy().to_string()
            });

            if !id.is_empty() {
                contributions.languages.push(LanguageContribution {
                    id,
                    extensions,
                    aliases,
                    configuration,
                    extension_id: extension_id.clone(),
                });
            }
        }
    }

    // Load snippets
    if let Some(snippets) = contributes["snippets"].as_array() {
        for snippet in snippets {
            let language = snippet["language"].as_str().unwrap_or("").to_string();

            if let Some(path) = snippet["path"].as_str() {
                let full_path = ext_path.join(path);
                if full_path.exists() {
                    contributions.snippets.push(SnippetContribution {
                        language,
                        path: full_path.to_string_lossy().to_string(),
                        extension_id: extension_id.clone(),
                    });
                }
            }
        }
    }

    // Load configuration
    let display_name = manifest["displayName"].as_str().unwrap_or(name);
    if let Some(config) = contributes.get("configuration") {
        // Configuration can be a single object or an array of objects
        let configs: Vec<&serde_json::Value> = if config.is_array() {
            config.as_array().unwrap().iter().collect()
        } else if config.is_object() {
            vec![config]
        } else {
            vec![]
        };

        for cfg in configs {
            let title = cfg["title"].as_str().map(|s| s.to_string());
            let mut properties: HashMap<String, ConfigurationProperty> = HashMap::new();

            if let Some(props) = cfg["properties"].as_object() {
                for (key, value) in props {
                    let prop = ConfigurationProperty {
                        prop_type: value["type"].as_str().map(|s| s.to_string()),
                        default: value.get("default").cloned(),
                        description: value["description"].as_str().map(|s| s.to_string()),
                        markdown_description: value["markdownDescription"].as_str().map(|s| s.to_string()),
                        enum_values: value["enum"].as_array().map(|arr| arr.clone()),
                        enum_descriptions: value["enumDescriptions"].as_array()
                            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect()),
                        minimum: value["minimum"].as_f64(),
                        maximum: value["maximum"].as_f64(),
                        pattern: value["pattern"].as_str().map(|s| s.to_string()),
                        deprecated: value["deprecationMessage"].as_str().map(|_| true)
                            .or(value["deprecated"].as_bool()),
                        deprecation_message: value["deprecationMessage"].as_str().map(|s| s.to_string()),
                        scope: value["scope"].as_str().map(|s| s.to_string()),
                        order: value["order"].as_i64().map(|n| n as i32),
                    };
                    properties.insert(key.clone(), prop);
                }
            }

            if !properties.is_empty() {
                contributions.configuration.push(ExtensionConfiguration {
                    extension_id: extension_id.clone(),
                    extension_name: display_name.to_string(),
                    title,
                    properties,
                });
            }
        }
    }

    Some(contributions)
}

/// Load a theme file and return its colors
#[tauri::command]
pub async fn load_theme_file(path: String) -> Result<ApiResponse<ThemeColors>, String> {
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;

    // Theme files can be JSON or JSONC (JSON with comments)
    // Strip comments for parsing
    let clean_content = strip_json_comments(&content);

    let theme: serde_json::Value = serde_json::from_str(&clean_content)
        .map_err(|e| format!("Failed to parse theme: {}", e))?;

    let mut colors: HashMap<String, String> = HashMap::new();
    let mut token_colors: Vec<TokenColor> = Vec::new();

    // Extract colors
    if let Some(color_obj) = theme["colors"].as_object() {
        for (key, value) in color_obj {
            if let Some(color) = value.as_str() {
                colors.insert(key.clone(), color.to_string());
            }
        }
    }

    // Extract token colors
    if let Some(tokens) = theme["tokenColors"].as_array() {
        for token in tokens {
            let name = token["name"].as_str().map(|s| s.to_string());
            let scope = token.get("scope").cloned();

            let settings = TokenColorSettings {
                foreground: token["settings"]["foreground"].as_str().map(|s| s.to_string()),
                background: token["settings"]["background"].as_str().map(|s| s.to_string()),
                font_style: token["settings"]["fontStyle"].as_str().map(|s| s.to_string()),
            };

            token_colors.push(TokenColor {
                name,
                scope,
                settings,
            });
        }
    }

    let name = theme["name"].as_str().map(|s| s.to_string());
    let theme_type = theme["type"].as_str().map(|s| s.to_string());

    Ok(ApiResponse::success(ThemeColors {
        colors,
        token_colors,
        name,
        theme_type,
    }))
}

/// Load an icon theme file
#[tauri::command]
pub async fn load_icon_theme_file(path: String) -> Result<ApiResponse<serde_json::Value>, String> {
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let clean_content = strip_json_comments(&content);

    let theme: serde_json::Value = serde_json::from_str(&clean_content)
        .map_err(|e| format!("Failed to parse icon theme: {}", e))?;

    Ok(ApiResponse::success(theme))
}

/// Load a grammar file
#[tauri::command]
pub async fn load_grammar_file(path: String) -> Result<ApiResponse<serde_json::Value>, String> {
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let clean_content = strip_json_comments(&content);

    let grammar: serde_json::Value = serde_json::from_str(&clean_content)
        .map_err(|e| format!("Failed to parse grammar: {}", e))?;

    Ok(ApiResponse::success(grammar))
}

/// Load extension README for better descriptions
#[tauri::command]
pub async fn load_extension_readme(extension_id: String) -> Result<ApiResponse<String>, String> {
    let extensions_dir = match get_sentinelops_extensions_dir() {
        Some(dir) => dir,
        None => return Ok(ApiResponse::error("NOT_FOUND", "Extensions directory not found")),
    };

    if let Ok(entries) = fs::read_dir(&extensions_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let dir_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

            if dir_name.to_lowercase().starts_with(&extension_id.to_lowercase()) {
                // Try common README filenames
                for readme_name in &["README.md", "readme.md", "Readme.md", "README.MD"] {
                    let readme_path = path.join(readme_name);
                    if readme_path.exists() {
                        if let Ok(content) = fs::read_to_string(&readme_path) {
                            return Ok(ApiResponse::success(content));
                        }
                    }
                }
            }
        }
    }

    Ok(ApiResponse::error("NOT_FOUND", "README not found"))
}

/// VSCode snippet format
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VsCodeSnippet {
    pub prefix: serde_json::Value, // Can be string or array of strings
    pub body: serde_json::Value,   // Can be string or array of strings
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadedSnippets {
    pub language: String,
    pub snippets: HashMap<String, VsCodeSnippet>,
}

/// Load an icon file and return as base64 data URL
#[tauri::command]
pub async fn load_extension_icon(path: String) -> Result<ApiResponse<String>, String> {
    if !std::path::Path::new(&path).exists() {
        return Ok(ApiResponse::error("NOT_FOUND", "Icon file not found"));
    }

    let bytes = fs::read(&path).map_err(|e| e.to_string())?;

    // Determine MIME type from extension
    let mime = if path.ends_with(".svg") {
        "image/svg+xml"
    } else if path.ends_with(".png") {
        "image/png"
    } else if path.ends_with(".jpg") || path.ends_with(".jpeg") {
        "image/jpeg"
    } else if path.ends_with(".gif") {
        "image/gif"
    } else if path.ends_with(".webp") {
        "image/webp"
    } else {
        "application/octet-stream"
    };

    use base64::{Engine as _, engine::general_purpose::STANDARD};
    let base64_data = STANDARD.encode(&bytes);
    let data_url = format!("data:{};base64,{}", mime, base64_data);

    Ok(ApiResponse::success(data_url))
}

/// Load a snippets file
#[tauri::command]
pub async fn load_snippets_file(path: String, language: String) -> Result<ApiResponse<LoadedSnippets>, String> {
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let clean_content = strip_json_comments(&content);

    let snippets: HashMap<String, VsCodeSnippet> = serde_json::from_str(&clean_content)
        .map_err(|e| format!("Failed to parse snippets: {}", e))?;

    Ok(ApiResponse::success(LoadedSnippets { language, snippets }))
}

// ============================================================================
// Extension Settings Storage
// ============================================================================

fn get_extension_settings_path() -> Option<PathBuf> {
    let home = dirs::home_dir()?;
    Some(home.join(".sentinelops").join("extension-settings.json"))
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ExtensionSettingsData {
    pub settings: HashMap<String, serde_json::Value>,
}

/// Get all extension settings
#[tauri::command]
pub async fn get_extension_settings() -> Result<ApiResponse<ExtensionSettingsData>, String> {
    let settings_path = get_extension_settings_path()
        .ok_or_else(|| "Could not determine settings path".to_string())?;

    if !settings_path.exists() {
        return Ok(ApiResponse::success(ExtensionSettingsData::default()));
    }

    let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
    let settings: ExtensionSettingsData = serde_json::from_str(&content)
        .unwrap_or_default();

    Ok(ApiResponse::success(settings))
}

/// Set a single extension setting
#[tauri::command]
pub async fn set_extension_setting(key: String, value: serde_json::Value) -> Result<ApiResponse<bool>, String> {
    let settings_path = get_extension_settings_path()
        .ok_or_else(|| "Could not determine settings path".to_string())?;

    // Ensure directory exists
    if let Some(parent) = settings_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    // Load existing settings
    let mut settings = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        serde_json::from_str::<ExtensionSettingsData>(&content).unwrap_or_default()
    } else {
        ExtensionSettingsData::default()
    };

    // Update the setting
    settings.settings.insert(key, value);

    // Save back
    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&settings_path, content).map_err(|e| e.to_string())?;

    Ok(ApiResponse::success(true))
}

/// Reset a setting to its default value (removes from stored settings)
#[tauri::command]
pub async fn reset_extension_setting(key: String) -> Result<ApiResponse<bool>, String> {
    let settings_path = get_extension_settings_path()
        .ok_or_else(|| "Could not determine settings path".to_string())?;

    if !settings_path.exists() {
        return Ok(ApiResponse::success(true));
    }

    let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
    let mut settings: ExtensionSettingsData = serde_json::from_str(&content).unwrap_or_default();

    settings.settings.remove(&key);

    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&settings_path, content).map_err(|e| e.to_string())?;

    Ok(ApiResponse::success(true))
}

/// Strip JSON comments (// and /* */)
fn strip_json_comments(input: &str) -> String {
    let mut result = String::new();
    let mut chars = input.chars().peekable();
    let mut in_string = false;
    let mut escape_next = false;

    while let Some(c) = chars.next() {
        if escape_next {
            result.push(c);
            escape_next = false;
            continue;
        }

        if c == '\\' && in_string {
            result.push(c);
            escape_next = true;
            continue;
        }

        if c == '"' {
            in_string = !in_string;
            result.push(c);
            continue;
        }

        if !in_string && c == '/' {
            if let Some(&next) = chars.peek() {
                if next == '/' {
                    // Line comment - skip until newline
                    chars.next();
                    while let Some(&nc) = chars.peek() {
                        if nc == '\n' {
                            break;
                        }
                        chars.next();
                    }
                    continue;
                } else if next == '*' {
                    // Block comment - skip until */
                    chars.next();
                    while let Some(nc) = chars.next() {
                        if nc == '*' {
                            if let Some(&'/') = chars.peek() {
                                chars.next();
                                break;
                            }
                        }
                    }
                    continue;
                }
            }
        }

        result.push(c);
    }

    result
}
