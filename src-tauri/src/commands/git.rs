use crate::services::AppState;
use super::file_ops::ApiResponse;
use serde::Serialize;
use std::process::Command;
use tauri::State;

#[derive(Debug, Serialize)]
pub struct GitChange {
    pub path: String,
    pub status: String,
    pub staged: bool,
}

#[derive(Debug, Serialize)]
pub struct GitStatusResult {
    pub branch: Option<String>,
    pub changes: Vec<GitChange>,
}

#[derive(Debug, Serialize)]
pub struct GitBranch {
    pub name: String,
    pub current: bool,
    pub remote: bool,
}

#[derive(Debug, Serialize)]
pub struct GitCommit {
    pub hash: String,
    #[serde(rename = "fullHash")]
    pub full_hash: String,
    pub message: String,
}

fn run_git_command(args: &[&str], cwd: &std::path::Path) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub async fn git_status(
    state: State<'_, AppState>,
    path: Option<String>,
) -> Result<ApiResponse<GitStatusResult>, String> {
    let config = state.config.lock().unwrap();
    let workspace = config.workspace_root.clone();
    drop(config);

    let cwd = if let Some(p) = path {
        workspace.join(p)
    } else {
        workspace
    };

    // Get branch name
    let branch = run_git_command(&["rev-parse", "--abbrev-ref", "HEAD"], &cwd)
        .ok()
        .map(|s| s.trim().to_string());

    // Get status
    let status_output = run_git_command(&["status", "--porcelain"], &cwd)
        .map_err(|e| format!("Git status failed: {}", e));

    match status_output {
        Ok(output) => {
            let changes: Vec<GitChange> = output
                .lines()
                .filter_map(|line| {
                    if line.len() < 4 {
                        return None;
                    }

                    let index_status = line.chars().next().unwrap_or(' ');
                    let worktree_status = line.chars().nth(1).unwrap_or(' ');
                    let file_path = line[3..].to_string();

                    let (status, staged) = match (index_status, worktree_status) {
                        ('M', _) => ("modified", true),
                        (_, 'M') => ("modified", false),
                        ('A', _) => ("added", true),
                        ('D', _) => ("deleted", true),
                        (_, 'D') => ("deleted", false),
                        ('R', _) => ("renamed", true),
                        ('?', '?') => ("untracked", false),
                        _ => ("unknown", false),
                    };

                    Some(GitChange {
                        path: file_path,
                        status: status.to_string(),
                        staged,
                    })
                })
                .collect();

            Ok(ApiResponse::success(GitStatusResult { branch, changes }))
        }
        Err(e) => Ok(ApiResponse::error("GIT_ERROR", &e)),
    }
}

#[tauri::command]
pub async fn git_stage(
    state: State<'_, AppState>,
    paths: Vec<String>,
) -> Result<ApiResponse<serde_json::Value>, String> {
    let config = state.config.lock().unwrap();
    let workspace = config.workspace_root.clone();
    drop(config);

    let mut args = vec!["add"];
    let path_refs: Vec<&str> = paths.iter().map(|s| s.as_str()).collect();
    args.extend(path_refs.iter());

    match run_git_command(&args, &workspace) {
        Ok(_) => Ok(ApiResponse::success(serde_json::json!({
            "staged": paths
        }))),
        Err(e) => Ok(ApiResponse::error("GIT_ERROR", &e)),
    }
}

#[tauri::command]
pub async fn git_unstage(
    state: State<'_, AppState>,
    paths: Vec<String>,
) -> Result<ApiResponse<serde_json::Value>, String> {
    let config = state.config.lock().unwrap();
    let workspace = config.workspace_root.clone();
    drop(config);

    let mut args = vec!["reset", "HEAD", "--"];
    let path_refs: Vec<&str> = paths.iter().map(|s| s.as_str()).collect();
    args.extend(path_refs.iter());

    match run_git_command(&args, &workspace) {
        Ok(_) => Ok(ApiResponse::success(serde_json::json!({
            "unstaged": paths
        }))),
        Err(e) => Ok(ApiResponse::error("GIT_ERROR", &e)),
    }
}

