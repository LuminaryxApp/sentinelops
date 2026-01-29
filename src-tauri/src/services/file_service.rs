use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use thiserror::Error;
use walkdir::WalkDir;

#[derive(Error, Debug)]
pub enum FileError {
    #[error("File not found: {0}")]
    NotFound(String),
    #[error("Is a directory: {0}")]
    IsDirectory(String),
    #[error("Not a directory: {0}")]
    NotDirectory(String),
    #[error("File too large: {0} (max: {1} bytes)")]
    TooLarge(String, usize),
    #[error("Already exists: {0}")]
    AlreadyExists(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Path invalid: {0}")]
    InvalidPath(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub file_type: String,
    pub size: u64,
    #[serde(rename = "modifiedAt")]
    pub modified_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileStat {
    pub path: String,
    pub name: String,
    #[serde(rename = "type")]
    pub file_type: String,
    pub size: u64,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "modifiedAt")]
    pub modified_at: String,
    #[serde(rename = "accessedAt")]
    pub accessed_at: String,
    pub mode: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sha256: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchMatch {
    pub path: String,
    pub line: usize,
    pub column: usize,
    pub text: String,
}

/// Compute SHA256 hash of file content
pub fn hash_content(content: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content);
    hex::encode(hasher.finalize())
}

/// Compute SHA256 hash of a file
pub fn hash_file(path: &Path) -> Result<String, FileError> {
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];

    loop {
        let bytes_read = file.read(&mut buffer)?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    Ok(hex::encode(hasher.finalize()))
}

/// Resolve a path relative to workspace
pub fn resolve_path(workspace: &Path, rel_path: &str) -> Result<PathBuf, FileError> {
    if rel_path.contains('\0') {
        return Err(FileError::InvalidPath(rel_path.to_string()));
    }

    let path = if Path::new(rel_path).is_absolute() {
        PathBuf::from(rel_path)
    } else {
        workspace.join(rel_path)
    };

    // Normalize the path
    let canonical = path
        .canonicalize()
        .unwrap_or_else(|_| path.clone());

    Ok(canonical)
}

/// List directory contents
pub fn list_directory(
    workspace: &Path,
    rel_path: &str,
    recursive: bool,
    include_hidden: bool,
) -> Result<Vec<FileEntry>, FileError> {
    let path = resolve_path(workspace, rel_path)?;

    if !path.exists() {
        return Err(FileError::NotFound(rel_path.to_string()));
    }

    if !path.is_dir() {
        return Err(FileError::NotDirectory(rel_path.to_string()));
    }

    let mut entries = Vec::new();

    if recursive {
        for entry in WalkDir::new(&path).min_depth(1).into_iter().filter_entry(|e| {
            include_hidden || !e.file_name().to_string_lossy().starts_with('.')
        }) {
            if let Ok(entry) = entry {
                if let Some(file_entry) = entry_to_file_entry(&entry.path(), workspace) {
                    entries.push(file_entry);
                }
            }
        }
    } else {
        for entry in fs::read_dir(&path)? {
            let entry = entry?;
            let name = entry.file_name().to_string_lossy().to_string();

            if !include_hidden && name.starts_with('.') {
                continue;
            }

            if let Some(file_entry) = entry_to_file_entry(&entry.path(), workspace) {
                entries.push(file_entry);
            }
        }
    }

    Ok(entries)
}

fn entry_to_file_entry(path: &Path, workspace: &Path) -> Option<FileEntry> {
    let metadata = fs::metadata(path).ok()?;
    let name = path.file_name()?.to_string_lossy().to_string();
    let rel_path = path
        .strip_prefix(workspace)
        .ok()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string())
        .replace('\\', "/");

    let file_type = if metadata.is_dir() {
        "directory"
    } else if metadata.file_type().is_symlink() {
        "symlink"
    } else {
        "file"
    };

    let modified_at = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| chrono::DateTime::from_timestamp(d.as_secs() as i64, 0))
        .flatten()
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_default();

    Some(FileEntry {
        name,
        path: rel_path,
        file_type: file_type.to_string(),
        size: metadata.len(),
        modified_at,
    })
}

/// Read file content
pub fn read_file(workspace: &Path, rel_path: &str, max_size: usize) -> Result<(String, String, u64), FileError> {
    let path = resolve_path(workspace, rel_path)?;

    if !path.exists() {
        return Err(FileError::NotFound(rel_path.to_string()));
    }

    if path.is_dir() {
        return Err(FileError::IsDirectory(rel_path.to_string()));
    }

    let metadata = fs::metadata(&path)?;
    if metadata.len() as usize > max_size {
        return Err(FileError::TooLarge(rel_path.to_string(), max_size));
    }

    let content = fs::read_to_string(&path)?;
    let sha256 = hash_content(content.as_bytes());

    Ok((content, sha256, metadata.len()))
}

/// Write file content
pub fn write_file(
    workspace: &Path,
    rel_path: &str,
    content: &str,
    create_dirs: bool,
    overwrite: bool,
) -> Result<(String, bool, usize), FileError> {
    let path = resolve_path(workspace, rel_path).unwrap_or_else(|_| workspace.join(rel_path));

    let exists = path.exists();

    if exists && !overwrite {
        return Err(FileError::AlreadyExists(rel_path.to_string()));
    }

    if exists && path.is_dir() {
        return Err(FileError::IsDirectory(rel_path.to_string()));
    }

    // Create parent directories if needed
    if create_dirs {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
    }

    // Atomic write via temp file
    let temp_path = path.with_extension(format!("tmp.{}", uuid::Uuid::new_v4()));
    fs::write(&temp_path, content)?;
    fs::rename(&temp_path, &path)?;

    let sha256 = hash_content(content.as_bytes());

    Ok((sha256, !exists, content.len()))
}

