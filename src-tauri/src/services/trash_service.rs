use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;
use uuid::Uuid;

use super::file_service::hash_file;

#[derive(Error, Debug)]
pub enum TrashError {
    #[error("Trash item not found: {0}")]
    NotFound(String),
    #[error("Already exists: {0}")]
    AlreadyExists(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrashMetadata {
    #[serde(rename = "trashId")]
    pub trash_id: String,
    #[serde(rename = "originalPath")]
    pub original_path: String,
    #[serde(rename = "deletedAt")]
    pub deleted_at: String,
    #[serde(rename = "type")]
    pub item_type: String,
    pub size: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sha256: Option<String>,
    pub request_id: String,
}

pub struct TrashManager {
    trash_dir: PathBuf,
    confirm_tokens: HashMap<String, (String, i64)>, // token -> (path, expires_at)
}

impl TrashManager {
    pub fn new(workspace: &Path) -> Self {
        let trash_dir = workspace.join(".trash");
        Self {
            trash_dir,
            confirm_tokens: HashMap::new(),
        }
    }

    pub fn update_workspace(&mut self, workspace: &Path) {
        self.trash_dir = workspace.join(".trash");
    }

    fn get_date_dir(&self) -> PathBuf {
        let date = chrono::Utc::now().format("%Y-%m-%d").to_string();
        self.trash_dir.join(date)
    }

    /// Move a file or directory to trash
    pub fn move_to_trash(
        &self,
        source_path: &Path,
        original_rel_path: &str,
        request_id: &str,
    ) -> Result<(String, PathBuf), TrashError> {
        if !source_path.exists() {
            return Err(TrashError::NotFound(original_rel_path.to_string()));
        }

        let trash_id = Uuid::new_v4().to_string();
        let date_dir = self.get_date_dir();
        let trash_item_dir = date_dir.join(&trash_id);

        fs::create_dir_all(&trash_item_dir)?;

        let metadata = source_path.metadata()?;
        let item_type = if metadata.is_dir() { "directory" } else { "file" };

        let sha256 = if !metadata.is_dir() {
            hash_file(source_path).ok()
        } else {
            None
        };

        let trash_metadata = TrashMetadata {
            trash_id: trash_id.clone(),
            original_path: original_rel_path.to_string(),
            deleted_at: chrono::Utc::now().to_rfc3339(),
            item_type: item_type.to_string(),
            size: metadata.len(),
            sha256,
            request_id: request_id.to_string(),
        };

        // Write metadata
        let metadata_path = trash_item_dir.join("metadata.json");
        let metadata_json = serde_json::to_string_pretty(&trash_metadata)?;
        fs::write(&metadata_path, metadata_json)?;

        // Move item to trash
        let item_name = source_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "item".to_string());
        let trash_path = trash_item_dir.join(&item_name);

        fs::rename(source_path, &trash_path)?;

        Ok((trash_id, trash_path))
    }

    /// List items in trash
    pub fn list(&self, date_filter: Option<&str>) -> Result<Vec<TrashMetadata>, TrashError> {
        let mut items = Vec::new();

        if !self.trash_dir.exists() {
            return Ok(items);
        }

        let date_dirs: Vec<PathBuf> = if let Some(date) = date_filter {
            vec![self.trash_dir.join(date)]
        } else {
            fs::read_dir(&self.trash_dir)?
                .filter_map(|e| e.ok())
                .filter(|e| e.path().is_dir())
                .map(|e| e.path())
                .collect()
        };

        for date_dir in date_dirs {
            if !date_dir.exists() {
                continue;
            }

            for trash_item in fs::read_dir(&date_dir)?.filter_map(|e| e.ok()) {
                if !trash_item.path().is_dir() {
                    continue;
                }

                let metadata_path = trash_item.path().join("metadata.json");
                if let Ok(content) = fs::read_to_string(&metadata_path) {
                    if let Ok(metadata) = serde_json::from_str::<TrashMetadata>(&content) {
                        items.push(metadata);
                    }
                }
            }
        }

        // Sort by deletion time (newest first)
        items.sort_by(|a, b| b.deleted_at.cmp(&a.deleted_at));

        Ok(items)
    }

    /// Find a trash item by ID
    pub fn find(&self, trash_id: &str) -> Result<Option<(TrashMetadata, PathBuf)>, TrashError> {
        if !self.trash_dir.exists() {
            return Ok(None);
        }

        for date_dir in fs::read_dir(&self.trash_dir)?.filter_map(|e| e.ok()) {
            if !date_dir.path().is_dir() {
                continue;
            }

            let trash_item_dir = date_dir.path().join(trash_id);
            if !trash_item_dir.exists() {
                continue;
            }

            let metadata_path = trash_item_dir.join("metadata.json");
            if let Ok(content) = fs::read_to_string(&metadata_path) {
                if let Ok(metadata) = serde_json::from_str::<TrashMetadata>(&content) {
                    // Find the actual item (not metadata.json)
                    for item in fs::read_dir(&trash_item_dir)?.filter_map(|e| e.ok()) {
                        let name = item.file_name().to_string_lossy().to_string();
                        if name != "metadata.json" {
                            return Ok(Some((metadata, item.path())));
                        }
                    }
                }
            }
        }

        Ok(None)
    }

    /// Restore a trash item
    pub fn restore(
        &self,
        trash_id: &str,
        to_path: Option<&Path>,
    ) -> Result<PathBuf, TrashError> {
        let (metadata, item_path) = self
            .find(trash_id)?
            .ok_or_else(|| TrashError::NotFound(trash_id.to_string()))?;

        let restore_path = to_path
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(&metadata.original_path));

        if restore_path.exists() {
            return Err(TrashError::AlreadyExists(
                restore_path.to_string_lossy().to_string(),
            ));
        }

        // Ensure parent directory exists
        if let Some(parent) = restore_path.parent() {
            fs::create_dir_all(parent)?;
        }

        fs::rename(&item_path, &restore_path)?;

        // Clean up trash item directory
        let trash_item_dir = item_path.parent().unwrap();
        let _ = fs::remove_dir_all(trash_item_dir);

        Ok(restore_path)
    }

