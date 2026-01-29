use crate::services::AppState;
use super::file_ops::ApiResponse;
use serde::Serialize;
use tauri::State;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebSearchResult {
    pub title: String,
    pub url: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub age: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebSearchResponse {
    pub query: String,
    pub results: Vec<WebSearchResult>,
    pub count: usize,
}

#[tauri::command]
pub async fn web_search(
    state: State<'_, AppState>,
    query: String,
    count: Option<u32>,
) -> Result<ApiResponse<WebSearchResponse>, String> {
    let api_key = {
        let config = state.config.lock().map_err(|e| e.to_string())?;
        config.brave_api_key.clone()
    };

    let api_key = match api_key {
        Some(key) if !key.is_empty() => key,
        _ => {
            return Ok(ApiResponse::error(
                "BRAVE_NOT_CONFIGURED",
                "Brave Search API key not configured. Set BRAVE_API_KEY environment variable."
            ));
        }
    };

    let client = reqwest::Client::new();
    let search_count = count.unwrap_or(10).min(20);

    let url = format!(
        "https://api.search.brave.com/res/v1/web/search?q={}&count={}",
        urlencoding::encode(&query),
        search_count
    );

    match client
        .get(&url)
        .header("Accept", "application/json")
        .header("X-Subscription-Token", &api_key)
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                let json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;

                let results: Vec<WebSearchResult> = json["web"]["results"]
                    .as_array()
                    .map(|arr| {
                        arr.iter().filter_map(|item| {
                            Some(WebSearchResult {
                                title: item["title"].as_str()?.to_string(),
                                url: item["url"].as_str()?.to_string(),
                                description: item["description"].as_str()
                                    .unwrap_or("")
                                    .to_string(),
                                age: item["age"].as_str().map(String::from),
                            })
                        }).collect()
                    })
                    .unwrap_or_default();

                let count = results.len();

                Ok(ApiResponse::success(WebSearchResponse {
                    query,
                    results,
                    count,
                }))
            } else {
                let status = response.status();
                let error_text = response.text().await.unwrap_or_default();
                Ok(ApiResponse::error("SEARCH_ERROR", &format!("HTTP {}: {}", status, error_text)))
            }
        }
        Err(e) => Ok(ApiResponse::error("SEARCH_ERROR", &format!("Request failed: {}", e))),
    }
}