/// Get file statistics
pub fn get_stat(workspace: &Path, rel_path: &str, include_hash: bool) -> Result<FileStat, FileError> {
    let path = resolve_path(workspace, rel_path)?;

    if !path.exists() {
        return Err(FileError::NotFound(rel_path.to_string()));
    }

    let metadata = fs::metadata(&path)?;
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let file_type = if metadata.is_dir() {
        "directory"
    } else if metadata.file_type().is_symlink() {
        "symlink"
    } else {
        "file"
    };

    let to_rfc3339 = |time: std::io::Result<std::time::SystemTime>| {
        time.ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| chrono::DateTime::from_timestamp(d.as_secs() as i64, 0))
            .flatten()
            .map(|dt| dt.to_rfc3339())
            .unwrap_or_default()
    };

    let sha256 = if include_hash && !metadata.is_dir() {
        hash_file(&path).ok()
    } else {
        None
    };

    Ok(FileStat {
        path: rel_path.to_string(),
        name,
        file_type: file_type.to_string(),
        size: metadata.len(),
        created_at: to_rfc3339(metadata.created()),
        modified_at: to_rfc3339(metadata.modified()),
        accessed_at: to_rfc3339(metadata.accessed()),
        mode: 0o644, // Default mode, Windows doesn't have Unix permissions
        sha256,
    })
}

/// Search files for content
pub fn search_files(
    workspace: &Path,
    query: &str,
    search_path: &str,
    case_sensitive: bool,
    max_results: usize,
) -> Result<Vec<SearchMatch>, FileError> {
    let path = resolve_path(workspace, search_path)?;
    let mut matches = Vec::new();

    let query_lower = if case_sensitive {
        query.to_string()
    } else {
        query.to_lowercase()
    };

    for entry in WalkDir::new(&path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        if matches.len() >= max_results {
            break;
        }

        if let Ok(content) = fs::read_to_string(entry.path()) {
            for (line_num, line) in content.lines().enumerate() {
                let search_line = if case_sensitive {
                    line.to_string()
                } else {
                    line.to_lowercase()
                };

                if let Some(col) = search_line.find(&query_lower) {
                    let rel_path = entry
                        .path()
                        .strip_prefix(workspace)
                        .ok()
                        .map(|p| p.to_string_lossy().to_string())
                        .unwrap_or_else(|| entry.path().to_string_lossy().to_string())
                        .replace('\\', "/");

                    matches.push(SearchMatch {
                        path: rel_path,
                        line: line_num + 1,
                        column: col + 1,
                        text: line.to_string(),
                    });

                    if matches.len() >= max_results {
                        break;
                    }
                }
            }
        }
    }

    Ok(matches)
}

/// Create directory
pub fn create_directory(workspace: &Path, rel_path: &str, recursive: bool) -> Result<bool, FileError> {
    let path = resolve_path(workspace, rel_path).unwrap_or_else(|_| workspace.join(rel_path));

    if path.exists() {
        if path.is_dir() {
            return Ok(false); // Already exists
        }
        return Err(FileError::AlreadyExists(rel_path.to_string()));
    }

    if recursive {
        fs::create_dir_all(&path)?;
    } else {
        fs::create_dir(&path)?;
    }

    Ok(true)
}

/// Delete path (file or directory)
pub fn delete_path(workspace: &Path, rel_path: &str, recursive: bool) -> Result<(), FileError> {
    let path = resolve_path(workspace, rel_path)?;

    if !path.exists() {
        return Err(FileError::NotFound(rel_path.to_string()));
    }

    if path.is_dir() {
        if recursive {
            fs::remove_dir_all(&path)?;
        } else {
            fs::remove_dir(&path)?;
        }
    } else {
        fs::remove_file(&path)?;
    }

    Ok(())
}

/// Move path
pub fn move_path(workspace: &Path, from: &str, to: &str, overwrite: bool) -> Result<(), FileError> {
    let from_path = resolve_path(workspace, from)?;
    let to_path = resolve_path(workspace, to).unwrap_or_else(|_| workspace.join(to));

    if !from_path.exists() {
        return Err(FileError::NotFound(from.to_string()));
    }

    if to_path.exists() && !overwrite {
        return Err(FileError::AlreadyExists(to.to_string()));
    }

    if to_path.exists() {
        if to_path.is_dir() {
            fs::remove_dir_all(&to_path)?;
        } else {
            fs::remove_file(&to_path)?;
        }
    }

    fs::rename(&from_path, &to_path)?;
    Ok(())
}

/// Copy path
pub fn copy_path(workspace: &Path, from: &str, to: &str, overwrite: bool) -> Result<(), FileError> {
    let from_path = resolve_path(workspace, from)?;
    let to_path = resolve_path(workspace, to).unwrap_or_else(|_| workspace.join(to));

    if !from_path.exists() {
        return Err(FileError::NotFound(from.to_string()));
    }

    if to_path.exists() && !overwrite {
        return Err(FileError::AlreadyExists(to.to_string()));
    }

    if from_path.is_dir() {
        copy_dir_recursive(&from_path, &to_path)?;
    } else {
        if let Some(parent) = to_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::copy(&from_path, &to_path)?;
    }

    Ok(())
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), FileError> {
    fs::create_dir_all(dst)?;

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }

    Ok(())
}

/// Check if path exists
pub fn exists(workspace: &Path, rel_path: &str) -> bool {
    resolve_path(workspace, rel_path)
        .map(|p| p.exists())
        .unwrap_or(false)
}