    /// Purge trash items
    pub fn purge(
        &self,
        trash_id: Option<&str>,
        older_than_days: Option<i64>,
    ) -> Result<Vec<String>, TrashError> {
        let mut purged = Vec::new();

        if let Some(id) = trash_id {
            // Purge specific item
            if let Some((_, item_path)) = self.find(id)? {
                let trash_item_dir = item_path.parent().unwrap();
                fs::remove_dir_all(trash_item_dir)?;
                purged.push(id.to_string());
            } else {
                return Err(TrashError::NotFound(id.to_string()));
            }
        } else {
            // Purge all or by age
            let items = self.list(None)?;
            let cutoff = older_than_days.map(|days| {
                chrono::Utc::now() - chrono::Duration::days(days)
            });

            for item in items {
                let should_purge = match &cutoff {
                    Some(cutoff_time) => {
                        chrono::DateTime::parse_from_rfc3339(&item.deleted_at)
                            .map(|dt| dt < *cutoff_time)
                            .unwrap_or(false)
                    }
                    None => true,
                };

                if should_purge {
                    if let Some((_, item_path)) = self.find(&item.trash_id)? {
                        let trash_item_dir = item_path.parent().unwrap();
                        if fs::remove_dir_all(trash_item_dir).is_ok() {
                            purged.push(item.trash_id.clone());
                        }
                    }
                }
            }
        }

        // Clean up empty date directories
        if self.trash_dir.exists() {
            for date_dir in fs::read_dir(&self.trash_dir)?.filter_map(|e| e.ok()) {
                if date_dir.path().is_dir() {
                    if let Ok(mut entries) = fs::read_dir(date_dir.path()) {
                        if entries.next().is_none() {
                            let _ = fs::remove_dir(date_dir.path());
                        }
                    }
                }
            }
        }

        Ok(purged)
    }

    /// Generate a confirmation token
    pub fn generate_confirm_token(&mut self, path: &str) -> String {
        let token = Uuid::new_v4().to_string();
        let expires_at = chrono::Utc::now().timestamp() + 300; // 5 minutes
        self.confirm_tokens.insert(token.clone(), (path.to_string(), expires_at));
        token
    }

    /// Validate a confirmation token
    pub fn validate_confirm_token(&mut self, token: &str, path: &str) -> bool {
        if let Some((stored_path, expires_at)) = self.confirm_tokens.remove(token) {
            if chrono::Utc::now().timestamp() < expires_at && stored_path == path {
                return true;
            }
        }
        false
    }

    /// Clean expired tokens
    pub fn clean_expired_tokens(&mut self) {
        let now = chrono::Utc::now().timestamp();
        self.confirm_tokens.retain(|_, (_, expires_at)| *expires_at > now);
    }
}
