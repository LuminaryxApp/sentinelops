use crate::services::AppState;
use super::file_ops::ApiResponse;
use serde::Serialize;
use tauri::State;
use std::path::PathBuf;
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[derive(Debug, Serialize)]
pub struct ExecuteResult {
    #[serde(rename = "terminalId")]
    pub terminal_id: String,
    pub pid: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct OutputResult {
    pub output: String,
    #[serde(rename = "isRunning")]
    pub is_running: bool,
    pub cwd: String,
}

#[tauri::command]
pub async fn execute_command(
    state: State<'_, AppState>,
    command: String,
    cwd: Option<String>,
    terminal_id: Option<String>,
    shell: Option<String>,
) -> Result<ApiResponse<ExecuteResult>, String> {
    let mut terminals = state.terminals.lock().unwrap();

    match terminals.execute(
        &command,
        cwd.as_deref(),
        terminal_id.as_deref(),
        shell.as_deref(),
    ) {
        Ok((id, pid)) => Ok(ApiResponse::success(ExecuteResult {
            terminal_id: id,
            pid,
        })),
        Err(e) => Ok(ApiResponse::error("TERMINAL_ERROR", &e.to_string())),
    }
}

#[tauri::command]
pub async fn kill_terminal(
    state: State<'_, AppState>,
    terminal_id: String,
) -> Result<ApiResponse<serde_json::Value>, String> {
    let mut terminals = state.terminals.lock().unwrap();

    match terminals.kill(&terminal_id) {
        Ok(killed) => Ok(ApiResponse::success(serde_json::json!({
            "killed": killed
        }))),
        Err(e) => Ok(ApiResponse::error("TERMINAL_ERROR", &e.to_string())),
    }
}

#[tauri::command]
pub async fn get_terminal_output(
    state: State<'_, AppState>,
    terminal_id: String,
) -> Result<ApiResponse<OutputResult>, String> {
    let mut terminals = state.terminals.lock().unwrap();

    match terminals.get_output(&terminal_id) {
        Ok((output, is_running, cwd)) => Ok(ApiResponse::success(OutputResult {
            output,
            is_running,
            cwd,
        })),
        Err(e) => Ok(ApiResponse::error("TERMINAL_ERROR", &e.to_string())),
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ShellInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub args: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct ShellListResult {
    pub shells: Vec<ShellInfo>,
}

/// Detect available shells/terminals on the system
#[tauri::command]
pub async fn list_available_shells() -> Result<ApiResponse<ShellListResult>, String> {
    let mut shells = Vec::new();

    #[cfg(windows)]
    {
        // Command Prompt (always available on Windows)
        shells.push(ShellInfo {
            id: "cmd".to_string(),
            name: "Command Prompt".to_string(),
            path: "cmd.exe".to_string(),
            args: vec!["/K".to_string()],
        });

        // Windows PowerShell (built-in)
        if check_command_exists("powershell") {
            shells.push(ShellInfo {
                id: "powershell".to_string(),
                name: "Windows PowerShell".to_string(),
                path: "powershell.exe".to_string(),
                args: vec!["-NoLogo".to_string()],
            });
        }

        // PowerShell Core (pwsh)
        if check_command_exists("pwsh") {
            shells.push(ShellInfo {
                id: "pwsh".to_string(),
                name: "PowerShell".to_string(),
                path: "pwsh.exe".to_string(),
                args: vec!["-NoLogo".to_string()],
            });
        }

        // Git Bash
        let git_bash_paths = [
            r"C:\Program Files\Git\bin\bash.exe",
            r"C:\Program Files (x86)\Git\bin\bash.exe",
        ];
        for path in &git_bash_paths {
            if PathBuf::from(path).exists() {
                shells.push(ShellInfo {
                    id: "git-bash".to_string(),
                    name: "Git Bash".to_string(),
                    path: path.to_string(),
                    args: vec!["--login".to_string(), "-i".to_string()],
                });
                break;
            }
        }

        // WSL (Windows Subsystem for Linux)
        if check_command_exists("wsl") {
            // Get list of installed WSL distributions (CREATE_NO_WINDOW so no console flashes)
            let wsl_cmd = {
                let mut c = Command::new("wsl");
                c.args(["-l", "-q"]);
                #[cfg(windows)]
                c.creation_flags(0x08000000); // CREATE_NO_WINDOW
                c
            };
            if let Ok(output) = wsl_cmd.output() {
                let distros = String::from_utf8_lossy(&output.stdout);
                for distro in distros.lines() {
                    let distro = distro.trim().trim_matches(char::from(0));
                    if !distro.is_empty() {
                        shells.push(ShellInfo {
                            id: format!("wsl-{}", distro.to_lowercase().replace(' ', "-")),
                            name: format!("WSL: {}", distro),
                            path: "wsl.exe".to_string(),
                            args: vec!["-d".to_string(), distro.to_string()],
                        });
                    }
                }
            }

            // Add generic WSL option if no specific distros found
            if !shells.iter().any(|s| s.id.starts_with("wsl-")) {
                shells.push(ShellInfo {
                    id: "wsl".to_string(),
                    name: "WSL".to_string(),
                    path: "wsl.exe".to_string(),
                    args: vec![],
                });
            }
        }

        // Cygwin
        let cygwin_path = r"C:\cygwin64\bin\bash.exe";
        if PathBuf::from(cygwin_path).exists() {
            shells.push(ShellInfo {
                id: "cygwin".to_string(),
                name: "Cygwin".to_string(),
                path: cygwin_path.to_string(),
                args: vec!["--login".to_string(), "-i".to_string()],
            });
        }

        // MSYS2
        let msys2_paths = [
            r"C:\msys64\usr\bin\bash.exe",
            r"C:\msys32\usr\bin\bash.exe",
        ];
        for path in &msys2_paths {
            if PathBuf::from(path).exists() {
                shells.push(ShellInfo {
                    id: "msys2".to_string(),
                    name: "MSYS2".to_string(),
                    path: path.to_string(),
                    args: vec!["--login".to_string(), "-i".to_string()],
                });
                break;
            }
        }

        // Nushell
        if check_command_exists("nu") {
            shells.push(ShellInfo {
                id: "nushell".to_string(),
                name: "Nushell".to_string(),
                path: "nu.exe".to_string(),
                args: vec![],
            });
        }
    }

    #[cfg(unix)]
    {
        // Bash
        if PathBuf::from("/bin/bash").exists() {
            shells.push(ShellInfo {
                id: "bash".to_string(),
                name: "Bash".to_string(),
                path: "/bin/bash".to_string(),
                args: vec![],
            });
        }

        // Zsh
        if PathBuf::from("/bin/zsh").exists() || PathBuf::from("/usr/bin/zsh").exists() {
            shells.push(ShellInfo {
                id: "zsh".to_string(),
                name: "Zsh".to_string(),
                path: "zsh".to_string(),
                args: vec![],
            });
        }

        // Fish
        if check_command_exists("fish") {
            shells.push(ShellInfo {
                id: "fish".to_string(),
                name: "Fish".to_string(),
                path: "fish".to_string(),
                args: vec![],
            });
        }

        // Sh (POSIX shell)
        if PathBuf::from("/bin/sh").exists() {
            shells.push(ShellInfo {
                id: "sh".to_string(),
                name: "sh".to_string(),
                path: "/bin/sh".to_string(),
                args: vec![],
            });
        }

        // Nushell
        if check_command_exists("nu") {
            shells.push(ShellInfo {
                id: "nushell".to_string(),
                name: "Nushell".to_string(),
                path: "nu".to_string(),
                args: vec![],
            });
        }
    }

    Ok(ApiResponse::success(ShellListResult { shells }))
}

/// Check if a command exists in PATH (CREATE_NO_WINDOW on Windows to avoid console flashing)
fn check_command_exists(cmd: &str) -> bool {
    #[cfg(windows)]
    {
        let mut c = Command::new("where");
        c.arg(cmd);
        c.creation_flags(0x08000000); // CREATE_NO_WINDOW
        c.output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    #[cfg(unix)]
    {
        Command::new("which")
            .arg(cmd)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
}