#[tauri::command]
pub async fn git_commit(
    state: State<'_, AppState>,
    message: String,
) -> Result<ApiResponse<serde_json::Value>, String> {
    let config = state.config.lock().unwrap();
    let workspace = config.workspace_root.clone();
    drop(config);

    match run_git_command(&["commit", "-m", &message], &workspace) {
        Ok(output) => Ok(ApiResponse::success(serde_json::json!({
            "committed": true,
            "output": output
        }))),
        Err(e) => Ok(ApiResponse::error("GIT_ERROR", &e)),
    }
}

#[tauri::command]
pub async fn git_diff(
    state: State<'_, AppState>,
    path: Option<String>,
) -> Result<ApiResponse<serde_json::Value>, String> {
    let config = state.config.lock().unwrap();
    let workspace = config.workspace_root.clone();
    drop(config);

    let args: Vec<&str> = if let Some(ref p) = path {
        vec!["diff", p]
    } else {
        vec!["diff"]
    };

    match run_git_command(&args, &workspace) {
        Ok(diff) => Ok(ApiResponse::success(serde_json::json!({
            "diff": diff
        }))),
        Err(e) => Ok(ApiResponse::error("GIT_ERROR", &e)),
    }
}

#[tauri::command]
pub async fn git_branches(
    state: State<'_, AppState>,
) -> Result<ApiResponse<serde_json::Value>, String> {
    let config = state.config.lock().unwrap();
    let workspace = config.workspace_root.clone();
    drop(config);

    match run_git_command(&["branch", "-a"], &workspace) {
        Ok(output) => {
            let branches: Vec<GitBranch> = output
                .lines()
                .filter(|line| !line.trim().is_empty())
                .map(|line| {
                    let trimmed = line.trim();
                    let current = trimmed.starts_with('*');
                    let name = trimmed.trim_start_matches("* ").trim();
                    let remote = name.starts_with("remotes/");

                    GitBranch {
                        name: name.trim_start_matches("remotes/origin/").to_string(),
                        current,
                        remote,
                    }
                })
                .collect();

            Ok(ApiResponse::success(serde_json::json!({
                "branches": branches
            })))
        }
        Err(e) => Ok(ApiResponse::error("GIT_ERROR", &e)),
    }
}

#[tauri::command]
pub async fn git_checkout(
    state: State<'_, AppState>,
    name: String,
    create: Option<bool>,
) -> Result<ApiResponse<serde_json::Value>, String> {
    let config = state.config.lock().unwrap();
    let workspace = config.workspace_root.clone();
    drop(config);

    let args: Vec<&str> = if create.unwrap_or(false) {
        vec!["checkout", "-b", &name]
    } else {
        vec!["checkout", &name]
    };

    match run_git_command(&args, &workspace) {
        Ok(output) => Ok(ApiResponse::success(serde_json::json!({
            "branch": name,
            "output": output
        }))),
        Err(e) => Ok(ApiResponse::error("GIT_ERROR", &e)),
    }
}

#[tauri::command]
pub async fn git_log(
    state: State<'_, AppState>,
    limit: Option<usize>,
) -> Result<ApiResponse<serde_json::Value>, String> {
    let config = state.config.lock().unwrap();
    let workspace = config.workspace_root.clone();
    drop(config);

    let limit_str = limit.unwrap_or(50).to_string();
    let args = vec![
        "log",
        "--oneline",
        "-n",
        &limit_str,
        "--format=%h|%H|%s",
    ];

    match run_git_command(&args, &workspace) {
        Ok(output) => {
            let commits: Vec<GitCommit> = output
                .lines()
                .filter_map(|line| {
                    let parts: Vec<&str> = line.splitn(3, '|').collect();
                    if parts.len() == 3 {
                        Some(GitCommit {
                            hash: parts[0].to_string(),
                            full_hash: parts[1].to_string(),
                            message: parts[2].to_string(),
                        })
                    } else {
                        None
                    }
                })
                .collect();

            Ok(ApiResponse::success(serde_json::json!({
                "commits": commits
            })))
        }
        Err(e) => Ok(ApiResponse::error("GIT_ERROR", &e)),
    }
}
